"use client";

import { useRef, useState } from "react";
import { useRoomContext } from "@/lib/room-context";
import { castVote } from "@/lib/actions";
import { voteCounts } from "@/lib/derive";
import { mmss, roomSize, threshold, thumb, thumbHi, type SkipRule } from "@/lib/format";
import { VoteMeter } from "@/components/VoteMeter";

// Past this many px of horizontal drag, releasing casts the vote instead of
// snapping back — same feel as a dating-app card, tuned for a thumb not a mouse.
const SWIPE_THRESHOLD = 100;

export function NowPlaying() {
  const { room, members, votes, myMember, nowPlaying, elapsedS } = useRoomContext();
  const [dragX, setDragX] = useState(0);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);

  if (!room) return null;

  if (!nowPlaying) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40, textAlign: "center" }}>
        <div>
          <div style={{ fontFamily: "var(--font-hand)", fontSize: 22, color: "var(--red)" }}>quiet for now</div>
          <div style={{ marginTop: 6, fontSize: 15, color: "var(--brown)" }}>
            Nothing&apos;s queued. Go add something the room will love.
          </div>
        </div>
      </div>
    );
  }

  const { nein, ahoy } = voteCounts(votes);
  const total = roomSize(members);
  const rule = room.skip_rule as SkipRule;
  const th = threshold(rule, total);
  const locked = nowPlaying.locked;
  // Voting only opens once the host's player has actually reached PLAYING —
  // otherwise a couple of quick taps could vote a song out before the room
  // ever heard it, which is indistinguishable from it never having played.
  const started = !!nowPlaying.audio_started_at;
  const myVote = votes.find((v) => v.member_id === myMember?.id)?.value;
  const progressPct = Math.min(100, (elapsedS / nowPlaying.duration_s) * 100);
  const canDrag = !locked && started && !!myMember;

  const vote = (value: "nein" | "ahoy") => {
    if (!myMember || !started) return;
    castVote(room.id, nowPlaying.id, value).catch(console.error);
  };

  const endDrag = (finalX: number) => {
    draggingRef.current = false;
    if (finalX <= -SWIPE_THRESHOLD) vote("nein");
    else if (finalX >= SWIPE_THRESHOLD) vote("ahoy");
    setDragX(0);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canDrag) return;
    draggingRef.current = true;
    startXRef.current = e.clientX;
    // Capture can reject (e.g. the pointer already lifted) — that just means
    // pointermove/up may not reach us reliably, not that the drag can't start.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    setDragX(e.clientX - startXRef.current);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    endDrag(e.clientX - startXRef.current);
  };

  const rotate = dragX / 20;
  const neinTagOpacity = Math.max(0, Math.min(1, -dragX / SWIPE_THRESHOLD));
  const ahoyTagOpacity = Math.max(0, Math.min(1, dragX / SWIPE_THRESHOLD));

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", animation: "nFade 300ms ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 16px 4px" }}>
        <div style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {room.name}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "var(--yellow)",
            border: "2px solid var(--ink)",
            borderRadius: 999,
            padding: "5px 12px 5px 9px",
            flex: "none",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/spark.svg" alt="" style={{ width: 14, height: 14 }} />
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 13 }}>
            {myMember?.points ?? 0}
          </span>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "10px 16px 4px" }}>
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            position: "relative",
            flex: 1,
            minHeight: 0,
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
            background: "var(--ink)",
            touchAction: "pan-y",
            cursor: canDrag ? "grab" : "default",
            transform: `translateX(${dragX}px) rotate(${rotate}deg)`,
            transition: draggingRef.current ? "none" : "transform 320ms cubic-bezier(0,.35,0,1.25)",
            userSelect: "none",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbHi(nowPlaying.video_id)}
            alt=""
            draggable={false}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => {
              const fallback = nowPlaying.thumb_url ?? thumb(nowPlaying.video_id);
              if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(to top, rgba(19,13,1,.92), rgba(19,13,1,.2) 42%, rgba(19,13,1,0) 68%)",
            }}
          />

          <div
            style={{
              position: "absolute",
              top: 26,
              left: 22,
              transform: "rotate(-14deg)",
              opacity: neinTagOpacity,
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 32,
              letterSpacing: "-0.02em",
              color: "var(--yellow)",
              border: "4px solid var(--yellow)",
              borderRadius: 10,
              padding: "2px 14px",
            }}
          >
            Nein
          </div>
          <div
            style={{
              position: "absolute",
              top: 26,
              right: 22,
              transform: "rotate(14deg)",
              opacity: ahoyTagOpacity,
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 32,
              letterSpacing: "-0.02em",
              color: "var(--red)",
              border: "4px solid var(--red)",
              borderRadius: 10,
              padding: "2px 14px",
            }}
          >
            Ahoy
          </div>

          {!started && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                background: "rgba(19,13,1,.55)",
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  border: "3px solid var(--yellow)",
                  borderTopColor: "var(--red)",
                  animation: "nSpin 900ms linear infinite",
                }}
              />
              <span style={{ color: "var(--beige)", fontWeight: 700, fontSize: 14 }}>starting…</span>
            </div>
          )}

          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "18px 18px 16px" }}>
            {locked && (
              <span
                style={{
                  display: "inline-block",
                  marginBottom: 10,
                  borderRadius: 999,
                  background: "var(--red)",
                  color: "var(--paper)",
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "4px 12px",
                }}
              >
                locked in
              </span>
            )}
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: 25,
                lineHeight: 1.15,
                color: "var(--paper)",
                textWrap: "pretty",
              }}
            >
              {nowPlaying.title}
            </div>
            <div style={{ marginTop: 4, fontSize: 14, color: "rgba(250,241,228,.78)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {nowPlaying.artist} · added by {members.find((m) => m.id === nowPlaying.added_by)?.display_name ?? "someone"}
            </div>
            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: "rgba(250,241,228,.65)", marginBottom: 4 }}>
              <span>{mmss(Math.min(elapsedS, nowPlaying.duration_s))}</span>
              <span>{mmss(nowPlaying.duration_s)}</span>
            </div>
            <div style={{ height: 4, borderRadius: 999, background: "rgba(250,241,228,.25)", overflow: "hidden" }}>
              <div style={{ height: "100%", background: "var(--red)", transition: "width 900ms linear", width: `${progressPct}%` }} />
            </div>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <VoteMeter neinPct={(nein / total) * 100} ahoyPct={(ahoy / total) * 100} thresholdPct={(th / total) * 100} compact />
        </div>
      </div>

      <div className="vote-dock" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        {locked ? (
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--brown)", padding: "10px 0" }}>
            The room locked this one in.
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
            <button
              onClick={() => vote("nein")}
              disabled={!started}
              aria-pressed={myVote === "nein"}
              aria-label="Nein — skip this song"
              className="tap"
              style={{
                width: 58,
                height: 58,
                borderRadius: 999,
                border: "2px solid var(--ink)",
                background: myVote === "nein" ? "var(--ink)" : "var(--paper)",
                color: myVote === "nein" ? "var(--beige)" : "var(--ink)",
                fontSize: 22,
                fontWeight: 800,
                opacity: started ? 1 : 0.45,
                cursor: started ? "pointer" : "default",
              }}
            >
              ✕
            </button>
            <button
              onClick={() => vote("ahoy")}
              disabled={!started}
              aria-pressed={myVote === "ahoy"}
              aria-label="Ahoy — keep this song"
              className="tap"
              style={{
                width: 58,
                height: 58,
                borderRadius: 999,
                border: "2px solid var(--ink)",
                background: myVote === "ahoy" ? "var(--red)" : "var(--paper)",
                color: myVote === "ahoy" ? "var(--paper)" : "var(--red)",
                fontSize: 22,
                fontWeight: 800,
                opacity: started ? 1 : 0.45,
                cursor: started ? "pointer" : "default",
              }}
            >
              ♥
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
