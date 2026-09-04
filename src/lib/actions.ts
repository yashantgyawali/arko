import { supabase } from "@/lib/supabase/client";
import type { SkipRule } from "@/lib/format";

const RULE_MAP: Record<SkipRule, SkipRule> = {
  majority: "majority",
  two_thirds: "two_thirds",
  anyone: "anyone",
};

export async function createRoom(name: string, skipRule: SkipRule) {
  const { data, error } = await supabase.rpc("create_room", {
    p_name: name,
    p_skip_rule: RULE_MAP[skipRule],
  });
  if (error) throw error;
  return data;
}

export async function joinRoom(code: string, displayName: string) {
  const { data, error } = await supabase.rpc("join_room", {
    p_code: code.toUpperCase(),
    p_display_name: displayName,
  });
  if (error) throw error;
  return data;
}

export async function castVote(
  roomId: string,
  queueItemId: string,
  value: "nein" | "ahoy",
) {
  const { error } = await supabase.rpc("cast_vote", {
    p_room_id: roomId,
    p_queue_item_id: queueItemId,
    p_value: value,
  });
  if (error) throw error;
}

export async function addToQueue(
  roomId: string,
  track: {
    videoId: string;
    title: string;
    artist: string;
    durationS: number;
    thumbUrl: string | null;
  },
) {
  const { data, error } = await supabase.rpc("add_to_queue", {
    p_room_id: roomId,
    p_video_id: track.videoId,
    p_title: track.title,
    p_artist: track.artist,
    p_duration_s: track.durationS,
    p_thumb_url: track.thumbUrl,
  });
  if (error) throw error;
  return data;
}

export async function removeFromQueue(roomId: string, queueItemId: string) {
  const { error } = await supabase.rpc("remove_from_queue", {
    p_room_id: roomId,
    p_queue_item_id: queueItemId,
  });
  if (error) throw error;
}

// Leaving actually removes you, so you stop counting toward the vote
// threshold — a guest who walked out was quietly making every song harder to
// vote out. Songs you queued stay in the queue; your votes go with you.
export async function leaveRoom(roomId: string) {
  const { error } = await supabase.rpc("leave_room", { p_room_id: roomId });
  if (error) throw error;
}

export async function removeMember(roomId: string, memberId: string) {
  const { error } = await supabase.rpc("remove_member", {
    p_room_id: roomId,
    p_member_id: memberId,
  });
  if (error) throw error;
}

// Both of these name the song they mean. Without that the server could only be
// told "end whatever is playing", so a request that raced an advance landed on
// the next song instead of being ignored.
export async function hostSkip(roomId: string, queueItemId: string) {
  const { error } = await supabase.rpc("host_skip", {
    p_room_id: roomId,
    p_queue_item_id: queueItemId,
  });
  if (error) throw error;
}

export async function markNowPlayingFinished(roomId: string, queueItemId: string) {
  const { error } = await supabase.rpc("mark_now_playing_finished", {
    p_room_id: roomId,
    p_queue_item_id: queueItemId,
  });
  if (error) throw error;
}

export async function markPlaybackStarted(roomId: string) {
  const { error } = await supabase.rpc("mark_playback_started", {
    p_room_id: roomId,
  });
  if (error) throw error;
}

// Pause is room state, not just the host's own player — everyone's clock has
// to stop with the music.
export async function pausePlayback(roomId: string, queueItemId: string) {
  const { error } = await supabase.rpc("pause_playback", {
    p_room_id: roomId,
    p_queue_item_id: queueItemId,
  });
  if (error) throw error;
}

export async function resumePlayback(roomId: string, queueItemId: string) {
  const { error } = await supabase.rpc("resume_playback", {
    p_room_id: roomId,
    p_queue_item_id: queueItemId,
  });
  if (error) throw error;
}

export async function clearVerdict(roomId: string) {
  const { error } = await supabase.rpc("clear_verdict", { p_room_id: roomId });
  if (error) throw error;
}

export async function updateRoomSettings(
  roomId: string,
  skipRule: SkipRule,
  ahoyLock: boolean,
) {
  const { data, error } = await supabase.rpc("update_room_settings", {
    p_room_id: roomId,
    p_skip_rule: skipRule,
    p_ahoy_lock: ahoyLock,
  });
  if (error) throw error;
  return data;
}
