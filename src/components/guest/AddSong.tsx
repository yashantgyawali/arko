"use client";

import { useEffect, useState } from "react";
import { useRoomContext } from "@/lib/room-context";
import { addToQueue, songHistory, type HistorySong } from "@/lib/actions";
import { mmss, thumb } from "@/lib/format";
import { getSavedPlaylist, saveTrackToPlaylist } from "@/lib/saved-playlist";
import type { Track } from "@/lib/catalog";

type Tab = "recommended" | "history" | "playlist";

const TABS: { key: Tab; label: string }[] = [
  { key: "recommended", label: "Recommended" },
  { key: "history", label: "Hall of fame" },
  { key: "playlist", label: "My playlist" },
];

export function AddSong({ onAdded }: { onAdded: (track: Track) => void }) {
  const { room, queue, nowPlaying } = useRoomContext();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("recommended");
  const [results, setResults] = useState<Track[]>([]);
  const [daily, setDaily] = useState<Track[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(true);
  const [history, setHistory] = useState<HistorySong[]>([]);
  // One flag, not two: "not loaded yet" is the same thing as "loading", and
  // marking it loaded even on failure is what stops a dead request spinning
  // forever instead of showing the empty state.
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Songs this browser has queued before, kept locally — lets a returning
  // host (or guest) skip re-searching their usual picks for a brand new room.
  const [saved, setSaved] = useState<Track[]>([]);
  useEffect(() => {
    setSaved(getSavedPlaylist());
  }, []);

  useEffect(() => {
    if (!addError) return;
    const t = setTimeout(() => setAddError(null), 4000);
    return () => clearTimeout(t);
  }, [addError]);

  // Today's picks, fetched once. The server hands everyone the same list for
  // the whole day, so there's nothing to refetch as the tabs are switched.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/search?daily=1", { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setDaily(data.results ?? []))
      .catch(() => {})
      .finally(() => setLoadingDaily(false));
    return () => controller.abort();
  }, []);

  // Fetched the first time the tab is opened rather than on mount: it's an
  // aggregate over every song ever played, and most sessions never ask for it.
  useEffect(() => {
    if (tab !== "history" || historyLoaded) return;
    let live = true;
    songHistory()
      .then((rows) => {
        if (live) setHistory(rows);
      })
      .catch(() => {})
      .finally(() => {
        if (live) setHistoryLoaded(true);
      });
    return () => {
      live = false;
    };
  }, [tab, historyLoaded]);

  const searching = query.trim().length > 0;

  // The history rows carry their own vote tallies, but everything below this
  // renders a plain Track, so flatten once here.
  const historyTracks: Track[] = history.map((h) => ({
    videoId: h.videoId,
    title: h.title,
    artist: h.artist,
    durationS: h.durationS,
    thumbUrl: h.thumbUrl ?? "",
  }));
  const scoreOf = new Map(history.map((h) => [h.videoId, h]));

  useEffect(() => {
    // Nothing to reset when the box is emptied: displayResults only ever
    // reads `results` while a search is actually running.
    if (!searching) return;
    const controller = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((data) => setResults(data.results ?? []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 400);

    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query, searching]);

  const queuedIds = new Set(
    queue.filter((q) => q.status === "queued" || q.status === "playing").map((q) => q.video_id),
  );

  async function add(track: Track) {
    if (!room) return;
    setAddError(null);
    try {
      await addToQueue(room.id, track);
      setSaved(saveTrackToPlaylist(track));
      onAdded(track);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setAddError(
        message.toLowerCase().includes("already queued")
          ? "That song's already in the queue."
          : message || "Couldn't add that song. Try again.",
      );
    }
  }

  const displayResults = searching
    ? results
    : tab === "playlist"
      ? saved
      : tab === "history"
        ? historyTracks
        : daily;
  const busy = searching
    ? loading
    : tab === "history"
      ? !historyLoaded
      : tab === "recommended" && loadingDaily;
  const metaLabel = searching
    ? `${results.length} results for "${query.trim()}"`
    : tab === "playlist"
      ? "songs you've added before"
      : tab === "history"
        ? "every night so far · ahoys minus neins"
        : "fresh picks, new every day";

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", animation: "nFade 300ms ease" }}>
      <div style={{ padding: "20px 16px 12px" }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 30, letterSpacing: "-0.03em" }}>
          Add a song
        </div>
        <div style={{ fontFamily: "var(--font-hand)", fontSize: 19, color: "var(--red)" }}>
          the room will judge you for it
        </div>
        <div style={{ marginTop: 12, position: "relative" }}>
          <input
            className="field"
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Search for a song or artist"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search a song or artist"
            style={{ borderRadius: 999, padding: "14px 52px 14px 16px" }}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="link-btn tap"
              style={{
                position: "absolute",
                right: 4,
                top: "50%",
                transform: "translateY(-50%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-display)",
                fontSize: 22,
                fontWeight: 800,
                color: "var(--brown)",
              }}
            >
              ×
            </button>
          )}
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 9, padding: "2px 0 6px" }}>
          {TABS.map((t) => {
            const on = !searching && tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => {
                  setTab(t.key);
                  setQuery("");
                }}
                className="btn tap"
                aria-pressed={on}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: 999,
                  // Tight enough that three labels each stay on one line at
                  // 375px — "Hall of fame" wrapped and made the row ragged.
                  padding: "9px 6px",
                  fontSize: 13,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  border: `1px solid ${on ? "var(--ink)" : "var(--brown)"}`,
                  background: on ? "var(--ink)" : "var(--paper)",
                  color: on ? "var(--beige)" : "var(--ink)",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pane-scroll" style={{ padding: "0 16px 40px" }}>
        {addError && (
          <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: "var(--red)", padding: "2px 0 10px" }}>
            {addError}
          </div>
        )}
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--brown)", padding: "2px 0 10px" }}>
          {busy ? (searching ? "searching…" : "finding today's picks…") : metaLabel}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {displayResults.map((r, i) => {
            const inQueue = queuedIds.has(r.videoId) || nowPlaying?.video_id === r.videoId;
            return (
              <div
                key={r.videoId}
                className="hover-row"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: 9,
                  border: "1px solid var(--brown)",
                  borderRadius: "var(--radius-md)",
                  background: "var(--paper)",
                  animation: "nRise 320ms cubic-bezier(0,.35,0,1.25) both",
                  animationDelay: `${i * 45}ms`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.thumbUrl || thumb(r.videoId)}
                  alt=""
                  style={{ width: 58, height: 58, borderRadius: "var(--radius-sm)", objectFit: "cover", flex: "none", border: "1px solid var(--brown)" }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.title}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--brown)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.artist} · {mmss(r.durationS)}
                  </div>
                  {tab === "history" && !searching && scoreOf.get(r.videoId) && (
                    <div style={{ marginTop: 2, fontSize: 12, fontWeight: 700, color: "var(--brown)" }}>
                      <span style={{ color: "var(--red)" }}>{scoreOf.get(r.videoId)!.ahoys} ahoy</span>
                      {" · "}
                      {scoreOf.get(r.videoId)!.neins} nein
                      {" · kept "}
                      {scoreOf.get(r.videoId)!.timesKept}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => !inQueue && add(r)}
                  disabled={inQueue}
                  aria-label={inQueue ? "Already in the queue" : "Add to queue"}
                  className="btn"
                  style={{
                    flex: "none",
                    width: 44,
                    height: 44,
                    borderRadius: 999,
                    fontSize: 20,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: inQueue ? "var(--beige)" : "var(--yellow)",
                    color: "var(--ink)",
                  }}
                >
                  {inQueue ? "✓" : "+"}
                </button>
              </div>
            );
          })}
          {!busy && displayResults.length === 0 && (
            <div style={{ padding: "24px 4px", color: "var(--brown)", fontSize: 14 }}>
              {searching
                ? "No results. Try a different search."
                : tab === "playlist"
                  ? "Nothing saved yet — songs you add will show up here next time."
                  : tab === "history"
                    ? "Nothing's been played yet. Give it a night."
                    : "Couldn't reach today's picks. Search for something instead."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
