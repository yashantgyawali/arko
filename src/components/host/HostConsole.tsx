"use client";

import { useEffect, useRef, useState } from "react";
import { useRoomContext, type MemberRow, type RoomRow } from "@/lib/room-context";
import {
  clearVerdict,
  hostSkip,
  markNowPlayingFinished,
  removeFromQueue,
  removeMember,
  updateRoomSettings,
} from "@/lib/actions";
import { voteCounts } from "@/lib/derive";
import { initial, inviteLink, mmss, relativeTime, roomSize, ruleHelp, ruleLabel, threshold, thumb, type SkipRule } from "@/lib/format";
import { STALLED, useYouTubePlayer } from "@/lib/use-youtube-player";
import { VoteMeter } from "@/components/VoteMeter";
import { VerdictOverlay } from "@/components/VerdictOverlay";
import { Logo } from "@/components/Logo";

const RULES: SkipRule[] = ["majority", "two_thirds", "anyone"];

type SectionId = "now-playing" | "queue" | "room";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "now-playing", label: "Now playing" },
  { id: "queue", label: "Queue" },
  { id: "room", label: "Room" },
];

export function HostConsole() {
  const { loading, notFound, authError, userId, room, members, votes, queue, nowPlaying, queued, elapsedS } =
    useRoomContext();
  const [showSettings, setShowSettings] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>("now-playing");
  const lastLoadedRef = useRef<string | null>(null);
  const isHost = !!room && !!userId && room.host_id === userId;

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  // Scroll-spy so the rail reflects where you actually are — nav that never
  // shows an active state reads as broken. On desktop "room" is a right-hand
  // column rather than a vertical band, so it is always intersecting and must
  // be excluded, or it would win the moment the page loads.
  useEffect(() => {
    if (loading || notFound) return;

    const stacked = window.matchMedia("(max-width: 760px)");
    let observer: IntersectionObserver | null = null;

    const attach = () => {
      observer?.disconnect();
      const ids: SectionId[] = stacked.matches
        ? ["now-playing", "queue", "room"]
        : ["now-playing", "queue"];
      const els = ids
        .map((id) => document.getElementById(id))
        .filter((el): el is HTMLElement => !!el);
      if (els.length === 0) return;
      observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
          if (visible) setActiveSection(visible.target.id as SectionId);
        },
        { rootMargin: "-15% 0px -70% 0px" },
      );
      els.forEach((el) => observer!.observe(el));
    };

    attach();
    stacked.addEventListener("change", attach);
    return () => {
      observer?.disconnect();
      stacked.removeEventListener("change", attach);
    };
  }, [loading, notFound]);

  const { containerRef, loadVideo, play, pause, stop, resume, isPlaying, needsTap } = useYouTubePlayer(
    () => {
      if (room && isHost) markNowPlayingFinished(room.id).catch(console.error);
    },
    (code) => {
      if (!room || !isHost) return;
      setPlaybackError(youtubeErrorReason(code));
      hostSkip(room.id).catch(console.error);
    },
  );

  useEffect(() => {
    if (!playbackError) return;
    const t = setTimeout(() => setPlaybackError(null), 5000);
    return () => clearTimeout(t);
  }, [playbackError]);

  useEffect(() => {
    if (nowPlaying && lastLoadedRef.current !== nowPlaying.video_id) {
      lastLoadedRef.current = nowPlaying.video_id;
      // Computed directly from room.started_at rather than the elapsedS
      // ticker: that ticker lives in a parent provider and can still hold a
      // stale value (e.g. 0) on the very render this effect fires, since
      // child effects run before parent effects in React. Without a correct
      // offset here, a host refreshing mid-song would see the right elapsed
      // time on screen (that's server-derived, independent of the player)
      // while the audio silently restarted from 0:00.
      const startedAtMs = room?.started_at ? new Date(room.started_at).getTime() : Date.now();
      const offset = Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
      loadVideo(nowPlaying.video_id, offset);
    } else if (!nowPlaying && lastLoadedRef.current !== null) {
      lastLoadedRef.current = null;
      stop();
    }
  }, [nowPlaying, loadVideo, stop, room?.started_at]);

  // Safety net: if the embedded player never fires ENDED (autoplay blocked,
  // player error, tab was backgrounded), the server-side elapsed clock is
  // still the source of truth — advance the queue once it runs past the
  // song's duration so a stuck player can't freeze the room. Only the host's
  // own session may act on this — a non-host viewer (or an in-flight auth
  // check) must never attempt it.
  useEffect(() => {
    if (!room || !nowPlaying || !isHost) return;
    if (elapsedS < nowPlaying.duration_s + 3) return;
    markNowPlayingFinished(room.id).catch(console.error);
  }, [room, nowPlaying, elapsedS, isHost]);

  useEffect(() => {
    if (!room?.last_verdict || !room.last_verdict_at) return;
    const hold = room.last_verdict === "nein" ? 2400 : 1900;
    const t = setTimeout(() => clearVerdict(room.id).catch(console.error), hold);
    return () => clearTimeout(t);
  }, [room?.id, room?.last_verdict, room?.last_verdict_at]);

  // A skip's own RPC advances the queue to the next song in the same update
  // that sets last_verdict, so `room.now_playing_id` already points at the
  // new song on this very render — but the room-context provider only swaps
  // `votes` over to match it in an effect, which hasn't run yet this render.
  // Snapshotting here, during render, catches the tally the instant it
  // changes, while `votes` still belongs to the song that just got voted on.
  const verdictTallyRef = useRef<{ nein: number; ahoy: number; total: number } | null>(null);
  const lastVerdictAtRef = useRef<string | null>(null);
  const { nein: liveNein, ahoy: liveAhoy } = voteCounts(votes);
  if (room?.last_verdict_at && room.last_verdict_at !== lastVerdictAtRef.current) {
    lastVerdictAtRef.current = room.last_verdict_at;
    verdictTallyRef.current = { nein: liveNein, ahoy: liveAhoy, total: roomSize(members) };
  }

  if (authError) return <Centered>{authError}</Centered>;
  if (loading) return <Centered>Loading room…</Centered>;
  if (notFound || !room) {
    return (
      <Centered>
        <div style={{ fontWeight: 700 }}>Room not found</div>
      </Centered>
    );
  }
  if (userId && room.host_id !== userId) {
    return (
      <Centered>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Only the host can see this</div>
        <a href={`/room/${room.code}`} style={{ color: "var(--red)", fontWeight: 600 }}>
          Go to the guest view →
        </a>
      </Centered>
    );
  }

  const total = roomSize(members);
  const rule = room.skip_rule as SkipRule;
  const th = threshold(rule, total);
  const { nein, ahoy } = voteCounts(votes);
  const played = queue.filter((q) => q.status === "played").length;
  const skipped = queue.filter((q) => q.status === "skipped").length;
  const neinsTonight = members.reduce((a, m) => a + m.neins_cast, 0);
  const recentActivity = [...queue].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6);
  // The host never votes or gets scored — showing up in this leaderboard
  // would read as the host competing in their own room.
  const ranked = members.filter((m) => !m.is_host).sort((a, b) => b.points - a.points);

  // The invite has to carry the code, or the guest still has to be told it.
  const copyInvite = () => {
    navigator.clipboard?.writeText(inviteLink(room.code)).catch(() => {});
    setCopied("link");
  };
  const copyCode = () => {
    navigator.clipboard?.writeText(room.code).catch(() => {});
    setCopied("code");
  };

  return (
    <div className="console-shell">
      <div className="console-sidebar">
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 4px 22px" }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "var(--radius-sm)",
              background: "var(--red)",
              border: "2px solid var(--ink)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 17,
              color: "var(--paper)",
            }}
          >
            a
          </div>
          <Logo height={19} />
          <span style={{ borderRadius: 999, border: "1px solid var(--brown)", color: "var(--brown)", fontSize: 12, fontWeight: 600, padding: "2px 10px" }}>
            host
          </span>
        </div>

        <nav aria-label="Console sections" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {SECTIONS.map((s) => {
            const active = activeSection === s.id;
            const count = s.id === "queue" ? String(queued.length) : s.id === "room" ? String(total) : "";
            return (
              <button
                key={s.id}
                onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className={`nav-item${active ? " nav-item-active" : ""}`}
                aria-current={active ? "true" : undefined}
              >
                <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{s.label}</span>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 13, opacity: 0.75 }}>{count}</span>
              </button>
            );
          })}
        </nav>

        <div style={{ flex: 1, minHeight: 20 }} />

        <button
          onClick={() => setShowSettings(true)}
          className="nav-item"
          style={{ marginBottom: 12, borderTop: "1px solid var(--brown)", borderRadius: 0, paddingTop: 14 }}
        >
          <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>Room settings</span>
        </button>

        <div style={{ background: "var(--paper)", border: "1px solid var(--brown)", borderRadius: "var(--radius-md)", padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em" }}>Room code</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 28, letterSpacing: "0.16em", lineHeight: 1.2 }}>
            {room.code}
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <button onClick={copyInvite} className="btn btn-secondary" style={{ flex: 1, padding: "10px 8px", fontSize: 13, border: "2px solid var(--ink)" }}>
              {copied === "link" ? "Copied!" : "Copy link"}
            </button>
            <button onClick={copyCode} className="btn btn-secondary" style={{ flex: "none", padding: "10px 12px", fontSize: 13, border: "2px solid var(--ink)" }}>
              {copied === "code" ? "✓" : "Code"}
            </button>
          </div>
        </div>
      </div>

      <div className="console-main">
        <div className="host-topbar">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--brown)" }}>
              Room code
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20, letterSpacing: "0.14em" }}>{room.code}</div>
          </div>
          <button onClick={copyInvite} className="btn btn-secondary tap" style={{ padding: "10px 14px", fontSize: 13, border: "2px solid var(--ink)" }}>
            {copied === "link" ? "Copied!" : "Copy link"}
          </button>
          <button onClick={() => setShowSettings(true)} className="btn btn-secondary tap" style={{ padding: "10px 14px", fontSize: 13, border: "2px solid var(--ink)" }}>
            Settings
          </button>
        </div>

        <div id="now-playing" style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap", scrollMarginTop: 16 }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontFamily: "var(--font-hand)", fontSize: 22, color: "var(--red)" }}>tonight&apos;s room</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 38, lineHeight: 1.05, letterSpacing: "-0.03em" }}>
                {room.name}
              </span>
              <span className="arko-tag" style={{ border: "2px solid var(--ink)", whiteSpace: "nowrap" }}>
                {total} in the room
              </span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flex: "none" }}>
            <div style={{ display: "flex", paddingLeft: 9 }}>
              {members.slice(0, 6).map((m) => (
                <div key={m.id} className="avatar" style={{ width: 36, height: 36, fontSize: 14, marginLeft: -9 }}>
                  {initial(m.display_name)}
                </div>
              ))}
            </div>
            <button onClick={copyInvite} className="btn btn-secondary" style={{ padding: "11px 18px", fontSize: 14, boxShadow: "4px 4px 0 0 var(--ink)", whiteSpace: "nowrap" }}>
              {copied === "link" ? "Link copied!" : "Copy invite link"}
            </button>
          </div>
        </div>

        {playbackError && (
          <div
            style={{
              marginTop: 18,
              display: "flex",
              alignItems: "center",
              gap: 10,
              border: "2px solid var(--ink)",
              borderRadius: "var(--radius-md)",
              background: "var(--yellow)",
              padding: "12px 16px",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <span>{playbackError} Skipping to the next song.</span>
          </div>
        )}

        <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14 }}>
          {[
            { label: "Songs played", value: played, note: "tonight" },
            { label: "Skipped by the room", value: skipped, note: "ouch" },
            { label: "Neins tonight", value: neinsTonight, note: "brutal" },
            { label: "In the queue", value: queued.length, note: "waiting" },
          ].map((s) => (
            <div key={s.label} className="card" style={{ padding: "16px 18px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--brown)" }}>{s.label}</div>
              <div style={{ marginTop: 4, display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 34, lineHeight: 1 }}>{s.value}</span>
                <span style={{ fontFamily: "var(--font-hand)", fontSize: 16, color: "var(--red)" }}>{s.note}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="console-grid" style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 322px", gap: 22, alignItems: "start" }}>
          <div>
            <div className="card-thick" style={{ padding: 18, display: "flex", gap: 20, flexWrap: "wrap" }}>
              <div style={{ width: 320, flex: "none", position: "relative", borderRadius: "var(--radius-sm)", overflow: "hidden", background: "var(--ink)", border: "2px solid var(--ink)", aspectRatio: "16/9" }}>
                {/* Always mounted — the YouTube API rewrites this node's DOM itself
                    (div becomes an iframe), so React must never unmount/remount it
                    or it fights the API's own manipulation and crashes. When
                    there's nothing to play we cover it instead of removing it. */}
                <div ref={containerRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
                {!nowPlaying && (
                  <div style={{ position: "absolute", inset: 0, background: "var(--ink)" }} />
                )}
                {nowPlaying && needsTap && (
                  // Browsers block autoplay that wasn't triggered by a direct
                  // click — true for every song, since it's started by a
                  // realtime event, not a click. Losing the song to an
                  // auto-skip over a browser policy would be worse than
                  // asking for one tap to unblock it.
                  <button
                    onClick={resume}
                    className="tap"
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      background: "rgba(20,16,12,0.82)",
                      color: "var(--beige)",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontSize: 34 }}>▶</span>
                    <span style={{ fontSize: 14, fontWeight: 700, textAlign: "center", padding: "0 16px" }}>
                      Tap to start playback
                    </span>
                  </button>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 240, display: "flex", flexDirection: "column" }}>
                {nowPlaying ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <Equalizer />
                      <span style={{ fontFamily: "var(--font-hand)", fontSize: 20, color: "var(--red)" }}>now playing</span>
                    </div>
                    <div style={{ marginTop: 6, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 28, lineHeight: 1.12, letterSpacing: "-0.03em", textWrap: "pretty" }}>
                      {nowPlaying.title}
                    </div>
                    <div style={{ marginTop: 5, fontSize: 16, color: "var(--brown)" }}>
                      {nowPlaying.artist} · {members.find((m) => m.id === nowPlaying.added_by)?.display_name ?? "someone"}
                    </div>
                    <div style={{ marginTop: 14 }}>
                      <div style={{ height: 10, borderRadius: 999, background: "var(--beige)", border: "2px solid var(--ink)", overflow: "hidden" }}>
                        <div style={{ height: "100%", background: "var(--red)", transition: "width 900ms linear", width: `${Math.min(100, (elapsedS / nowPlaying.duration_s) * 100)}%` }} />
                      </div>
                      <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, color: "var(--brown)" }}>
                        <span>{mmss(Math.min(elapsedS, nowPlaying.duration_s))}</span>
                        <span>{mmss(nowPlaying.duration_s)}</span>
                      </div>
                    </div>
                    <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <VoteMeter neinPct={(nein / total) * 100} ahoyPct={(ahoy / total) * 100} thresholdPct={(th / total) * 100} compact showThreshold={false} />
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap" }}>
                        {nein} Nein / {ahoy} Ahoy
                      </span>
                    </div>
                    <div style={{ flex: 1 }} />
                    <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                      <button
                        onClick={() => (isPlaying ? pause() : play())}
                        className="btn btn-secondary"
                        style={{ padding: "12px 22px", fontSize: 15, border: "2px solid var(--ink)" }}
                      >
                        {isPlaying ? "Pause" : "Play"}
                      </button>
                      <button onClick={() => hostSkip(room.id).catch(console.error)} className="btn btn-dark" style={{ padding: "12px 22px", fontSize: 15 }}>
                        Skip now
                      </button>
                      {/* explains a destructive control — system font, not the
                          decorative one, so it reads as instruction not flourish */}
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--brown)" }}>
                        {nowPlaying.locked ? "The room locked this one in." : "Overrides the vote."}
                      </span>
                    </div>
                  </>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22 }}>Nothing queued</div>
                    <div style={{ marginTop: 6, fontSize: 14, color: "var(--brown)" }}>Ask the room to add something.</div>
                  </div>
                )}
              </div>
            </div>

            <div id="queue" style={{ marginTop: 26, display: "flex", alignItems: "baseline", justifyContent: "space-between", scrollMarginTop: 16 }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, letterSpacing: "-0.03em" }}>Up next</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--brown)" }}>
                {queued.length} songs · about {Math.round(queued.reduce((a, q) => a + q.duration_s, 0) / 60)} minutes
              </span>
            </div>
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 9 }}>
              {queued.length === 0 && (
                <div className="card" style={{ color: "var(--brown)", fontSize: 14 }}>
                  Nothing queued. Ask the room to add something.
                </div>
              )}
              {queued.map((q, i) => {
                const by = members.find((m) => m.id === q.added_by);
                return (
                  <div key={q.id} className="hover-row queue-row">
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15, color: "var(--brown)", textAlign: "right" }}>
                      {i + 1}
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={q.thumb_url || thumb(q.video_id)} alt="" style={{ width: 50, height: 50, borderRadius: "var(--radius-sm)", objectFit: "cover", border: "1px solid var(--brown)" }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.title}</div>
                      <div style={{ fontSize: 13, color: "var(--brown)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.artist}</div>
                    </div>
                    <div className="queue-col-by" style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <div className="avatar" style={{ width: 26, height: 26, fontSize: 11 }}>{initial(by?.display_name ?? "?")}</div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--brown)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {by?.display_name ?? "someone"}
                      </span>
                    </div>
                    <span className="queue-col-dur" style={{ fontSize: 13, fontWeight: 600, color: "var(--brown)", fontVariantNumeric: "tabular-nums" }}>
                      {mmss(q.duration_s)}
                    </span>
                    <span
                      className="queue-col-state"
                      style={{
                        justifySelf: "start",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "3px 11px",
                        whiteSpace: "nowrap",
                        border: `1px solid ${i === 0 ? "var(--red)" : "var(--brown)"}`,
                        background: i === 0 ? "var(--red)" : "transparent",
                        color: i === 0 ? "var(--paper)" : "var(--brown)",
                      }}
                    >
                      {i === 0 ? "up next" : "queued"}
                    </span>
                    <button
                      onClick={() => removeFromQueue(room.id, q.id).catch(console.error)}
                      aria-label={`Remove ${q.title} from the queue`}
                      title="Remove from queue"
                      className="icon-remove"
                      style={{ width: 32, height: 32, fontSize: 15, lineHeight: 1 }}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div id="room" style={{ display: "flex", flexDirection: "column", gap: 22, scrollMarginTop: 16 }}>
            <RoomMembers room={room} members={members} />
            <div className="card">
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20 }}>Room activity</div>
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
                {recentActivity.length === 0 && <div style={{ fontSize: 13, color: "var(--brown)" }}>Nothing yet.</div>}
                {recentActivity.map((q) => {
                  const by = members.find((m) => m.id === q.added_by);
                  const verb = q.status === "played" ? "kept" : q.status === "skipped" ? "was skipped" : "added";
                  return (
                    <div key={q.id} style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
                      <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{initial(by?.display_name ?? "?")}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, textWrap: "pretty" }}>
                          {by?.display_name ?? "someone"} {q.status === "queued" ? "added" : verb} {q.title}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--brown)" }}>{relativeTime(q.created_at)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="card">
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20 }}>Best taste</div>
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 9 }}>
                {ranked.slice(0, 5).map((m, i) => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <span style={{ width: 14, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 13, color: "var(--brown)", flex: "none" }}>{i + 1}</span>
                    <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{initial(m.display_name)}</div>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.display_name}
                    </span>
                    <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15, flex: "none" }}>{m.points}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showSettings && (
        <SettingsPanel
          roomId={room.id}
          skipRule={rule}
          ahoyLock={room.ahoy_lock}
          onClose={() => setShowSettings(false)}
        />
      )}

      {room.last_verdict && (
        <VerdictOverlay
          verdict={room.last_verdict as "nein" | "ahoy"}
          size="desktop"
          subline={
            room.last_verdict === "ahoy"
              ? `${verdictTallyRef.current?.ahoy ?? ahoy} of ${verdictTallyRef.current?.total ?? total} said keep it. Locked in for the rest of the song.`
              : `${verdictTallyRef.current?.nein ?? nein} of ${verdictTallyRef.current?.total ?? total} said no. Skipping ahead.`
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

function Equalizer() {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 16 }}>
      <span style={{ width: 3, background: "var(--red)", borderRadius: 2, height: 9, animation: "nEq 640ms ease-in-out infinite" }} />
      <span style={{ width: 3, background: "var(--yellow)", borderRadius: 2, height: 15, animation: "nEq 640ms ease-in-out infinite", animationDelay: "150ms" }} />
      <span style={{ width: 3, background: "var(--red)", borderRadius: 2, height: 7, animation: "nEq 640ms ease-in-out infinite", animationDelay: "300ms" }} />
    </div>
  );
}

/**
 * The anonymous, no-login design means the same person can end up as two
 * distinct members if they join from more than one device/browser, or a
 * stray test session lingers — there's no account identity to dedupe
 * against. This gives the host a manual way to clean that up.
 */
function RoomMembers({ room, members }: { room: RoomRow; members: MemberRow[] }) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!confirmId) return;
    const t = setTimeout(() => setConfirmId(null), 3000);
    return () => clearTimeout(t);
  }, [confirmId]);

  async function confirmRemove(member: MemberRow) {
    setBusyId(member.id);
    setError(null);
    try {
      await removeMember(room.id, member.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove that person.");
    } finally {
      setBusyId(null);
      setConfirmId(null);
    }
  }

  return (
    <div className="card">
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 20 }}>Room members</div>
      {error && (
        <div role="alert" style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: "var(--red)" }}>
          {error}
        </div>
      )}
      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {members.map((m) => {
          const confirming = confirmId === m.id;
          return (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <div className="avatar" style={{ width: 30, height: 30, fontSize: 12 }}>{initial(m.display_name)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.display_name}
                  {m.is_host && (
                    <span className="arko-tag" style={{ marginLeft: 8, padding: "1px 8px", fontSize: 11 }}>
                      host
                    </span>
                  )}
                </div>
              </div>
              {!m.is_host &&
                (confirming ? (
                  <button
                    onClick={() => confirmRemove(m)}
                    disabled={busyId === m.id}
                    className="btn"
                    style={{ flex: "none", padding: "6px 12px", fontSize: 12, background: "var(--red)", color: "var(--paper)" }}
                  >
                    {busyId === m.id ? "Removing…" : `Remove ${m.display_name}?`}
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirmId(m.id)}
                    aria-label={`Remove ${m.display_name}`}
                    title="Remove from room"
                    className="icon-remove"
                    style={{ flex: "none", width: 28, height: 28, fontSize: 14, lineHeight: 1 }}
                  >
                    ×
                  </button>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SettingsPanel({
  roomId,
  skipRule,
  ahoyLock,
  onClose,
}: {
  roomId: string;
  skipRule: SkipRule;
  ahoyLock: boolean;
  onClose: () => void;
}) {
  const [rule, setRule] = useState(skipRule);
  const [lock, setLock] = useState(ahoyLock);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await updateRoomSettings(roomId, rule, lock);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(19,13,1,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card-thick" style={{ padding: 26, width: "100%", maxWidth: 420, boxShadow: "8px 8px 0 0 var(--yellow)" }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22 }}>Room settings</div>
        <div style={{ marginTop: 20, fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Skip when</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {RULES.map((r) => (
            <button
              key={r}
              onClick={() => setRule(r)}
              className="btn"
              style={{
                padding: "10px 16px",
                fontSize: 14,
                background: rule === r ? "var(--red)" : "var(--paper)",
                color: rule === r ? "var(--paper)" : "var(--ink)",
              }}
            >
              {ruleLabel(r)}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 8, fontSize: 13, color: "var(--brown)" }}>{ruleHelp(rule)}</div>

        <label style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          <input type="checkbox" checked={lock} onChange={(e) => setLock(e.target.checked)} />
          Ahoy can lock a song in
        </label>

        <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: "10px 20px", fontSize: 14, border: "2px solid var(--ink)" }}>
            Cancel
          </button>
          <button onClick={save} disabled={busy} className="btn btn-primary" style={{ padding: "10px 20px", fontSize: 14 }}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
      <div>{children}</div>
    </div>
  );
}

// https://developers.google.com/youtube/iframe_api_reference#onError
function youtubeErrorReason(code: number): string {
  if (code === STALLED)
    return "That video wouldn't start playing — an ad blocker or blocked third-party cookies on this browser is the usual cause.";
  if (code === 101 || code === 150) return "That video's owner disabled it from playing in embedded players.";
  if (code === 100) return "That video is private or was removed.";
  if (code === 2) return "That video ID isn't valid.";
  return "That video hit a playback error on YouTube's end.";
}
