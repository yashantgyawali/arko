"use client";

import { useRoomContext } from "@/lib/room-context";
import { initial, roomSize, threshold, type SkipRule } from "@/lib/format";
import { bestBy, TITLES } from "@/lib/derive";

const CARD_BG = "var(--paper)";
const CARD_BORDER = "var(--brown)";
const MUTED = "var(--brown)";

export function RoomTab({ onShare }: { onShare: () => void }) {
  const { room, members, myMember } = useRoomContext();
  // The host never votes or gets scored — showing up in this leaderboard
  // would read as the host competing in their own room.
  const ranked = members.filter((m) => !m.is_host).sort((a, b) => b.points - a.points);
  const rule = room?.skip_rule as SkipRule;
  const total = roomSize(members);
  const th = threshold(rule, total);

  if (!room) return null;

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: "var(--beige)", color: "var(--ink)", animation: "nFade 300ms ease" }}>
      <div className="pane-scroll" style={{ padding: "22px 16px 40px" }}>
        <div style={{ fontFamily: "var(--font-hand)", fontSize: 21, color: "var(--red)" }}>you&apos;re in</div>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 32, lineHeight: 1.1, letterSpacing: "-0.03em" }}>
          {room.name}
        </div>

        <button
          onClick={onShare}
          className="link-btn"
          aria-label="Share the invite link"
          style={{
            marginTop: 16,
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "var(--yellow)",
            border: "2px solid var(--ink)",
            borderRadius: "var(--radius-md)",
            padding: "12px 14px",
            width: "100%",
            textAlign: "left",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--ink)" }}>
              Room code
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, letterSpacing: "0.16em", color: "var(--ink)" }}>
              {room.code}
            </div>
          </div>
          <span
            style={{
              border: "2px solid var(--ink)",
              borderRadius: "var(--radius-sm)",
              background: "var(--paper)",
              color: "var(--ink)",
              padding: "10px 16px",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            Invite
          </span>
        </button>

        <div style={{ marginTop: 26, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22 }}>Best taste</div>
        <div style={{ marginTop: 3, fontSize: 13, color: MUTED }}>Points for every song of yours the room keeps.</div>
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {ranked.length === 0 && (
            <div style={{ fontSize: 14, color: MUTED, padding: "4px 2px" }}>Nobody&apos;s queued anything yet.</div>
          )}
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
                  border: `1px solid ${mine ? "var(--ink)" : CARD_BORDER}`,
                  background: mine ? "var(--beige)" : CARD_BG,
                }}
              >
                <div style={{ width: 22, textAlign: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15, color: MUTED, flex: "none" }}>
                  {i + 1}
                </div>
                <div className="avatar" style={{ width: 38, height: 38, fontSize: 15 }}>
                  {initial(m.display_name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{mine ? "You" : m.display_name}</div>
                  <div style={{ fontSize: 12, color: MUTED }}>
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
        <div style={{ fontFamily: "var(--font-hand)", fontSize: 18, color: "var(--red)" }}>
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
                  border: `1px solid ${CARD_BORDER}`,
                  borderRadius: "var(--radius-md)",
                  padding: 14,
                  background: CARD_BG,
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
                  <div style={{ fontSize: 12, color: MUTED, textWrap: "pretty" }}>{t.desc}</div>
                </div>
                <div style={{ fontFamily: "var(--font-hand)", fontSize: 17, color: "var(--red)", flex: "none", textAlign: "right" }}>
                  {leader ? (leader.id === myMember?.id ? "You" : leader.display_name) : "—"}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 28, border: `1px solid ${CARD_BORDER}`, borderRadius: "var(--radius-md)", padding: 16, background: CARD_BG }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18 }}>How it works</div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 22, height: 22, borderRadius: 999, background: "var(--ink)", flex: "none" }} />
              <div style={{ fontSize: 14 }}>
                {rule === "anyone"
                  ? "One Nein skips the song. Brutal room."
                  : rule === "two_thirds"
                    ? `${th} of ${total} Neins skips the song.`
                    : `A majority of Neins skips the song. That is ${th} of ${total} right now.`}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 22, height: 22, borderRadius: 999, background: "var(--red)", flex: "none" }} />
              <div style={{ fontSize: 14 }}>
                {room.ahoy_lock
                  ? `${th} Ahoys locks the song in. No more skipping it.`
                  : "Ahoy is a vote of confidence. It cannot lock a song in."}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 22, height: 22, borderRadius: 999, background: "var(--yellow)", flex: "none" }} />
              <div style={{ fontSize: 14 }}>Queue a song that survives and your taste score goes up.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
