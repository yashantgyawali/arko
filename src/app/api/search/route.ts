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
  if (!searchRes.ok) throw new Error(`YouTube search failed: ${searchRes.status}`);
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
  if (!videosRes.ok) throw new Error(`YouTube videos lookup failed: ${videosRes.status}`);
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

  if (!apiKey) {
    return NextResponse.json({ results: demoSearch(q).filter((t) => isReasonableLength(t.durationS)), source: "demo" });
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

  try {
    const results = await youtubeSearch(q, apiKey);
    if (db && results.length > 0) {
      await db.from("search_cache").upsert({ query: cacheKey, results });
    }
    return NextResponse.json({ results, source: "youtube" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ results: demoSearch(q).filter((t) => isReasonableLength(t.durationS)), source: "demo-fallback" });
  }
}
