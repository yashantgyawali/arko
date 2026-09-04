"use client";

import { useEffect, useRef, useState } from "react";
import { useRoomContext } from "@/lib/room-context";
import { useRouter } from "next/navigation";
import { clearVerdict, leaveRoom } from "@/lib/actions";
import { inviteLink, thumb } from "@/lib/format";
import type { Track } from "@/lib/catalog";
import { NowPlaying } from "@/components/guest/NowPlaying";
import { AddSong } from "@/components/guest/AddSong";
import { RoomTab } from "@/components/guest/RoomTab";
import { TabBar, type GuestScreen } from "@/components/guest/TabBar";
import { VerdictOverlay } from "@/components/VerdictOverlay";
import { Toast } from "@/components/Toast";

export function GuestApp() {
  const { loading, notFound, authError, room, nowPlaying, myMember } = useRoomContext();
  const router = useRouter();
  const [screen, setScreen] = useState<GuestScreen>("room");
  const [leaving, setLeaving] = useState(false);
  const [toast, setToast] = useState<{ text: string; thumbUrl?: string } | null>(null);

  // Once you've genuinely been a member, myMember going back to null means
  // the host removed you — not that you haven't loaded yet. Without this
  // distinction every action (voting, adding a song) would just silently
  // fail with no explanation, since the server correctly rejects a
  // non-member and there'd be nothing on screen saying why.
  const wasMemberRef = useRef(false);
  if (myMember) wasMemberRef.current = true;
  // Excludes a voluntary exit: leaving also drops myMember, and telling
  // someone they were removed when they just tapped Exit would be nonsense.
  const removed = wasMemberRef.current && !myMember && !loading && !leaving;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!room?.last_verdict || !room.last_verdict_at) return;
    const hold = room.last_verdict === "nein" ? 2400 : 1900;
    const t = setTimeout(() => {
      clearVerdict(room.id).catch(console.error);
    }, hold);
    return () => clearTimeout(t);
  }, [room?.id, room?.last_verdict, room?.last_verdict_at]);

  const leave = async () => {
    if (!room) return;
    setLeaving(true);
    try {
      await leaveRoom(room.id);
    } catch (err) {
      console.error(err);
    }
    router.replace("/");
  };

  if (leaving) return <Centered>Leaving the room…</Centered>;
  if (authError) {
    return (
      <Centered>
        <p>{authError}</p>
      </Centered>
    );
  }
  if (loading) return <Centered>Loading room…</Centered>;
  if (notFound || !room) {
    return (
      <Centered>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Room not found</div>
        <div style={{ color: "var(--brown)", fontSize: 14 }}>Double check the code with the host.</div>
      </Centered>
    );
  }
  if (removed) {
    return (
      <Centered>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>You&apos;ve been removed from this room</div>
        <div style={{ color: "var(--brown)", fontSize: 14 }}>Ask the host if you think that was a mistake.</div>
      </Centered>
    );
  }

  const shareInvite = async () => {
    const url = inviteLink(room.code);
    // Native share sheet on phones puts it straight into WhatsApp/Messages,
    // which is how people actually get their friends into the room.
    if (navigator.share) {
      try {
        await navigator.share({ title: "arko", text: `Join ${room.name} on arko`, url });
        return;
      } catch {
        // user dismissed the sheet, or share is unavailable — fall through to copy
      }
    }
    navigator.clipboard?.writeText(url).catch(() => {});
    setToast({ text: "Invite link copied!" });
  };

  const onAdded = (track: Track) => {
    setToast({ text: "Queued it!", thumbUrl: thumb(track.videoId) });
  };

  return (
    <div className="guest-shell">
      {screen === "room" && <RoomTab onShare={shareInvite} onLeave={leave} />}
      {screen === "vote" && <NowPlaying />}
      {screen === "search" && <AddSong onAdded={onAdded} />}

      <TabBar screen={screen} onChange={setScreen} />

      {toast && <Toast text={toast.text} thumbUrl={toast.thumbUrl} />}

      {room.last_verdict && (
        <VerdictOverlay
          verdict={room.last_verdict as "nein" | "ahoy"}
          size="phone"
          subline={
            room.last_verdict === "ahoy"
              ? "The room said keep it. Locked in for the rest of the song."
              : "The room said no. Skipping ahead."
          }
          next={
            room.last_verdict === "nein" && nowPlaying
              ? { title: nowPlaying.title, artist: nowPlaying.artist, thumbUrl: nowPlaying.thumb_url ?? thumb(nowPlaying.video_id) }
              : null
          }
        />
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "var(--app-h)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
      <div>{children}</div>
    </div>
  );
}
