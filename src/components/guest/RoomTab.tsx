"use client";

import { useRoomContext } from "@/lib/room-context";
import { initial } from "@/lib/format";
import { bestBy, TITLES } from "@/lib/derive";

export function RoomTab({ onShare }: { onShare: () => void }) {
  const { room, members, myMember } = useRoomContext();
  const ranked = [...members].sort((a, b) => b.points - a.points);

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", animation: "nFade 300ms ease" }}>
      <div style={{ padding: "20px 16px 6px" }}>
        <div style={{ fontFamily: "var(--font-hand)", fontSize: 21, color: "var(--red)" }}>who&apos;s cooking tonight</div>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 30, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
          Best taste
        </div>
        <div style={{ marginTop: 5, fontSize: 14, color: "var(--brown)" }}>
          Points for every song of yours the room keeps.
        </div>
      </div>

      <div className="pane-scroll" style={{ padding: "10px 16px 40px" }}>
        {/* The code lives here too — the lobby is a one-time screen, and
            someone always walks in late needing it. */}
        {room && (
          <div
            style={{
              marginBottom: 18,
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "var(--yellow)",
              border: "2px solid var(--ink)",
              borderRadius: "var(--radius-md)",
              padding: "12px 14px",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                Room code
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, letterSpacing: "0.16em" }}>
                {room.code}
              </div>
            </div>
            <button
              onClick={onShare}
              className="btn tap"
              style={{ background: "var(--paper)", color: "var(--ink)", padding: "10px 16px", fontSize: 14 }}
            >
              Invite
            </button>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {ranked.map((m, i) => {
            const mine = m.id === myMember?.id;
            return (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: "var(--radius-md)",
                  border: `1px solid ${mine ? "var(--ink)" : "var(--brown)"}`,
                  background: mine ? "var(--beige)" : "var(--paper)",
                }}
              >
                <div style={{ width: 22, textAlign: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15, color: "var(--brown)", flex: "none" }}>
                  {i + 1}
                </div>
                <div className="avatar" style={{ width: 38, height: 38, fontSize: 15 }}>
                  {initial(m.display_name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{mine ? "You" : m.display_name}</div>
                  <div style={{ fontSize: 12, color: "var(--brown)" }}>
                    {m.songs_kept} song{m.songs_kept === 1 ? "" : "s"} kept
                  </div>
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 19, flex: "none" }}>
                  {m.points}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 28, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 21 }}>
          Titles up for grabs
        </div>
        <div style={{ fontFamily: "var(--font-hand)", fontSize: 18, color: "var(--brown)" }}>
          handed out when the night ends
        </div>
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          {TITLES.map((t) => {
            const leader = bestBy(members, t.key);
            return (
              <div
                key={t.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 13,
                  border: "2px solid var(--brown)",
                  borderRadius: "var(--radius-md)",
                  padding: 14,
                  background: "var(--paper)",
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "var(--radius-sm)",
                    border: "2px solid var(--ink)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-display)",
                    fontWeight: 800,
                    fontSize: 15,
                    flex: "none",
                    background: "var(--beige)",
                  }}
                >
                  {t.name === "Crowd pleaser" ? "★" : t.name === "Room villain" ? "!" : t.name === "Nein machine" ? "×" : "+"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: "var(--brown)", textWrap: "pretty" }}>{t.desc}</div>
                </div>
                <div style={{ fontFamily: "var(--font-hand)", fontSize: 17, color: "var(--red)", flex: "none", textAlign: "right" }}>
                  {leader ? (leader.id === myMember?.id ? "You" : leader.display_name) : "—"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
