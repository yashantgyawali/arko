"use client";

import { useEffect, useState } from "react";
import { useRoomContext } from "@/lib/room-context";
import { addToQueue } from "@/lib/actions";
import { mmss, thumb } from "@/lib/format";
import { getSavedPlaylist, saveTrackToPlaylist } from "@/lib/saved-playlist";
import type { Track } from "@/lib/catalog";

const GUIDES = ["party starters", "80s", "sing along", "risky", "nepali", "nepali classics"];

export function AddSong({ onAdded }: { onAdded: (track: Track) => void }) {
  const { room, queue, nowPlaying } = useRoomContext();
  const [query, setQuery] = useState("");
  const [guide, setGuide] = useState<string | null>(null);
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Songs this browser has queued before, kept locally — lets a returning
  // host (or guest) skip re-searching their usual picks for a brand new room.
  const [saved, setSaved] = useState<Track[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  useEffect(() => {
    setSaved(getSavedPlaylist());
  }, []);

  useEffect(() => {
    if (!addError) return;
    const t = setTimeout(() => setAddError(null), 4000);
    return () => clearTimeout(t);
  }, [addError]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (guide) params.set("guide", guide);

    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/search?${params.toString()}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((data) => setResults(data.results ?? []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, query.trim() ? 400 : 0);

    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query, guide]);

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

  const displayResults = showSaved ? saved : results;
  const metaLabel = showSaved
    ? "songs you've added before"
    : query.trim()
      ? `${results.length} results for "${query.trim()}"`
      : guide
        ? guide
        : "popular in this room tonight";

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
            onChange={(e) => {
              setQuery(e.target.value);
              setGuide(null);
              setShowSaved(false);
            }}
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
        <div style={{ marginTop: 12, display: "flex", gap: 9, overflow: "auto", padding: "2px 0 6px" }}>
          {saved.length > 0 && (
            <button
              onClick={() => {
                setShowSaved((on) => !on);
                setQuery("");
                setGuide(null);
              }}
              className="btn"
              aria-pressed={showSaved}
              style={{
                flex: "none",
                minHeight: 44,
                borderRadius: 999,
                padding: "9px 18px",
                fontSize: 14,
                fontWeight: 600,
                border: "1px solid var(--red)",
                background: showSaved ? "var(--red)" : "var(--paper)",
                color: showSaved ? "var(--paper)" : "var(--red)",
              }}
            >
              ★ my playlist
            </button>
          )}
          {GUIDES.map((g) => {
            const on = guide === g;
            return (
              <button
                key={g}
                onClick={() => {
                  setGuide(on ? null : g);
                  setQuery("");
                  setShowSaved(false);
                }}
                className="btn"
                aria-pressed={on}
                style={{
                  flex: "none",
                  minHeight: 44,
                  borderRadius: 999,
                  padding: "9px 18px",
                  fontSize: 14,
                  fontWeight: 600,
                  border: "1px solid var(--brown)",
                  background: on ? "var(--ink)" : "var(--paper)",
                  color: on ? "var(--beige)" : "var(--ink)",
                }}
              >
                {g}
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
          {loading && !showSaved ? "searching…" : metaLabel}
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
          {!loading && displayResults.length === 0 && (
            <div style={{ padding: "24px 4px", color: "var(--brown)", fontSize: 14 }}>
              {showSaved ? "Nothing saved yet — songs you add will show up here next time." : "No results. Try a different search."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
