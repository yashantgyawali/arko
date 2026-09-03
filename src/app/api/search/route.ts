import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  demoDefaultResults,
  demoGuide,
  demoSearch,
  type Track,
} from "@/lib/catalog";

export const runtime = "nodejs";

const GUIDE_QUERIES: Record<string, string> = {
  "party starters": "party hits playlist",
  "80s": "80s hits",
  "sing along": "sing along classics",
  risky: "guilty pleasure pop hits",
};

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
  searchUrl.searchParams.set("maxResults", "12");
  searchUrl.searchParams.set("key", apiKey);

  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) throw new Error(`YouTube search failed: ${searchRes.status}`);
  const searchJson = await searchRes.json();
  const ids: string[] = (searchJson.items ?? [])
    .map((it: { id?: { videoId?: string } }) => it.id?.videoId)
    .filter(Boolean);
  if (ids.length === 0) return [];

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
    return NextResponse.json({ results: demoDefaultResults(), source: "demo" });
  }

  if (!apiKey) {
    const results = guide ? demoGuide(guide) : demoSearch(q);
    return NextResponse.json({ results, source: "demo" });
  }

  const effectiveQuery = guide ? GUIDE_QUERIES[guide] ?? guide : q;
  const cacheKey = effectiveQuery.toLowerCase();
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
    const results = await youtubeSearch(effectiveQuery, apiKey);
    if (db && results.length > 0) {
      await db.from("search_cache").upsert({ query: cacheKey, results });
    }
    return NextResponse.json({ results, source: "youtube" });
  } catch (err) {
    console.error(err);
    const results = guide ? demoGuide(guide) : demoSearch(q);
    return NextResponse.json({ results, source: "demo-fallback" });
  }
}
