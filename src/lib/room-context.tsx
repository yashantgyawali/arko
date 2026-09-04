"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { songElapsedS } from "@/lib/format";
import { supabase } from "@/lib/supabase/client";
import { useAnonAuth } from "@/lib/use-anon-auth";
import type { Database } from "@/lib/supabase/database.types";

export type RoomRow = Database["public"]["Tables"]["rooms"]["Row"];
export type MemberRow = Database["public"]["Tables"]["members"]["Row"];
export type QueueItemRow = Database["public"]["Tables"]["queue_items"]["Row"];
export type VoteRow = Database["public"]["Tables"]["votes"]["Row"];

type RoomContextValue = {
  loading: boolean;
  notFound: boolean;
  authError: string | null;
  userId: string | null;
  room: RoomRow | null;
  members: MemberRow[];
  queue: QueueItemRow[];
  votes: VoteRow[];
  myMember: MemberRow | null;
  nowPlaying: QueueItemRow | null;
  queued: QueueItemRow[];
  elapsedS: number;
  isPaused: boolean;
};

const RoomContext = createContext<RoomContextValue | null>(null);

export function useRoomContext() {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error("useRoomContext must be used inside RoomProvider");
  return ctx;
}

// Matches the six-hour window retire_idle_rooms() uses server-side. Checked
// here too so a room that has gone quiet reads as closed immediately, rather
// than staying open until the next hourly sweep happens to run.
const IDLE_RETIRE_MS = 6 * 60 * 60 * 1000;

export function RoomProvider({
  code,
  children,
}: {
  code: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { userId, ready } = useAnonAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [queue, setQueue] = useState<QueueItemRow[]>([]);
  const [votes, setVotes] = useState<VoteRow[]>([]);
  const [elapsedS, setElapsedS] = useState(0);

  // initial fetch + auth error surfacing
  useEffect(() => {
    let cancelled = false;
    if (!ready) return;

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setAuthError(error.message);
      if (!data.session && !error) {
        setAuthError(
          "Couldn't start a session. Anonymous sign-in may be disabled for this project.",
        );
      }
    });

    async function load() {
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", code.toUpperCase())
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setRoom(data);
      const [{ data: memberRows }, { data: queueRows }] = await Promise.all([
        supabase.from("members").select("*").eq("room_id", data.id),
        supabase
          .from("queue_items")
          .select("*")
          .eq("room_id", data.id)
          .order("position", { ascending: true }),
      ]);
      if (cancelled) return;
      setMembers(memberRows ?? []);
      setQueue(queueRows ?? []);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [code, ready]);

  // realtime: room / members / queue_items
  const roomId = room?.id ?? null;
  useEffect(() => {
    if (!roomId) return;
    // Re-bind to a fresh const: TS does not carry the guard's narrowing into
    // nested closures below, so `roomId` itself still reads as `string | null`
    // inside resync() and the channel filters without this.
    const id = roomId;
    let cancelled = false;

    // Postgres changes realtime streams live events only — anything that
    // happens while the socket is disconnected is gone, never backfilled.
    // Mobile browsers routinely kill the websocket in the background (screen
    // lock, app switch), so without this a guest's phone freezes on whatever
    // was playing when it last had a connection until they manually reload.
    // Refetching fresh state every time the channel (re)connects — including
    // the very first connect — closes that gap.
    async function resync() {
      const [{ data: roomRow }, { data: memberRows }, { data: queueRows }] = await Promise.all([
        supabase.from("rooms").select("*").eq("id", id).maybeSingle(),
        supabase.from("members").select("*").eq("room_id", id),
        supabase
          .from("queue_items")
          .select("*")
          .eq("room_id", id)
          .order("position", { ascending: true }),
      ]);
      if (cancelled) return;
      if (roomRow) setRoom(roomRow);
      setMembers(memberRows ?? []);
      setQueue(queueRows ?? []);
    }

    const channel = supabase
      .channel(`room:${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${id}` },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          setRoom(payload.new as RoomRow);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "members", filter: `room_id=eq.${id}` },
        (payload) => {
          setMembers((prev) => {
            if (payload.eventType === "DELETE") {
              return prev.filter((m) => m.id !== (payload.old as MemberRow).id);
            }
            const row = payload.new as MemberRow;
            const exists = prev.some((m) => m.id === row.id);
            return exists ? prev.map((m) => (m.id === row.id ? row : m)) : [...prev, row];
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue_items", filter: `room_id=eq.${id}` },
        (payload) => {
          setQueue((prev) => {
            if (payload.eventType === "DELETE") {
              return prev.filter((q) => q.id !== (payload.old as QueueItemRow).id);
            }
            const row = payload.new as QueueItemRow;
            const exists = prev.some((q) => q.id === row.id);
            const next = exists
              ? prev.map((q) => (q.id === row.id ? row : q))
              : [...prev, row];
            return next.sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
          });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") resync();
      });

    // Belt and suspenders: some mobile browsers fire visibility/online events
    // well before the socket itself notices it dropped. Resync eagerly rather
    // than wait for the channel to realize it needs to reconnect.
    const onWake = () => {
      if (document.visibilityState === "visible") resync();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    window.addEventListener("online", onWake);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("online", onWake);
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // realtime: votes for whatever is currently playing
  const nowPlayingId = room?.now_playing_id ?? null;
  useEffect(() => {
    if (!nowPlayingId) {
      setVotes([]);
      return;
    }
    const id = nowPlayingId; // see the room/members/queue_items effect above
    let cancelled = false;

    async function resync() {
      const { data } = await supabase.from("votes").select("*").eq("queue_item_id", id);
      if (!cancelled) setVotes(data ?? []);
    }

    const channel = supabase
      .channel(`votes:${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "votes",
          filter: `queue_item_id=eq.${id}`,
        },
        (payload) => {
          setVotes((prev) => {
            if (payload.eventType === "DELETE") {
              const old = payload.old as VoteRow;
              return prev.filter((v) => v.member_id !== old.member_id);
            }
            const row = payload.new as VoteRow;
            const exists = prev.some((v) => v.member_id === row.member_id);
            return exists
              ? prev.map((v) => (v.member_id === row.member_id ? row : v))
              : [...prev, row];
          });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") resync();
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [nowPlayingId]);

  const myMember = useMemo(
    () => members.find((m) => m.user_id === userId) ?? null,
    [members, userId],
  );
  // Must actually be playing. resync() fetches the room and the queue as three
  // separate statements, so the two can straddle an advance and briefly
  // disagree — pointing now_playing_id at a row the queue already shows as
  // played. Requiring status here keeps a half-updated snapshot from being
  // treated as the current song.
  const nowPlaying = useMemo(
    () => queue.find((q) => q.id === room?.now_playing_id && q.status === "playing") ?? null,
    [queue, room?.now_playing_id],
  );

  // The room is paused for everyone or nobody — the host's Pause writes it to
  // the current song, so every client freezes at the same point.
  const isPaused = !!nowPlaying?.paused_at;

  // Elapsed ticker. All the actual arithmetic lives in songElapsedS so the
  // host's seek offset and every guest's clock are computed the same way.
  // While paused there is nothing to tick — the value is pinned.
  const anchor = nowPlaying?.audio_started_at ?? room?.started_at ?? null;
  const pausedAt = nowPlaying?.paused_at ?? null;
  const pausedMs = nowPlaying?.paused_ms ?? 0;
  useEffect(() => {
    if (!anchor) {
      setElapsedS(0);
      return;
    }
    const song = { audio_started_at: anchor, paused_at: pausedAt, paused_ms: pausedMs };
    const tick = () => setElapsedS(songElapsedS(song, anchor));
    tick();
    if (pausedAt) return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [anchor, pausedAt, pausedMs, room?.now_playing_id]);

  const queued = useMemo(
    () =>
      queue
        .filter((q) => q.status === "queued")
        .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at)),
    [queue],
  );

  // A retired room has no live queue, no playback and refuses writes, so there
  // is nothing to show — send people home instead of dropping them into a dead
  // room with a stale queue.
  const retired =
    !!room &&
    (!!room.retired_at || Date.now() - new Date(room.last_active_at).getTime() > IDLE_RETIRE_MS);
  useEffect(() => {
    if (retired) router.replace("/");
  }, [retired, router]);

  const value: RoomContextValue = {
    loading,
    notFound,
    authError,
    userId,
    room,
    members,
    queue,
    votes,
    myMember,
    nowPlaying,
    queued,
    elapsedS,
    isPaused,
  };

  if (retired) {
    return (
      <div style={{ minHeight: "var(--app-h)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>This room has closed</div>
          <div style={{ color: "var(--brown)", fontSize: 14 }}>Taking you home…</div>
        </div>
      </div>
    );
  }

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useLiveMemberCount() {
  const { members } = useRoomContext();
  return members.length;
}
