"use client";

import { useMemo, useRef, useState } from "react";
import { useRoomContext } from "@/lib/room-context";
import { mmss, thumb } from "@/lib/format";
import { removeFromQueue, reorderMyQueue } from "@/lib/actions";

const CARD_BG = "var(--paper)";
const CARD_BORDER = "var(--brown)";
const MUTED = "var(--brown)";
const GAP = 8;

type Drag = { id: string; from: number; to: number; dy: number; step: number };

/**
 * The songs you have waiting, in the order they'll play, draggable.
 *
 * A drag only ever reshuffles your own songs, which is what keeps it fair:
 * the queue rotates between queuers, so you are moving your songs between
 * slots you already hold and nobody else shifts by a place.
 */
export function YourSongs() {
  const { room, myMember, queued } = useRoomContext();

  // `queued` is already in play order, so an item's index there is its real
  // place in the line — not just its place among this person's own songs.
  const mine = useMemo(
    () =>
      queued
        .map((q, i) => ({ q, place: i + 1 }))
        .filter(({ q }) => myMember && q.added_by === myMember.id),
    [queued, myMember],
  );

  const [removing, setRemoving] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  // The order we last sent. Dragging has to move the row under your finger
  // straight away, so this is the one write in the app we show before it
  // lands — everything else waits for realtime to confirm it.
  const [sent, setSent] = useState<string[] | null>(null);
  const startY = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  // Every write from this list goes through one chain. A ref, not state,
  // because pointerup and pointercancel can both land in the same batch and
  // both would still see state from before the first one — two writes built
  // on different snapshots, landing the song a move away from where you
  // dropped it. It also keeps a removal from overtaking a reorder that is
  // still in flight and invalidating it.
  const chain = useRef<Promise<void>>(Promise.resolve());
  const latestSent = useRef<string[] | null>(null);

  const locked = removing !== null;

  const rows = useMemo(() => {
    if (!sent) return mine;
    const rank = new Map(sent.map((id, i) => [id, i]));
    // Only while it still describes this list. The moment the set changes —
    // a song of yours starts playing, or you take one out — the order we sent
    // is about a queue that no longer exists and the server's is the only one
    // that fits. (A reorder from your other device is ignored until then.)
    if (mine.length !== sent.length || mine.some(({ q }) => !rank.has(q.id))) return mine;
    const songs = [...mine].sort((a, b) => rank.get(a.q.id)! - rank.get(b.q.id)!);
    // Places belong to the slots, not to the songs: reordering swaps the
    // numbers between your songs, it doesn't renumber the room.
    return songs.map((s, i) => ({ q: s.q, place: mine[i].place }));
  }, [mine, sent]);

  const commit = (order: string[]) => {
    if (!room) return;
    // Nothing is disabled while this is in flight: a disabled button loses
    // focus, which would cost a keyboard user their place in the list after
    // every single move.
    setSent(order);
    latestSent.current = order;
    chain.current = chain.current.then(() =>
      reorderMyQueue(room.id, order).catch((err) => {
        console.error(err);
        // Drop back to whatever the server actually has rather than leave a
        // reorder on screen that never happened. Only if nothing newer has
        // been sent since, or we'd undo a move that did land.
        if (latestSent.current === order) setSent(null);
      }),
    );
  };

  const moveTo = (from: number, to: number) => {
    if (to < 0 || to >= rows.length || to === from) return;
    const order = rows.map(({ q }) => q.id);
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved);
    commit(order);
  };

  const beginDrag = (e: React.PointerEvent<HTMLButtonElement>, id: string, from: number) => {
    if (locked || rows.length < 2) return;
    // One row's height plus the gap, measured rather than assumed — the rows
    // grow with the text inside them.
    const kids = listRef.current?.children;
    if (!kids || kids.length < 2) return;
    const step = kids[1].getBoundingClientRect().top - kids[0].getBoundingClientRect().top;
    if (step <= 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startY.current = e.clientY;
    setDrag({ id, from, to: from, dy: 0, step });
  };

  const moveDrag = (e: React.PointerEvent) => {
    if (!drag) return;
    const dy = e.clientY - startY.current;
    const to = Math.min(rows.length - 1, Math.max(0, drag.from + Math.round(dy / drag.step)));
    if (dy === drag.dy && to === drag.to) return;
    setDrag({ ...drag, dy, to });
  };

  const endDrag = () => {
    if (!drag) return;
    const { from, to } = drag;
    setDrag(null);
    moveTo(from, to);
  };

  // Dragging is mouse and finger only, so the handle doubles as a pair of
  // arrow keys for anyone using a keyboard or a screen reader.
  const onKey = (e: React.KeyboardEvent<HTMLButtonElement>, i: number) => {
    const dir = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (!dir || locked) return;
    e.preventDefault();
    const handle = e.currentTarget;
    moveTo(i, i + dir);
    // Reordering moves this button in the DOM, and moving the focused element
    // blurs it — so without this the second arrow press lands on the page
    // instead of the song, and the list only ever moves one place.
    requestAnimationFrame(() => handle.focus());
  };

  return (
    <>
      <div style={{ marginTop: 26, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22 }}>Your songs</span>
        <span style={{ fontSize: 13, color: MUTED }}>{rows.length === 0 ? "" : `${rows.length} waiting`}</span>
      </div>
      <div style={{ marginTop: 3, fontSize: 13, color: MUTED }}>
        Still to play. Drag to put them in the order you want, or take one back out.
      </div>

      <div
        ref={listRef}
        style={{
          marginTop: 12,
          display: "flex",
          flexDirection: "column",
          gap: GAP,
          userSelect: drag ? "none" : "auto",
        }}
      >
        {rows.map(({ q, place }, i) => {
          const held = drag?.id === q.id;
          // Every row between the held row's old slot and the one it's headed
          // for slides a slot the other way, so the gap under your finger is
          // always the slot you would drop into.
          let shift = 0;
          if (drag && !held) {
            if (drag.from < drag.to && i > drag.from && i <= drag.to) shift = -drag.step;
            else if (drag.to < drag.from && i >= drag.to && i < drag.from) shift = drag.step;
          }
          return (
            <div
              key={q.id}
              style={{
                position: "relative",
                zIndex: held ? 2 : 1,
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: 9,
                border: `1px solid ${held ? "var(--ink)" : CARD_BORDER}`,
                borderRadius: "var(--radius-md)",
                background: CARD_BG,
                opacity: removing === q.id ? 0.45 : 1,
                transform: `translateY(${held ? drag!.dy : shift}px)`,
                // The held row has to track the finger exactly; the ones it
                // pushes past look better easing into place.
                transition: held ? "none" : "transform 160ms ease",
                boxShadow: held ? "0 10px 22px rgba(19,13,1,.22)" : "none",
              }}
            >
              <button
                onPointerDown={(e) => beginDrag(e, q.id, i)}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onKeyDown={(e) => onKey(e, i)}
                disabled={locked || rows.length < 2}
                aria-label={`Reorder ${q.title} — drag it, or use the up and down arrow keys`}
                title="Drag to reorder"
                className="grip"
              >
                <svg width="11" height="16" viewBox="0 0 11 16" fill="currentColor" aria-hidden="true">
                  <circle cx="3" cy="5.5" r="1.6" />
                  <circle cx="8" cy="5.5" r="1.6" />
                  <circle cx="3" cy="10.5" r="1.6" />
                  <circle cx="8" cy="10.5" r="1.6" />
                </svg>
              </button>
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  fontSize: 15,
                  color: MUTED,
                  minWidth: 15,
                  textAlign: "right",
                  flex: "none",
                }}
              >
                {place}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={q.thumb_url || thumb(q.video_id)}
                alt=""
                draggable={false}
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: "var(--radius-sm)",
                  objectFit: "cover",
                  flex: "none",
                  border: `1px solid ${CARD_BORDER}`,
                }}
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
                  if (!room || locked) return;
                  setRemoving(q.id);
                  // No optimistic removal, unlike the reorder above: realtime
                  // deletes the row for everyone a moment later, and dropping
                  // it here first would make a failure look like a success.
                  chain.current = chain.current
                    .then(() => removeFromQueue(room.id, q.id).catch(console.error))
                    .finally(() => setRemoving(null));
                }}
                disabled={locked}
                aria-label={`Take ${q.title} out of the queue`}
                title="Take out of the queue"
                className="icon-remove"
                style={{ width: 34, height: 34, fontSize: 16, lineHeight: 1, flex: "none" }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      {rows.length === 0 && (
        <div style={{ marginTop: 12, fontSize: 14, color: MUTED, padding: "4px 2px" }}>
          Nothing of yours in the queue. Go add something.
        </div>
      )}
    </>
  );
}
