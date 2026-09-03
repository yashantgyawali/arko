"use client";

import type { Track } from "@/lib/catalog";

const KEY = "arko:saved-playlist";
const MAX_SAVED = 50;

/**
 * A host's or guest's own history of songs they've queued, kept entirely in
 * this browser (no account, no server round trip) — so next time they host
 * a night from the same device, their usual picks are one tap away instead
 * of re-searched from scratch.
 */
export function getSavedPlaylist(): Track[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTrackToPlaylist(track: Track): Track[] {
  const next = [track, ...getSavedPlaylist().filter((t) => t.videoId !== track.videoId)].slice(0, MAX_SAVED);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // localStorage can throw in private browsing or when disabled — this is
    // a nice-to-have, never worth breaking the actual add-to-queue flow over
  }
  return next;
}
