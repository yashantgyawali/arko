import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  cleanTrackQuery,
  parseLrc,
  pickBest,
  type CleanQuery,
  type LrclibCandidate,
  type LyricLine,
  type LyricsStatus,
  type MatchTarget,
} from "@/lib/lyrics";

// No `runtime` export: nodejs is the default in this version and the bundled
// docs say to drop it (route-segment-config/runtime.md). Route Handlers are
// uncached by default too, which is what we want — the cache that matters is
// the Postgres table below, keyed on something meaningful.

type LyricsRow = Database["public"]["Tables"]["lyrics_cache"]["Row"];

export type LyricsResponse = {
  videoId: string;
  status: LyricsStatus;
  lines: LyricLine[]; // empty unless status === "synced"
  plain: string | null;
  matched: { track: string; artist: string; duration: number | null } | null;
  source: "cache" | "lrclib" | "error";
};

const LRCLIB_SEARCH = "https://lrclib.net/api/search";
// lrclib is a free, community-run service. Identifying ourselves is the least
// we can do, and it matches how the search scrape already announces itself.
const UA = "arko/1.0 (+https://arkogana.tumlet.com)";
const FETCH_TIMEOUT_MS = 4000;

// "synced" and "instrumental" are settled facts — nothing better can arrive
// later. "plain" and "none" are provisional: the database is contributed to by
// people, so a song with no timings today may have them next month. A week is
// long enough that a party replaying the same songs all night never re-asks,
// and short enough that contributions actually land.
const RECHECK_MS = 7 * 24 * 60 * 60 * 1000;

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, { auth: { persistSession: false } });
}

function isStale(row: LyricsRow): boolean {
  if (row.status === "synced" || row.status === "instrumental") return false;
  return Date.now() - Date.parse(row.checked_at) > RECHECK_MS;
}

function fromRow(row: LyricsRow, source: LyricsResponse["source"]): LyricsResponse {
  const status = row.status as LyricsStatus;
  return {
    videoId: row.video_id,
    status,
    // Parsed on read rather than stored parsed, deliberately. parseLrc is the
    // part of this most likely to need a fix, and re-parsing means one fix
    // repairs every cached song. Storing the parsed output would freeze any
    // bug into rows with no way to tell which ones are wrong.
    lines: status === "synced" ? parseLrc(row.synced_lyrics) : [],
    plain: row.plain_lyrics,
    matched: row.track_name
      ? { track: row.track_name, artist: row.artist_name ?? "", duration: row.lrclib_duration }
      : null,
    source,
  };
}

function empty(videoId: string, source: LyricsResponse["source"]): LyricsResponse {
  return { videoId, status: "none", lines: [], plain: null, matched: null, source };
}

async function lrclibSearch(params: Record<string, string>): Promise<LrclibCandidate[]> {
  const url = new URL(LRCLIB_SEARCH);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`lrclib search failed: ${res.status}`);
  const json = await res.json();
  return Array.isArray(json) ? (json as LrclibCandidate[]) : [];
}

/**
 * Two searches, run together rather than one-then-maybe-the-other.
 *
 * Tier 1 sends the raw YouTube title, because plenty of contributed lyrics
 * are filed under exactly that and timed to that upload. Tier 2 sends the
 * cleaned pair, which rescues what free text can't express — a pipe in the
 * title returns nothing from tier 1 but three synced hits here.
 *
 * In parallel because it's one round trip instead of two, and because there's
 * then no "is tier 1 good enough?" threshold to tune — both pools feed one
 * scoring pass and the best candidate wins whichever query found it.
 */
async function lookup(want: MatchTarget, clean: CleanQuery): Promise<LrclibCandidate[]> {
  const [raw, structured] = await Promise.allSettled([
    lrclibSearch({ q: want.rawTitle }),
    lrclibSearch({ track_name: clean.track, artist_name: clean.artist }),
  ]);

  const pool = new Map<number, LrclibCandidate>();
  let ok = false;
  for (const r of [raw, structured]) {
    if (r.status === "fulfilled") {
      ok = true;
      for (const c of r.value) pool.set(c.id, c);
    } else {
      console.error("lyrics: lrclib tier failed:", r.reason);
    }
  }
  // Both tiers erroring is an outage, not an answer. Throwing keeps it from
  // being written down as "this song has no lyrics".
  if (!ok) throw new Error("lrclib unreachable");
  return [...pool.values()];
}

async function resolve(
  videoId: string,
  title: string,
  artist: string,
  durationS: number,
): Promise<LyricsResponse> {
  const db = serviceClient();

  let stale: LyricsRow | null = null;
  if (db) {
    const { data: row } = await db
      .from("lyrics_cache")
      .select("*")
      .eq("video_id", videoId)
      .maybeSingle();
    if (row) {
      if (!isStale(row)) return fromRow(row, "cache");
      // Kept in hand: if lrclib is down we'd rather re-serve last week's plain
      // lyrics than drop a guest from "some lyrics" to "no lyrics".
      stale = row;
    }
  }

  const clean = cleanTrackQuery(title, artist);
  const want: MatchTarget = {
    rawTitle: title,
    track: clean.track,
    artist: clean.artist,
    artistConfident: clean.artistConfident,
    durationS,
  };

  let candidates: LrclibCandidate[];
  try {
    candidates = await lookup(want, clean);
  } catch (err) {
    console.error("lyrics: lookup failed:", err);
    // Nothing is written. An outage must never be recorded as "no lyrics" —
    // that would disable the song for a week over a network blip.
    return stale ? fromRow(stale, "cache") : empty(videoId, "error");
  }

  const { best, status } = pickBest(candidates, want);

  if (db) {
    const { error } = await db.from("lyrics_cache").upsert({
      video_id: videoId,
      status,
      synced_lyrics: status === "synced" ? best?.syncedLyrics ?? null : null,
      plain_lyrics: best?.plainLyrics ?? null,
      track_name: best?.trackName ?? null,
      artist_name: best?.artistName ?? null,
      lrclib_id: best?.id ?? null,
      lrclib_duration: best?.duration ?? null,
      checked_at: new Date().toISOString(),
    });
    if (error) console.error("lyrics: cache write failed:", error);
  }

  return {
    videoId,
    status,
    lines: status === "synced" ? parseLrc(best?.syncedLyrics) : [],
    plain: best?.plainLyrics ?? null,
    matched: best
      ? { track: best.trackName, artist: best.artistName, duration: best.duration }
      : null,
    source: "lrclib",
  };
}

/**
 * Everyone in a room hits this for the same song at the same moment. Within
 * one instance that collapses to a single pair of upstream requests; across
 * serverless instances it's partial, which is still far better than one
 * lookup per guest.
 */
const inflight = new Map<string, Promise<LyricsResponse>>();

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const videoId = sp.get("videoId")?.trim() ?? "";
  const title = sp.get("title")?.trim() ?? "";
  const artist = sp.get("artist")?.trim() ?? "";
  const durationS = Number(sp.get("durationS") ?? 0);

  // Shape-check the id before it can become a primary key.
  if (!/^[\w-]{11}$/.test(videoId) || !title) {
    return NextResponse.json(empty(videoId, "error"));
  }

  const running = inflight.get(videoId);
  if (running) return NextResponse.json(await running);

  const work = resolve(videoId, title, artist, durationS).catch((err) => {
    console.error("lyrics: unexpected failure:", err);
    return empty(videoId, "error");
  });
  inflight.set(videoId, work);

  try {
    return NextResponse.json(await work);
  } finally {
    inflight.delete(videoId);
  }
}
