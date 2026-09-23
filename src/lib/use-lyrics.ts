"use client";

import { useCallback, useEffect, useState } from "react";
import { songElapsedS } from "@/lib/format";
import { activeLineIndex, type LyricLine, type LyricsStatus } from "@/lib/lyrics";

/** Four times a second. See the ticker below for why this isn't rAF. */
const TICK_MS = 250;
const NUDGE_KEY = "arko:lyric-nudge";
const MAX_NUDGE_S = 10;

type Song = {
  video_id: string;
  title: string;
  artist: string;
  duration_s: number;
  audio_started_at: string | null;
  paused_at: string | null;
  paused_ms: number;
} | null;

export type LyricsState = {
  status: LyricsStatus | "loading";
  lines: LyricLine[];
  plain: string | null;
  /** Index into `lines` of the line to light, or -1. */
  index: number;
  nudgeS: number;
  setNudgeS: (s: number) => void;
};

// Held as one object stamped with the video it describes, so "these lyrics
// belong to a song that is no longer playing" is a comparison rather than a
// cleanup step that has to fire in time.
type Fetched = {
  videoId: string;
  status: LyricsStatus;
  lines: LyricLine[];
  plain: string | null;
};

const NO_LINES: LyricLine[] = [];

function readNudge(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(NUDGE_KEY);
    const n = raw === null ? 0 : Number(raw);
    return Number.isFinite(n) ? Math.max(-MAX_NUDGE_S, Math.min(MAX_NUDGE_S, n)) : 0;
  } catch {
    return 0;
  }
}

/**
 * Lyrics for the song playing, and which line is current.
 *
 * Owns three things that have to agree: the fetch, a correction for this
 * device's clock, and the tick that moves the highlight.
 */
export function useLyrics(song: Song, roomStartedAt: string | null): LyricsState {
  const [fetched, setFetched] = useState<Fetched | null>(null);
  const [rawIndex, setRawIndex] = useState(-1);
  const [nudgeS, setNudge] = useState(0);

  // How far this device's clock runs ahead of the server's, in seconds.
  // songElapsedS subtracts a Postgres timestamp from this phone's Date.now(),
  // so a phone four seconds fast puts every song four seconds ahead —
  // constant per device, unbounded, and uncorrected anywhere else in the app.
  const [skewS, setSkewS] = useState(0);

  const videoId = song?.video_id ?? "";
  const title = song?.title ?? "";
  const artist = song?.artist ?? "";
  const durationS = song?.duration_s ?? 0;

  // Derived, not cleared on song change: the moment videoId moves on, last
  // song's lyrics stop being this song's lyrics, with no window in which the
  // old words could be highlighted against the new track.
  const current = fetched && fetched.videoId === videoId ? fetched : null;
  const status: LyricsStatus | "loading" = !videoId ? "loading" : current?.status ?? "loading";
  const lines = current?.lines ?? NO_LINES;

  // localStorage is read in an effect, not during render: the page is
  // server-rendered first and an inline read would mismatch on hydration.
  useEffect(() => {
    setNudge(readNudge());
  }, []);

  const setNudgeS = useCallback((s: number) => {
    const clamped = Math.max(-MAX_NUDGE_S, Math.min(MAX_NUDGE_S, Math.round(s * 4) / 4));
    setNudge(clamped);
    try {
      window.localStorage.setItem(NUDGE_KEY, String(clamped));
    } catch {
      // Private browsing, or storage disabled. The nudge still works for this
      // session, it just won't be remembered.
    }
  }, []);

  useEffect(() => {
    if (!videoId || !title) return;

    const controller = new AbortController();
    const params = new URLSearchParams({
      videoId,
      title,
      artist,
      durationS: String(durationS),
    });
    const sentAt = Date.now();

    fetch(`/api/lyrics?${params.toString()}`, { signal: controller.signal })
      .then((r) => {
        // The response's Date header is a free read of the server's clock —
        // no extra request — and removes the bulk of the device skew. Its
        // one-second resolution leaves well under a lyric line of error.
        const serverMs = Date.parse(r.headers.get("date") ?? "");
        if (!Number.isNaN(serverMs)) {
          const rtt = Date.now() - sentAt;
          setSkewS((Date.now() - (serverMs + rtt / 2)) / 1000);
        }
        return r.json();
      })
      .then((data) => {
        // Abort alone loses the race when the response is already in flight,
        // so check that what we asked for is still what's playing.
        if (data?.videoId !== videoId) return;
        setFetched({
          videoId,
          status: (data.status as LyricsStatus) ?? "none",
          lines: Array.isArray(data.lines) ? data.lines : [],
          plain: data.plain ?? null,
        });
      })
      .catch(() => {
        // Aborted, offline, or malformed. Nothing to show and nothing to say.
      });

    return () => controller.abort();
  }, [videoId, title, artist, durationS]);

  const anchor = song?.audio_started_at ?? null;
  const pausedAt = song?.paused_at ?? null;
  const pausedMs = song?.paused_ms ?? 0;

  useEffect(() => {
    if (!anchor || lines.length === 0) return;
    const s = { audio_started_at: anchor, paused_at: pausedAt, paused_ms: pausedMs };

    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      const t = songElapsedS(s, roomStartedAt) - skewS + nudgeS;
      // Writing the same value back makes React bail out of the render
      // entirely. That's what pays for a 4Hz tick: a line lasts two to four
      // seconds, so nearly every tick costs one binary search and no render.
      setRawIndex((prev) => {
        const next = activeLineIndex(lines, t);
        return next === prev ? prev : next;
      });
    };

    tick();

    // Paused: songElapsedS pins to paused_at, so nothing can change. Run once
    // and start no timer — the highlight freezes where the music did.
    if (pausedAt) return;

    const id = setInterval(tick, TICK_MS);
    // Phones throttle or suspend timers in a backgrounded tab, so the first
    // tick after the screen wakes can be stale.
    const onWake = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, [anchor, pausedAt, pausedMs, roomStartedAt, lines, skewS, nudgeS]);

  // Clamped rather than reset: a new song's lines can land one render before
  // the ticker re-runs, and an index past the end would read as a blank line.
  const index = anchor && lines.length > 0 ? Math.min(rawIndex, lines.length - 1) : -1;

  return { status, lines, plain: current?.plain ?? null, index, nudgeS, setNudgeS };
}
