import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { curatedPool, demoDefaultResults, demoSearch, type Track } from "@/lib/catalog";

export const runtime = "nodejs";

// Everyone in the room is stuck with whatever gets queued — an hour-long
// "ultimate compilation" or a full album upload has to be votable out one
// song at a time. 10 minutes clears real songs (Stairway to Heaven is 8:02,
// American Pie is 8:33) while blocking compilations and DJ mixes. Also
// enforced in add_to_queue() in Postgres, since that RPC can be called
// directly and must not trust the client's search results alone.
export const MAX_SONG_DURATION_S = 600;

function isReasonableLength(durationS: number): boolean {
  return durationS > 0 && durationS <= MAX_SONG_DURATION_S;
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, { auth: { persistSession: false } });
}

function parseIsoDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const [, h, min, s] = m;
  return (Number(h) || 0) * 3600 + (Number(min) || 0) * 60 + (Number(s) || 0);
}

async function youtubeSearch(query: string, apiKey: string): Promise<Track[]> {
  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("videoCategoryId", "10");
  searchUrl.searchParams.set("videoEmbeddable", "true");
  // fetch extra: some results get filtered out for length below, and we'd
  // rather still show a full page than a search that mysteriously thins out
  searchUrl.searchParams.set("maxResults", "20");
  searchUrl.searchParams.set("key", apiKey);

  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) throw new Error(`YouTube search.list failed: ${searchRes.status}`);
  const searchJson = await searchRes.json();
  const ids: string[] = (searchJson.items ?? [])
    .map((it: { id?: { videoId?: string } }) => it.id?.videoId)
    .filter(Boolean);
  if (ids.length === 0) return [];

  const tracks = await lookupVideos(ids, apiKey);
  return tracks.filter((t) => isReasonableLength(t.durationS));
}

/** videos.list — a separate, far less constrained quota bucket than
 * search.list (1 unit vs. 100). Used both for real search results (after
 * search.list finds candidate ids) and, in principle, could re-verify guide
 * tracks — though those are pre-verified once and hardcoded, so no call is
 * needed for them at all. */
async function lookupVideos(ids: string[], apiKey: string): Promise<Track[]> {
  const videosUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  videosUrl.searchParams.set("part", "snippet,contentDetails");
  videosUrl.searchParams.set("id", ids.join(","));
  videosUrl.searchParams.set("key", apiKey);
  const videosRes = await fetch(videosUrl);
  if (!videosRes.ok) throw new Error(`YouTube videos.list failed: ${videosRes.status}`);
  const videosJson = await videosRes.json();

  type VideoItem = {
    id: string;
    snippet: { title: string; channelTitle: string; thumbnails?: { medium?: { url: string } } };
    contentDetails: { duration: string };
  };
  return (videosJson.items ?? []).map((v: VideoItem) => ({
    videoId: v.id,
    title: v.snippet.title,
    artist: v.snippet.channelTitle,
    durationS: parseIsoDuration(v.contentDetails.duration),
    thumbUrl: v.snippet.thumbnails?.medium?.url ?? `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`,
  }));
}

/**
 * Fallback for when search.list is unavailable — this project's is capped
 * at 100 units/day (one call), and demo-catalog-only search has almost no
 * real coverage. This is not an official API: it fetches YouTube's own
 * public /results page (the page a browser gets, not a metered endpoint)
 * and pulls video entries out of the `ytInitialData` blob embedded in the
 * HTML, the same technique several open-source YouTube-search libraries
 * use. It costs no quota because it isn't going through the Data API at
 * all, but it is unofficial: YouTube's Terms of Service don't sanction
 * scraping the page, there is no key or rate-limit contract, and the
 * internal JSON shape can change without notice — this is written
 * defensively (every field access guarded, satisfied with partial results)
 * so a shape change degrades to zero results rather than throwing.
 *
 * A video found this way hasn't been confirmed embeddable the way
 * search.list's videoEmbeddable=true does. That's an acceptable risk only
 * because the host player already has a real safety net for it (STALLED
 * watchdog + onError auto-skip in use-youtube-player.ts) — an unplayable
 * pick gets skipped with a visible reason instead of freezing the room.
 */
async function scrapeYouTubeSearch(query: string): Promise<Track[]> {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      // YouTube serves a materially different (often unparseable) response
      // to requests that don't look like a real browser.
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`YouTube results page fetch failed: ${res.status}`);
  const html = await res.text();

  const match = html.match(/var ytInitialData = (\{[\s\S]+?\});<\/script>/);
  if (!match) throw new Error("could not locate ytInitialData in results page");

  let data: unknown;
  try {
    data = JSON.parse(match[1]);
  } catch {
    throw new Error("ytInitialData was not valid JSON — page structure likely changed");
  }

  const contents = digDeep(data, [
    "contents",
    "twoColumnSearchResultsRenderer",
    "primaryContents",
    "sectionListRenderer",
    "contents",
  ]);
  if (!Array.isArray(contents)) throw new Error("unexpected results page shape");

  const tracks: Track[] = [];
  for (const section of contents) {
    const items = digDeep(section, ["itemSectionRenderer", "contents"]);
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const v = (item as { videoRenderer?: unknown })?.videoRenderer;
      if (!v || typeof v !== "object") continue;

      const videoId = (v as { videoId?: unknown }).videoId;
      const title = digDeep(v, ["title", "runs", 0, "text"]);
      const artist = digDeep(v, ["ownerText", "runs", 0, "text"]);
      const lengthText = digDeep(v, ["lengthText", "simpleText"]);
      if (typeof videoId !== "string" || typeof title !== "string" || typeof lengthText !== "string") {
        continue; // missing lengthText usually means a live stream — no fixed end, skip it
      }

      const durationS = parseClockDuration(lengthText);
      if (!isReasonableLength(durationS)) continue;

      tracks.push({
        videoId,
        title,
        artist: typeof artist === "string" ? artist : "YouTube",
        durationS,
        thumbUrl: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
      });
      if (tracks.length >= 20) return tracks;
    }
  }
  return tracks;
}

/** Safely reads a path of keys/indices through an unknown value without
 * throwing on any missing/mismatched step along the way. */
function digDeep(value: unknown, path: Array<string | number>): unknown {
  let cur: unknown = value;
  for (const key of path) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string | number, unknown>)[key];
  }
  return cur;
}

/** "3:33" or "1:04:22" -> seconds. */
function parseClockDuration(text: string): number {
  const parts = text.split(":").map(Number);
  if (parts.some(Number.isNaN)) return 0;
  return parts.reduceRight((total, part, i, arr) => total + part * Math.pow(60, arr.length - 1 - i), 0);
}

/* ------------------------------------------------- daily recommendations --- */

/**
 * Home first, then one other place each day.
 *
 * The rooms this runs in are in Kathmandu, so NP is always half the list —
 * it's where the night's actual singalongs come from. The second slot
 * rotates so the other half is somewhere new every day, which is the whole
 * point of the tab: something unfamiliar to argue about.
 */
const HOME_REGION = "NP";
const VISITING_REGIONS = ["IN", "US", "KR", "GB", "JP", "BR", "MX", "ID", "DE", "FR", "CA", "AU"];

/**
 * The day, in UTC.
 *
 * UTC on purpose rather than Kathmandu local: the list changes when this
 * flips, and 00:00 UTC is 05:45 in Kathmandu — nobody is mid-party. Local
 * midnight would swap the recommendations out from under a room at exactly
 * the moment it's busiest.
 */
function dayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function dayNumber(key: string): number {
  return Math.floor(Date.parse(`${key}T00:00:00Z`) / 86_400_000);
}

/** Small seeded PRNG. The shuffle has to be identical for everyone in a room
 *  and stable across the day, so it can't come from Math.random(). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * How much we want to suggest a song of this length.
 *
 * A recommendation is a nudge, and nudging a room toward a ten-minute track
 * costs everyone ten minutes. The cap stays at MAX_SONG_DURATION_S — anyone
 * can still search a long song out and queue it deliberately — this only
 * shapes what gets offered unprompted.
 *
 * Weights rather than a shorter cutoff, because a hard limit would throw out
 * real favourites: Dhairya is 6:34 and the Narayan Gopal classics run past
 * seven minutes. Those should turn up now and then, just not as often as a
 * three-minute single.
 */
function lengthWeight(durationS: number): number {
  if (durationS < 150) return 0.5; // under 2:30 — often an edit, intro or snippet
  if (durationS <= 300) return 1; // 2:30-5:00 — where most singles sit
  if (durationS <= 390) return 0.5; // 5:00-6:30
  if (durationS <= 480) return 0.2; // 6:30-8:00
  return 0.08; // 8:00-10:00 — rare, not banned
}

/**
 * Shuffle, but with a thumb on the scale for shorter songs.
 *
 * Efraimidis-Spirakis: give each item a key of random^(1/weight) and sort
 * descending. A heavier weight pulls the key toward 1, so it tends to land
 * near the front — while every item keeps a real chance, which is what stops
 * the tab showing the same handful of three-minute songs every day.
 * Deterministic, because the seed is the date.
 */
function weightedOrder(tracks: Track[], seed: number): Track[] {
  const rand = mulberry32(seed);
  return tracks
    .map((t) => ({ t, key: Math.pow(rand(), 1 / lengthWeight(t.durationS)) }))
    .sort((a, b) => b.key - a.key)
    .map((x) => x.t);
}

/** Alternate between the lists so the first screenful is already mixed,
 *  rather than all of one place followed by all of the other. */
function interleave(a: Track[], b: Track[]): Track[] {
  const out: Track[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i]) out.push(a[i]);
    if (b[i]) out.push(b[i]);
  }
  return out;
}

/**
 * YouTube's own most-popular music chart for a region.
 *
 * videos.list costs 1 quota unit per call whatever maxResults says, against
 * the 100 that a single search.list burns — so the whole day's
 * recommendations cost 2 units, once, for every room. Asking for `status`
 * too is free and lets us drop anything that can't be embedded, which the
 * scrape path has no way to check.
 */
async function trendingMusic(regionCode: string, apiKey: string): Promise<Track[]> {
  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "snippet,contentDetails,status");
  url.searchParams.set("chart", "mostPopular");
  url.searchParams.set("videoCategoryId", "10"); // Music
  url.searchParams.set("regionCode", regionCode);
  url.searchParams.set("maxResults", "50");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`videos.list chart failed for ${regionCode}: ${res.status}`);
  const json = await res.json();

  type ChartItem = {
    id: string;
    snippet: { title: string; channelTitle: string; thumbnails?: { medium?: { url: string } } };
    contentDetails: { duration: string };
    status?: { embeddable?: boolean };
  };
  return (json.items ?? [])
    .filter((v: ChartItem) => v.status?.embeddable !== false)
    .map((v: ChartItem) => ({
      videoId: v.id,
      title: v.snippet.title,
      artist: v.snippet.channelTitle,
      durationS: parseIsoDuration(v.contentDetails.duration),
      thumbUrl: v.snippet.thumbnails?.medium?.url ?? `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`,
    }))
    .filter((t: Track) => isReasonableLength(t.durationS));
}

const DAILY_LIMIT = 24;

async function dailyPicks(apiKey: string | undefined, key: string): Promise<{ results: Track[]; source: string }> {
  const seed = dayNumber(key);

  if (apiKey) {
    const visiting = VISITING_REGIONS[((seed % VISITING_REGIONS.length) + VISITING_REGIONS.length) % VISITING_REGIONS.length];
    const [home, away] = await Promise.allSettled([
      trendingMusic(HOME_REGION, apiKey),
      trendingMusic(visiting, apiKey),
    ]);
    const homeTracks = home.status === "fulfilled" ? home.value : [];
    const awayTracks = away.status === "fulfilled" ? away.value : [];
    if (home.status === "rejected") console.error("daily: home chart failed:", home.reason);
    if (away.status === "rejected") console.error("daily: visiting chart failed:", away.reason);

    // Order each side before interleaving, so it isn't the same top ten in
    // the same order every day that the chart barely moves.
    const merged = interleave(weightedOrder(homeTracks, seed), weightedOrder(awayTracks, seed + 1));
    const seen = new Set<string>();
    const picks = merged.filter((t) => !seen.has(t.videoId) && seen.add(t.videoId)).slice(0, DAILY_LIMIT);
    if (picks.length > 0) return { results: picks, source: `youtube-chart:${HOME_REGION}+${visiting}` };
  }

  // No key, or both charts unreachable. Still real, playable songs.
  return { results: weightedOrder(curatedPool(), seed).slice(0, DAILY_LIMIT), source: "curated" };
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const daily = req.nextUrl.searchParams.get("daily") === "1";
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!q && !daily) {
    return NextResponse.json({ results: demoDefaultResults().filter((t) => isReasonableLength(t.durationS)), source: "demo" });
  }

  // One row per day, shared by everyone: the first person to open the tab
  // after midnight UTC pays the two quota units, and the rest of the world
  // reads the same list out of Postgres.
  if (daily) {
    const key = `daily:${dayKey()}`;
    const db = serviceClient();
    if (db) {
      const { data: cached } = await db.from("search_cache").select("results").eq("query", key).maybeSingle();
      if (cached) return NextResponse.json({ results: cached.results as Track[], source: "cache" });
    }
    try {
      const { results, source } = await dailyPicks(apiKey, dayKey());
      if (db && results.length > 0) await db.from("search_cache").upsert({ query: key, results });
      return NextResponse.json({ results, source });
    } catch (err) {
      console.error("dailyPicks failed, falling back to the curated pool:", err);
      return NextResponse.json({ results: weightedOrder(curatedPool(), dayNumber(dayKey())).slice(0, DAILY_LIMIT), source: "curated-fallback" });
    }
  }

  const cacheKey = q.toLowerCase();
  const db = serviceClient();

  if (db) {
    const { data: cached } = await db
      .from("search_cache")
      .select("results")
      .eq("query", cacheKey)
      .maybeSingle();
    if (cached) {
      return NextResponse.json({ results: cached.results as Track[], source: "cache" });
    }
  }

  const cache = async (results: Track[]) => {
    if (db && results.length > 0) await db.from("search_cache").upsert({ query: cacheKey, results });
  };

  // Official API first when a key is configured — it's more reliable
  // (confirmed embeddable, accurate metadata) while quota actually remains.
  if (apiKey) {
    try {
      const results = await youtubeSearch(q, apiKey);
      await cache(results);
      return NextResponse.json({ results, source: "youtube" });
    } catch (err) {
      console.error("youtubeSearch failed, falling back to scrape:", err);
    }
  }

  try {
    const results = await scrapeYouTubeSearch(q);
    await cache(results);
    return NextResponse.json({ results, source: "youtube-scrape" });
  } catch (err) {
    console.error("scrapeYouTubeSearch failed, falling back to demo catalog:", err);
    return NextResponse.json({ results: demoSearch(q).filter((t) => isReasonableLength(t.durationS)), source: "demo-fallback" });
  }
}
