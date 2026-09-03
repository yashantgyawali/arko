"use client";

import { useCallback, useRef, useState } from "react";

type LoadTarget = { videoId: string; startSeconds?: number };

type YTPlayer = {
  loadVideoById: (video: string | LoadTarget) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  destroy: () => void;
};

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLElement | string,
        opts: {
          height: string;
          width: string;
          playerVars: Record<string, number>;
          events: {
            onReady: () => void;
            onStateChange: (e: { data: number }) => void;
            onError: (e: { data: number }) => void;
          };
        },
      ) => YTPlayer;
      PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

// The IFrame API's `onReady` fires before every method is reliably attached
// to the player object in practice — poll briefly rather than trust it blindly.
function callWhenReady(getPlayer: () => YTPlayer | null, fn: (p: YTPlayer) => void, attempt = 0) {
  const p = getPlayer();
  if (p && typeof p.loadVideoById === "function") {
    fn(p);
    return;
  }
  if (attempt >= 20) return;
  setTimeout(() => callWhenReady(getPlayer, fn, attempt + 1), 100);
}

/** Synthetic error code for "the player never started", see armWatchdog. */
export const STALLED = -1;
const STALL_TIMEOUT_MS = 12000;
// The very first song of a session loads against a player that doesn't exist
// yet — the IFrame API script has to fetch and the YT.Player has to spin up —
// before any actual video buffering even begins. That setup alone can exceed
// STALL_TIMEOUT_MS on a cold load, so it gets its own generous allowance
// instead of eating into the buffering budget every song after it gets.
const COLD_START_TIMEOUT_MS = 20000;

let apiLoadPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (apiLoadPromise) return apiLoadPromise;
  apiLoadPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
  });
  return apiLoadPromise;
}

/**
 * Uses a callback ref (not an effect keyed on a static id) so the player is
 * created exactly when its DOM node mounts — safe even if the node's
 * presence is gated behind async state (loading screens, conditional JSX).
 *
 * Native YouTube controls are disabled (controls/disablekb/fs off) so the
 * host can only play/pause, never scrub to an arbitrary point — everyone's
 * vote meter and elapsed time are keyed off the server's `started_at`, which
 * only a real skip/replay is allowed to reset.
 */
export function useYouTubePlayer(onEnded: () => void, onError?: (code: number) => void) {
  const playerRef = useRef<YTPlayer | null>(null);
  const readyRef = useRef(false);
  const pendingVideo = useRef<LoadTarget | null>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const cancelledRef = useRef(false);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  // The very first video of a session starts itself (a realtime event calls
  // loadVideo, not a click), so it never carries the user gesture browsers
  // require for unmuted autoplay — it just sits on YouTube's own paused
  // "click to play" state forever. That's not a broken video, so the old
  // behavior of auto-skipping on stall was throwing away a perfectly good
  // song for a browser policy that has nothing to do with the pick. Surface
  // it instead and let one tap (a real gesture) resume it.
  const [needsTap, setNeedsTap] = useState(false);

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  /**
   * YouTube does not always fire `onError` when playback is blocked — with an
   * ad blocker or a third-party-cookie block it renders its own "An error
   * occurred" panel inside the iframe and stays silent on the API. Without a
   * watchdog the room sits on a dead player for the whole song, so treat
   * "never reached PLAYING" as a failure. Only genuinely give up (skip) when
   * the player/API itself never showed up at all (still `pendingVideo`,
   * nothing on screen to tap); once a video has actually been handed to a
   * real player, prefer prompting for a tap over discarding the song.
   */
  const armWatchdog = useCallback(
    (ms = STALL_TIMEOUT_MS) => {
      clearWatchdog();
      watchdogRef.current = setTimeout(() => {
        watchdogRef.current = null;
        if (pendingVideo.current) {
          onErrorRef.current?.(STALLED);
        } else {
          setNeedsTap(true);
        }
      }, ms);
    },
    [clearWatchdog],
  );

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) {
      cancelledRef.current = true;
      playerRef.current?.destroy?.();
      playerRef.current = null;
      readyRef.current = false;
      return;
    }

    cancelledRef.current = false;
    loadYouTubeApi().then(() => {
      if (cancelledRef.current || !window.YT) return;
      playerRef.current = new window.YT.Player(node, {
        height: "100%",
        width: "100%",
        playerVars: {
          autoplay: 1,
          rel: 0,
          modestbranding: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
        },
        events: {
          onReady: () => {
            readyRef.current = true;
            if (pendingVideo.current) {
              const target = pendingVideo.current;
              pendingVideo.current = null;
              // Cold-start allowance is over — actual buffering starts now,
              // so give it a fresh, normal-sized window.
              armWatchdog();
              callWhenReady(() => playerRef.current, (p) => p.loadVideoById(target));
            }
          },
          onStateChange: (e) => {
            if (!window.YT) return;
            if (e.data === window.YT.PlayerState.ENDED) onEndedRef.current();
            if (e.data === window.YT.PlayerState.PLAYING) {
              clearWatchdog();
              setNeedsTap(false);
              setIsPlaying(true);
            }
            if (e.data === window.YT.PlayerState.PAUSED) setIsPlaying(false);
          },
          onError: (e) => {
            clearWatchdog();
            onErrorRef.current?.(e.data);
          },
        },
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * `startSeconds` matters whenever the player is created against a song
   * already in progress — a page load, or a refresh mid-song — not just a
   * genuinely new song starting at 0. Without it `loadVideoById` always
   * starts from 0:00, so a refresh would visibly show the correct elapsed
   * time (that's derived from the server's `started_at`, independent of the
   * player) while the audio silently restarted from the beginning.
   */
  const loadVideo = useCallback(
    (videoId: string, startSeconds = 0) => {
      setIsPlaying(true);
      setNeedsTap(false);
      const target: LoadTarget = startSeconds > 0 ? { videoId, startSeconds } : { videoId };
      if (readyRef.current) {
        pendingVideo.current = null;
        armWatchdog();
        callWhenReady(() => playerRef.current, (p) => p.loadVideoById(target));
      } else {
        // Player isn't built yet (first song of the session) — onReady arms
        // the real watchdog once loadVideoById actually fires; this only
        // guards against the API script/player never showing up at all.
        pendingVideo.current = target;
        armWatchdog(COLD_START_TIMEOUT_MS);
      }
    },
    [armWatchdog],
  );

  const play = useCallback(() => callWhenReady(() => playerRef.current, (p) => p.playVideo()), []);
  /** Resolves a needsTap prompt: a real click here is exactly the user
   * gesture the browser withheld from the original autoplay attempt. */
  const resume = useCallback(() => {
    setNeedsTap(false);
    armWatchdog();
    callWhenReady(() => playerRef.current, (p) => p.playVideo());
  }, [armWatchdog]);
  // an intentional pause must not look like a stall
  const pause = useCallback(() => {
    clearWatchdog();
    callWhenReady(() => playerRef.current, (p) => p.pauseVideo());
  }, [clearWatchdog]);
  const stop = useCallback(() => {
    clearWatchdog();
    pendingVideo.current = null;
    setNeedsTap(false);
    if (readyRef.current) callWhenReady(() => playerRef.current, (p) => p.stopVideo());
  }, [clearWatchdog]);

  return { containerRef, loadVideo, play, pause, stop, resume, isPlaying, needsTap };
}
