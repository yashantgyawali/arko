export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
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
