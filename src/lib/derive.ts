import type { MemberRow, QueueItemRow, VoteRow } from "@/lib/room-context";

export function voteCounts(votes: VoteRow[]) {
  let nein = 0;
  let ahoy = 0;
  for (const v of votes) {
    if (v.value === "nein") nein++;
    else if (v.value === "ahoy") ahoy++;
  }
  return { nein, ahoy };
}

export function bestBy(members: MemberRow[], key: keyof MemberRow): MemberRow | null {
  let best: MemberRow | null = null;
  for (const m of members) {
    const v = m[key] as number;
    if (v <= 0) continue;
    if (!best || v > (best[key] as number)) best = m;
  }
  return best;
}

export const TITLES = [
  { key: "songs_kept" as const, name: "Crowd pleaser", desc: "Most songs the room kept" },
  { key: "songs_skipped" as const, name: "Room villain", desc: "Most songs skipped out from under you" },
  { key: "neins_cast" as const, name: "Nein machine", desc: "Voted Nein the most" },
  { key: "songs_added" as const, name: "Queue hog", desc: "Added the most songs" },
];

/**
 * The order the queue will actually play in, mirroring advance_room_queue.
 *
 * The server picks one song at a time — whoever has waited longest since
 * their own last song, first-come-first-served among their songs — so a plain
 * sort can't express it: every pick changes who is next. This replays that
 * greedy choice to the end of the queue so "Up next" shows the real running
 * order instead of raw insertion order, which after rotation is nobody's
 * playing order.
 */
export function upNextOrder(queue: QueueItemRow[]): QueueItemRow[] {
  // Songs whose queuer has left carry a null added_by and share one bucket,
  // matching the server's `is not distinct from`.
  const queuerOf = (q: QueueItemRow) => q.added_by ?? "~departed";

  const lastPlayed = new Map<string, number>();
  let latest = 0;
  for (const q of queue) {
    if (!q.audio_started_at) continue; // never actually played, so never a turn
    const at = new Date(q.audio_started_at).getTime();
    const key = queuerOf(q);
    if (at > (lastPlayed.get(key) ?? -Infinity)) lastPlayed.set(key, at);
    if (at > latest) latest = at;
  }

  const remaining = queue
    .filter((q) => q.status === "queued")
    .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));

  // Stands in for "and then that one played". Seeded above every real
  // timestamp so it still sorts last even if the server clock runs ahead.
  let after = Math.max(latest, Date.now()) + 1;

  const order: QueueItemRow[] = [];
  while (remaining.length > 0) {
    let pick = 0;
    let longestWait = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const waited = lastPlayed.get(queuerOf(remaining[i])) ?? -Infinity;
      // strict <, and `remaining` is position-sorted, so ties go to whoever
      // queued first — the same tie-break the server uses
      if (waited < longestWait) {
        longestWait = waited;
        pick = i;
      }
    }
    const [next] = remaining.splice(pick, 1);
    lastPlayed.set(queuerOf(next), after++);
    order.push(next);
  }
  return order;
}
