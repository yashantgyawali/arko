"use client";

import { useRoomContext } from "@/lib/room-context";
import { castVote } from "@/lib/actions";
import { voteCounts } from "@/lib/derive";
import { mmss, roomSize, threshold, thumb, thumbHi, type SkipRule } from "@/lib/format";
import { VoteMeter } from "@/components/VoteMeter";

export function NowPlaying() {
  const { room, members, votes, myMember, nowPlaying, elapsedS } = useRoomContext();

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

  const host = members.find((m) => m.is_host);
  const { nein, ahoy } = voteCounts(votes);
  const total = roomSize(members);
  const rule = room.skip_rule as SkipRule;
  const th = threshold(rule, total);
  const locked = nowPlaying.locked;
  const myVote = votes.find((v) => v.member_id === myMember?.id)?.value;
  const progressPct = Math.min(100, (elapsedS / nowPlaying.duration_s) * 100);

  const tallyHeadline = locked
    ? "the room kept this one"
    : nein >= th
      ? "the room said Nein"
      : `${th - nein} more Nein${th - nein === 1 ? "" : "s"} and it is gone`;

  const vote = (value: "nein" | "ahoy") => {
    if (!myMember) return;
    castVote(room.id, nowPlaying.id, value).catch(console.error);
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", animation: "nFade 300ms ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "20px 16px 8px" }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: "var(--radius-sm)",
            background: "var(--red)",
            border: "2px solid var(--ink)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 17,
            color: "var(--paper)",
            flex: "none",
          }}
        >
          a
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {room.name}
          </div>
          <div style={{ fontSize: 12, color: "var(--brown)" }}>
            {total} in the room · {host?.display_name ?? "someone"} is host
          </div>
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
          <img src="/icons/spark.svg" alt="" style={{ width: 16, height: 16 }} />
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 14 }}>
            {myMember?.points ?? 0}
          </span>
        </div>
      </div>

      <div className="pane-scroll" style={{ padding: "8px 16px 10px" }}>
        <div
          style={{
            position: "relative",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            background: "var(--ink)",
            border: "1px solid var(--ink)",
            // hold the frame even if the image never loads — the progress bar
            // and "playing on…" capsule are absolutely positioned inside it
            aspectRatio: "16/9",
            animation: "nBreathe 5200ms ease-in-out infinite",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbHi(nowPlaying.video_id)}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            onError={(e) => {
              // maxres doesn't exist for every video; mqdefault always does
              const fallback = nowPlaying.thumb_url ?? thumb(nowPlaying.video_id);
              if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              padding: "34px 12px 10px",
              background: "linear-gradient(to top, rgba(19,13,1,.85), rgba(19,13,1,0))",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, color: "var(--beige)", marginBottom: 5 }}>
              <span>{mmss(Math.min(elapsedS, nowPlaying.duration_s))}</span>
              <span>{mmss(nowPlaying.duration_s)}</span>
            </div>
            <div style={{ height: 4, borderRadius: 999, background: "rgba(250,241,228,.35)", overflow: "hidden" }}>
              <div style={{ height: "100%", background: "var(--red)", transition: "width 900ms linear", width: `${progressPct}%` }} />
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              left: 8,
              top: 8,
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--ink)",
              borderRadius: 999,
              padding: "6px 13px 6px 11px",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 18 }}>
              <span style={{ width: 3, background: "var(--yellow)", borderRadius: 2, height: 10, animation: "nEq 640ms ease-in-out infinite" }} />
              <span style={{ width: 3, background: "var(--red)", borderRadius: 2, height: 17, animation: "nEq 640ms ease-in-out infinite", animationDelay: "150ms" }} />
              <span style={{ width: 3, background: "var(--yellow)", borderRadius: 2, height: 7, animation: "nEq 640ms ease-in-out infinite", animationDelay: "300ms" }} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 12, color: "var(--beige)" }}>
              playing on {host?.display_name ?? "the host"}&apos;s laptop
            </span>
          </div>
        </div>

        <div style={{ marginTop: 16, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 26, lineHeight: 1.12, letterSpacing: "-0.03em", textWrap: "pretty" }}>
              {nowPlaying.title}
            </div>
            <div style={{ marginTop: 5, fontSize: 16, color: "var(--brown)" }}>{nowPlaying.artist}</div>
          </div>
          <span className="arko-tag" style={{ flex: "none", marginTop: 4, border: "2px solid var(--ink)", whiteSpace: "nowrap" }}>
            added by {members.find((m) => m.id === nowPlaying.added_by)?.display_name ?? "someone"}
          </span>
        </div>

        <div style={{ marginTop: 18, borderTop: "1px dashed #C2B08B", paddingTop: 16 }}>
          <div style={{ fontFamily: "var(--font-hand)", fontSize: 23, color: "var(--red)" }}>{tallyHeadline}</div>
          <div style={{ marginTop: 8 }}>
            <VoteMeter neinPct={(nein / total) * 100} ahoyPct={(ahoy / total) * 100} thresholdPct={(th / total) * 100} />
          </div>
          <div style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: "var(--brown)" }}>
            {nein} Nein · {ahoy} Ahoy · {total - nein - ahoy} quiet
          </div>
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {members.map((m) => {
              const v = votes.find((x) => x.member_id === m.id)?.value;
              const dot = v === "nein" ? "var(--ink)" : v === "ahoy" ? "var(--red)" : "#D9CFBC";
              const label = v === "nein" ? "Nein" : v === "ahoy" ? "Ahoy" : "quiet";
              return (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    borderRadius: 999,
                    padding: "5px 12px",
                    border: "1px solid var(--brown)",
                    animation: "nPop 300ms cubic-bezier(0,.35,0,1.25) both",
                    background: "var(--paper)",
                  }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: 999, flex: "none", background: dot }} />
                  <span style={{ fontWeight: 600, fontSize: 12, color: "var(--ink)" }}>
                    {m.id === myMember?.id ? "You" : m.display_name} · {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="vote-dock">
        {locked ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              background: "var(--red)",
              borderRadius: "var(--radius-md)",
              padding: "0 18px",
              height: 62,
            }}
          >
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: "var(--paper)" }}>Ahoy</span>
            <span style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)" }}>locked in, this one plays out</span>
          </div>
        ) : (
          <div style={{ display: "flex", border: "1px solid var(--ink)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
            <button
              onClick={() => vote("nein")}
              className="vote-btn vote-btn-nein"
              aria-pressed={myVote === "nein"}
              style={myVote === "nein" ? { boxShadow: "inset 0 0 0 3px var(--yellow)" } : undefined}
            >
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, letterSpacing: "-0.03em" }}>Nein</span>
              <span style={{ fontWeight: 700, fontSize: 12, color: "var(--yellow)" }}>
                {myVote === "nein" ? "your vote" : "skip it"}
              </span>
            </button>
            <button
              onClick={() => vote("ahoy")}
              className="vote-btn vote-btn-ahoy"
              aria-pressed={myVote === "ahoy"}
              style={myVote === "ahoy" ? { boxShadow: "inset 0 0 0 3px var(--ink)" } : undefined}
            >
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, letterSpacing: "-0.03em" }}>Ahoy</span>
              <span style={{ fontWeight: 700, fontSize: 12, color: "var(--ink)" }}>
                {myVote === "ahoy" ? "your vote" : "keep it"}
              </span>
            </button>
          </div>
        )}
        {myVote && (
          <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: "var(--brown)", marginTop: 8 }}>
            Tap the other one to change your mind.
          </div>
        )}
      </div>
    </div>
  );
}
