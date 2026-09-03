import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { demoDefaultResults, demoSearch, guideTracks, type Track } from "@/lib/catalog";

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

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const guide = req.nextUrl.searchParams.get("guide")?.trim() ?? "";
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!q && !guide) {
    return NextResponse.json({ results: demoDefaultResults().filter((t) => isReasonableLength(t.durationS)), source: "demo" });
  }

  // Guide pills are a fixed, curated list, not a free-text query — see
  // GUIDE_CATALOG in src/lib/catalog.ts for why this never touches YouTube's
  // API at all (id, title, artist, and duration are pre-verified and
  // hardcoded). This branch runs identically with or without an API key,
  // and regardless of whether the search quota is exhausted for the day.
  if (guide) {
    return NextResponse.json({ results: guideTracks(guide), source: "curated" });
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
