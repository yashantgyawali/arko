"use client";

const KEY = "arko:display-name";

/**
 * A person's name doesn't change room to room — remembering it locally means
 * rejoining (after a refresh, or a totally new room next time) only takes
 * typing the code, not retyping who you are.
 */
export function getSavedName(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveName(name: string): void {
  if (typeof window === "undefined" || !name.trim()) return;
  try {
    window.localStorage.setItem(KEY, name.trim());
  } catch {
    // best-effort — never worth breaking the join flow over
  }
}
