import type { MemberRow, VoteRow } from "@/lib/room-context";

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
