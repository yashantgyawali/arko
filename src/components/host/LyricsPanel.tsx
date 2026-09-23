"use client";

import { useRoomContext } from "@/lib/room-context";
import { useLyrics } from "@/lib/use-lyrics";

const BEFORE = 2;
const WINDOW = 7;

/**
 * Lyrics on the host's screen — usually the laptop or TV wired to the
 * speakers, which makes it the room's actual karaoke display.
 *
 * Shows a moving window of lines rather than a tall scrolling list: no refs,
 * no scroll-into-view, no first-paint animation racing through ninety lines.
 * The window simply re-slices as the highlight moves.
 */
export function LyricsPanel() {
  const { room, nowPlaying } = useRoomContext();
  const { status, lines, plain, index, nudgeS, setNudgeS } = useLyrics(
    nowPlaying,
    room?.started_at ?? null,
  );

  if (!nowPlaying || status === "loading" || status === "none") return null;

  return (
    <div className="card" style={{ marginTop: 18, padding: "18px 22px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontFamily: "var(--font-hand)", fontSize: 19, color: "var(--red)" }}>
          sing along
        </span>
        {status === "synced" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, color: "var(--brown)" }}>
            <button onClick={() => setNudgeS(nudgeS - 0.5)} className="link-btn" aria-label="Lyrics half a second earlier">−0.5s</button>
            <button onClick={() => setNudgeS(0)} className="link-btn">
              {nudgeS === 0 ? "in sync" : `${nudgeS > 0 ? "+" : ""}${nudgeS}s · reset`}
            </button>
            <button onClick={() => setNudgeS(nudgeS + 0.5)} className="link-btn" aria-label="Lyrics half a second later">+0.5s</button>
          </div>
        )}
      </div>

      {status === "instrumental" && (
        <div style={{ marginTop: 10, fontSize: 15, color: "var(--brown)" }}>No words in this one.</div>
      )}

      {status === "plain" && (
        <>
          <div style={{ marginTop: 4, fontSize: 12, fontWeight: 700, color: "var(--brown)" }}>
            Nobody has timed these yet — here they are anyway.
          </div>
          <div
            style={{
              marginTop: 10,
              maxHeight: 260,
              overflowY: "auto",
              whiteSpace: "pre-line",
              fontSize: 16,
              lineHeight: 1.5,
            }}
          >
            {plain}
          </div>
        </>
      )}

      {status === "synced" && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          {lines
            .slice(Math.max(0, index - BEFORE), Math.max(0, index - BEFORE) + WINDOW)
            .map((line, i) => {
              const isCurrent = Math.max(0, index - BEFORE) + i === index;
              return (
                <div
                  key={`${line.t}-${i}`}
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: isCurrent ? 800 : 600,
                    fontSize: isCurrent ? 26 : 17,
                    lineHeight: 1.25,
                    letterSpacing: isCurrent ? "-0.02em" : undefined,
                    color: isCurrent ? "var(--red)" : "var(--brown)",
                    opacity: isCurrent ? 1 : 0.65,
                    transition: "font-size 160ms ease, color 160ms ease, opacity 160ms ease",
                    textWrap: "pretty",
                    minHeight: isCurrent ? 32 : 21,
                  }}
                >
                  {line.text}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
