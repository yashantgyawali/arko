"use client";

import { useRoomContext } from "@/lib/room-context";
import { initial, threshold, type SkipRule } from "@/lib/format";

export function Lobby({ onShare }: { onShare: () => void }) {
  const { room, members, myMember } = useRoomContext();
  if (!room) return null;

  const rule = room.skip_rule as SkipRule;
  const th = threshold(rule, members.length);
  const host = members.find((m) => m.is_host);

  return (
    <div className="pane-scroll" style={{ padding: "24px 20px 44px", animation: "nFade 300ms ease" }}>
      <div style={{ fontFamily: "var(--font-hand)", fontSize: 22, color: "var(--red)" }}>you&apos;re in</div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 36, lineHeight: 1.1, letterSpacing: "-0.03em" }}>
        {room.name}
      </div>

      <button
        onClick={onShare}
        className="link-btn"
        aria-label="Share the invite link"
        style={{
          marginTop: 18,
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "var(--yellow)",
          border: "2px solid var(--ink)",
          borderRadius: "var(--radius-md)",
          padding: "14px 16px",
          boxShadow: "6px 6px 0 0 var(--ink)",
          width: "100%",
          textAlign: "left",
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em" }}>
            Room code
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 28, letterSpacing: "0.16em" }}>
            {room.code}
          </div>
        </div>
        <span
          style={{
            border: "2px solid var(--ink)",
            borderRadius: "var(--radius-sm)",
            background: "var(--paper)",
            padding: "11px 16px",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          Invite
        </span>
      </button>

      <div style={{ marginTop: 22, fontWeight: 700, fontSize: 15 }}>In the room</div>
      <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 12 }}>
        {members.map((m, i) => (
          <div
            key={m.id}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              width: 62,
              animation: "nPop 300ms cubic-bezier(0,.35,0,1.25) both",
              animationDelay: `${i * 70}ms`,
            }}
          >
            <div className="avatar" style={{ width: 50, height: 50, fontSize: 19 }}>
              {initial(m.display_name)}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, maxWidth: 62, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {m.id === myMember?.id ? "You" : m.display_name}
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 26 }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20 }}>How it works</div>
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 26, height: 26, borderRadius: 999, background: "var(--ink)", flex: "none" }} />
            <div style={{ fontSize: 15 }}>
              {rule === "anyone"
                ? "One Nein skips the song. Brutal room."
                : rule === "two_thirds"
                  ? `${th} of ${members.length} Neins skips the song.`
                  : `A majority of Neins skips the song. That is ${th} of ${members.length} right now.`}
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 26, height: 26, borderRadius: 999, background: "var(--red)", flex: "none" }} />
            <div style={{ fontSize: 15 }}>
              {room.ahoy_lock
                ? `${th} Ahoys locks the song in. No more skipping it.`
                : "Ahoy is a vote of confidence. It cannot lock a song in."}
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 26, height: 26, borderRadius: 999, background: "var(--yellow)", flex: "none" }} />
            <div style={{ fontSize: 15 }}>Queue a song that survives and your taste score goes up.</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 26, display: "flex", alignItems: "center", justifyContent: "center", gap: 11 }}>
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: 999,
            border: "3px solid var(--yellow)",
            borderTopColor: "var(--red)",
            animation: "nSpin 900ms linear infinite",
          }}
        />
        <div style={{ fontFamily: "var(--font-hand)", fontSize: 19, color: "var(--brown)" }}>
          {host ? `${host.display_name} is picking the first song` : "waiting for the first song"}
        </div>
      </div>
    </div>
  );
}
