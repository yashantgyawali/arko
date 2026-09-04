export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

/**
 * How far into the current song we actually are, in seconds — the one place
 * that answers this, so the host's seek offset, the progress bar and every
 * guest's clock can never disagree.
 *
 * Anchored to when audio genuinely began rather than when the server promoted
 * the song (those differ by however long the player took to start), and it
 * stops dead while the room is paused rather than running on against
 * wall-clock time.
 */
export function songElapsedS(song: {
  audio_started_at: string | null;
  paused_at: string | null;
  paused_ms: number;
}, roomStartedAt: string | null): number {
  const anchor = song.audio_started_at ?? roomStartedAt;
  if (!anchor) return 0;
  const until = song.paused_at ? new Date(song.paused_at).getTime() : Date.now();
  const ms = until - new Date(anchor).getTime() - (song.paused_ms || 0);
  return Math.max(0, ms / 1000);
}

export function thumb(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

export function thumbHi(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
}

export function initial(name: string): string {
  return (name.trim()[0] || "?").toUpperCase();
}

/**
 * The host never votes — only guests do (the console has "Skip now" instead,
 * an explicit override). Counting the host toward "how many people are in
 * the room" made the vote threshold harder to hit than it should be and made
 * "X in the room" over-report by one. This is the single source of truth for
 * that count — every threshold calculation and every "in the room" display
 * must use it, and the server-side room_threshold() Postgres function is
 * kept in sync with the same exclusion so the UI and actual vote resolution
 * never disagree about who counts.
 */
export function roomSize(members: { is_host: boolean }[]): number {
  return members.filter((m) => !m.is_host).length;
}

export type SkipRule = "majority" | "two_thirds" | "anyone";

export function threshold(rule: SkipRule, memberCount: number): number {
  if (memberCount === 0) return 1;
  if (rule === "anyone") return 1;
  if (rule === "two_thirds") return Math.ceil((memberCount * 2) / 3);
  return Math.floor(memberCount / 2) + 1;
}

export function ruleLabel(rule: SkipRule): string {
  if (rule === "anyone") return "Anyone";
  if (rule === "two_thirds") return "Two thirds";
  return "Majority";
}

export function ruleHelp(rule: SkipRule): string {
  if (rule === "anyone") return "Any single Nein skips the song.";
  if (rule === "two_thirds") return "Two thirds of the room has to say Nein.";
  return "A majority of the room has to say Nein.";
}

/**
 * A link that carries the room code, so an invited guest only has to type a
 * name. Sharing a bare code means the recipient has to be told it separately.
 */
export function inviteLink(code: string): string {
  const path = `/join?code=${encodeURIComponent(code)}`;
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

export function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs === 1) return "1 hour ago";
  return `${hrs} hours ago`;
}
