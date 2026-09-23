"use client";

import { useState } from "react";
import { useRoomContext } from "@/lib/room-context";
import { useLyrics } from "@/lib/use-lyrics";

const DIM = "rgba(250,241,228,.5)";
const QUIET = "rgba(250,241,228,.55)";

/**
 * Three lines of the song, over the artwork, with the current one lit.
 *
 * Sits inside the now-playing card rather than on a screen of its own, so it
 * has to earn its space: a fixed height that never pushes the vote buttons
 * around, and nothing at all rendered while there's nothing to say.
 */
export function LyricsTicker() {
  const { room, nowPlaying } = useRoomContext();
  const { status, lines, plain, index, nudgeS, setNudgeS } = useLyrics(
    nowPlaying,
    room?.started_at ?? null,
  );
  const [showNudge, setShowNudge] = useState(false);

  if (!nowPlaying || status === "loading") return null;

  if (status === "none" || status === "instrumental") {
    return (
      <div style={{ marginBottom: 10, fontSize: 12, fontWeight: 600, color: QUIET }}>
        {status === "instrumental" ? "No words in this one." : "No lyrics for this one."}
      </div>
    );
  }

  // Untimed words are still singable — they just can't follow along, so the
  // guest scrolls them. Faking timings by spreading lines across the duration
  // looks convincingly wrong, which is worse than plainly not knowing.
  if (status === "plain") {
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".04em", color: QUIET, marginBottom: 3 }}>
          LYRICS · NOT TIMED
        </div>
        <div
          className="pane-scroll"
          style={{
            maxHeight: 62,
            overflowY: "auto",
            fontSize: 13,
            lineHeight: 1.35,
            color: "rgba(250,241,228,.82)",
            whiteSpace: "pre-line",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {plain}
        </div>
      </div>
    );
  }

  const prev = index > 0 ? lines[index - 1]?.text : "";
  const current = index >= 0 ? lines[index]?.text : "";
  const next = lines[index + 1]?.text ?? "";

  // Before the first line, show what's coming rather than an empty box.
  const upcoming = index < 0 ? lines[0]?.text ?? "" : "";

  return (
    <div style={{ marginBottom: 10 }}>
      <div
        onClick={() => setShowNudge((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setShowNudge((v) => !v);
        }}
        aria-label="Lyrics — tap to adjust timing"
        style={{
          height: 74,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 1,
          overflow: "hidden",
          cursor: "pointer",
        }}
      >
        <div style={{ fontSize: 12, lineHeight: 1.25, color: DIM, ...ONE_LINE }}>
          {index < 0 ? "" : prev}
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 800,
            lineHeight: 1.25,
            color: "var(--paper)",
            transition: "opacity 200ms ease",
            ...TWO_LINES,
          }}
        >
          {index < 0 ? upcoming : current}
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.25, color: DIM, ...ONE_LINE }}>
          {index < 0 ? lines[1]?.text ?? "" : next}
        </div>
      </div>

      {showNudge && (
        <div
          style={{
            marginTop: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            fontSize: 11,
            fontWeight: 700,
            color: QUIET,
          }}
        >
          <NudgeButton label="−0.5s" onClick={() => setNudgeS(nudgeS - 0.5)} />
          <button
            onClick={() => setNudgeS(0)}
            className="tap"
            style={{ background: "none", border: "none", color: QUIET, fontSize: 11, fontWeight: 700, padding: 4, cursor: "pointer" }}
          >
            {nudgeS === 0 ? "in sync" : `${nudgeS > 0 ? "+" : ""}${nudgeS}s · reset`}
          </button>
          <NudgeButton label="+0.5s" onClick={() => setNudgeS(nudgeS + 0.5)} />
        </div>
      )}
    </div>
  );
}

// Neighbouring lines are context, so clipping them is fine.
const ONE_LINE = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap" as const,
};

// The line being sung is the whole point, so it wraps rather than truncates.
// Two lines is the cap: the block is anchored to the bottom of the card and
// grows upward, and letting it grow without limit would walk the Nein/Ahoy
// buttons down the screen mid-song.
const TWO_LINES = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical" as const,
  WebkitLineClamp: 2,
  overflow: "hidden",
};

function NudgeButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="tap"
      style={{
        border: "1px solid rgba(250,241,228,.35)",
        background: "rgba(255,255,255,.08)",
        color: "var(--paper)",
        borderRadius: 999,
        padding: "3px 10px",
        fontSize: 11,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
