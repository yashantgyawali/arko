"use client";

import { useEffect, useState } from "react";
import { useRoomContext } from "@/lib/room-context";
import { MIN_LOCK_MEMBERS, initial, mmss, roomSize, threshold, thumb, type SkipRule } from "@/lib/format";
import { bestBy, TITLES } from "@/lib/derive";
import { removeFromQueue } from "@/lib/actions";

const CARD_BG = "var(--paper)";
const CARD_BORDER = "var(--brown)";
const MUTED = "var(--brown)";

export function RoomTab({ onShare, onLeave }: { onShare: () => void; onLeave: () => void }) {
  const { room, members, myMember, queued } = useRoomContext();
  // `queued` is already in play order, so an item's index is its real place in
  // the line — not just its position among this person's own songs.
  const mine = queued
    .map((q, i) => ({ q, place: i + 1 }))
    .filter(({ q }) => myMember && q.added_by === myMember.id);
  const [removing, setRemoving] = useState<string | null>(null);
  // The host never votes or gets scored — showing up in this leaderboard
  // would read as the host competing in their own room.
  const ranked = members.filter((m) => !m.is_host).sort((a, b) => b.points - a.points);
  // Two taps to leave: it deletes your member row, so your score goes with it
  // and a mis-tap would be genuinely annoying to undo.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);

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

        <div style={{ marginTop: 26, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22 }}>Your songs</span>
          <span style={{ fontSize: 13, color: MUTED }}>
            {mine.length === 0 ? "" : `${mine.length} waiting`}
          </span>
        </div>
        <div style={{ marginTop: 3, fontSize: 13, color: MUTED }}>
          Still to play. Take one back out if you change your mind.
        </div>
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {mine.length === 0 && (
            <div style={{ fontSize: 14, color: MUTED, padding: "4px 2px" }}>
              Nothing of yours in the queue. Go add something.
            </div>
          )}
          {mine.map(({ q, place }) => (
            <div
              key={q.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: 9,
                border: `1px solid ${CARD_BORDER}`,
                borderRadius: "var(--radius-md)",
                background: CARD_BG,
                opacity: removing === q.id ? 0.45 : 1,
              }}
            >
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15, color: MUTED, minWidth: 18, textAlign: "right" }}>
                {place}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={q.thumb_url || thumb(q.video_id)}
                alt=""
                style={{ width: 46, height: 46, borderRadius: "var(--radius-sm)", objectFit: "cover", flex: "none", border: `1px solid ${CARD_BORDER}` }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {q.title}
                </div>
                <div style={{ fontSize: 12, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {q.artist} · {mmss(q.duration_s)}
                </div>
              </div>
              <button
                onClick={() => {
                  if (removing) return;
                  setRemoving(q.id);
                  // No optimistic removal: realtime deletes the row for
                  // everyone a moment later, and dropping it here first would
                  // make a failure look like a success.
                  removeFromQueue(room.id, q.id)
                    .catch(console.error)
                    .finally(() => setRemoving(null));
                }}
                disabled={removing === q.id}
                aria-label={`Take ${q.title} out of the queue`}
                title="Take out of the queue"
                className="icon-remove"
                style={{ width: 34, height: 34, fontSize: 16, lineHeight: 1, flex: "none" }}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 28, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22 }}>Best taste</div>
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
                {!room.ahoy_lock
                  ? "Ahoy is a vote of confidence. It cannot lock a song in."
                  : total < MIN_LOCK_MEMBERS
                    ? `Ahoy is a vote of confidence. It takes ${MIN_LOCK_MEMBERS} in the room before it can lock a song in.`
                    : `${th} Ahoys locks the song in. No more skipping it.`}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 22, height: 22, borderRadius: 999, background: "var(--yellow)", flex: "none" }} />
              <div style={{ fontSize: 14 }}>Queue a song that survives and your taste score goes up.</div>
            </div>
          </div>
        </div>

        {/* The host owns the room and is the machine playing the music —
            there's no coherent "leave" for them, so don't offer it. */}
        {!myMember?.is_host && (
        <>
        <button
          onClick={() => (armed ? onLeave() : setArmed(true))}
          className="tap"
          style={{
            marginTop: 28,
            width: "100%",
            padding: "14px 16px",
            borderRadius: "var(--radius-md)",
            border: `1px solid ${armed ? "var(--red)" : CARD_BORDER}`,
            background: armed ? "var(--red)" : "transparent",
            color: armed ? "var(--paper)" : "var(--brown)",
            fontWeight: 700,
            fontSize: 15,
            cursor: "pointer",
          }}
        >
          {armed ? "Tap again to leave" : "Exit room"}
        </button>
        <div style={{ marginTop: 8, textAlign: "center", fontSize: 12, color: MUTED }}>
          Songs you queued stay. Your score doesn&apos;t.
        </div>
        </>
        )}
      </div>
    </div>
  );
}
