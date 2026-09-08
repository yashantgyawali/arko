"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { claimHost } from "@/lib/actions";
import { useAnonAuth } from "@/lib/use-anon-auth";
import { Logo } from "@/components/Logo";

/**
 * Taking over as host from a handover link.
 *
 * Deliberately a single confirm rather than claiming on page load: opening
 * this link removes whoever is currently hosting, and links get opened by
 * accident — previewed by a chat app, tapped twice, restored with the tab on
 * a browser relaunch. None of those should cost someone the room.
 */
export function HandoverClaim({ token }: { token: string }) {
  const router = useRouter();
  const { userId, ready, error: authError, ensure } = useAnonAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const claimedRef = useRef(false);

  useEffect(() => {
    if (!token) setError("This handover link is missing its code.");
  }, [token]);

  const claim = async () => {
    if (claimedRef.current || !token) return;
    claimedRef.current = true;
    setBusy(true);
    setError(null);
    try {
      // The link may well be opened on a phone that has never used arko, so
      // make sure there's a session before spending a single-use token.
      const uid = userId ?? (await ensure());
      if (!uid) {
        setError(authError ?? "Couldn't start a session. Check your connection and try again.");
        claimedRef.current = false;
        return;
      }
      const room = await claimHost(token);
      const code = (room as { code?: string } | null)?.code;
      if (!code) {
        setError("That handover didn't complete. Ask for a fresh link.");
        claimedRef.current = false;
        return;
      }
      router.replace(`/host/${code}`);
    } catch (err) {
      // The server's messages here are the useful ones — used, cancelled,
      // expired, room closed — so surface them rather than a generic failure.
      setError(err instanceof Error ? err.message : "That handover link didn't work.");
      claimedRef.current = false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "var(--app-h)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: 24,
        textAlign: "center",
      }}
    >
      <Logo height={28} />
      <div style={{ fontFamily: "var(--font-hand)", fontSize: 21, color: "var(--red)" }}>
        someone wants to hand you the room
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 30, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
        Take over as host
      </div>
      <div style={{ maxWidth: 340, fontSize: 15, color: "var(--brown)", textWrap: "pretty" }}>
        The queue keeps playing from where it is — but the music moves to this
        device, so keep this tab open. Whoever is hosting now will be sent home.
      </div>

      {error && (
        <div role="alert" style={{ maxWidth: 340, fontSize: 14, fontWeight: 700, color: "var(--red)", textWrap: "pretty" }}>
          {error}
        </div>
      )}

      <button
        onClick={claim}
        disabled={busy || !token}
        className="btn btn-primary tap"
        style={{ marginTop: 6, padding: "16px 28px", fontSize: 18, opacity: busy || !token ? 0.6 : 1 }}
      >
        {busy ? "Taking over…" : "Take over as host"}
      </button>

      <div style={{ fontSize: 13, color: "var(--brown)", minHeight: 18 }}>
        {!ready && !authError ? "Connecting…" : ""}
      </div>

      <a href="/" style={{ marginTop: 4, fontSize: 14, color: "var(--brown)", fontWeight: 600 }}>
        No thanks, go home
      </a>
    </main>
  );
}
