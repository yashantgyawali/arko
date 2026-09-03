"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { CodeCells, CodeInput, normalizeCode } from "@/components/CodeCells";
import { useAnonAuth } from "@/lib/use-anon-auth";
import { joinRoom } from "@/lib/actions";
import { getSavedName, saveName } from "@/lib/saved-name";

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s — the server didn't respond.`)),
        ms,
      ),
    ),
  ]);
}

export function JoinForm({ initialCode }: { initialCode: string }) {
  const router = useRouter();
  const { ready, error: authError, ensure } = useAnonAuth();
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Arrived from an invite link: the code is settled, so the only thing left
  // to do is say who you are. Don't make them re-key what the link carried.
  const [codeFromLink, setCodeFromLink] = useState(initialCode.length === 4);
  const [hydrated, setHydrated] = useState(false);

  // Proves React actually mounted on this device. If the badge below never
  // says "ready", the button has no handler and no amount of tapping will work.
  useEffect(() => {
    setHydrated(true);
    (window as unknown as { __arkoHydrated?: boolean }).__arkoHydrated = true;
  }, []);

  // Read the remembered name after mount, not as the initial state — this
  // page is server-rendered, and localStorage isn't available there. Setting
  // it as the very first useState value would make the client's first paint
  // disagree with the server-rendered HTML (a hydration mismatch); updating
  // it a moment after mount instead is a perfectly ordinary re-render.
  useEffect(() => {
    const saved = getSavedName();
    if (saved) setName(saved);
  }, []);

  // normalize once, here — never inside onChange, which would fight the IME
  const cleanCode = normalizeCode(code);
  const codeReady = cleanCode.length === 4;
  const nameReady = name.trim().length > 0;

  const hint = !codeReady
    ? "Enter the 4-character room code."
    : !nameReady
      ? "Add your name so the room knows who you are."
      : null;

  /**
   * The button is never disabled except while a join is in flight.
   *
   * A disabled control cannot explain itself — people tap it, nothing happens,
   * and there is nowhere for a reason to appear. Every precondition is checked
   * here instead, so there is always a visible answer.
   */
  async function doJoin() {
    if (busy) return;
    setError(null);

    if (!codeReady) {
      setError(
        cleanCode.length === 0
          ? "Enter the room code first."
          : `That code is ${cleanCode.length} of 4 characters. Room codes are 4 letters or numbers.`,
      );
      return;
    }
    if (!nameReady) {
      setError("Add your name so the room knows who you are.");
      return;
    }

    setBusy(true);
    try {
      // Without a timeout a hung request leaves the button stuck on "Joining…"
      // forever with nothing on screen — indistinguishable from a dead button.
      const userId = ready ? true : await withTimeout(ensure(), 10000, "Connecting");
      if (!userId) {
        setError(authError ?? "Couldn't connect. Check your connection and try again.");
        setBusy(false);
        return;
      }
      const room = await withTimeout(joinRoom(cleanCode, name.trim()), 12000, "Joining");
      saveName(name.trim());
      router.push(`/room/${room.code}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err ?? "");
      setError(
        message.toLowerCase().includes("not found")
          ? "No room with that code. Check it with the host."
          : // surface the real message — a vague failure teaches nobody anything
            `Couldn't join: ${message || "unknown error"}`,
      );
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "var(--app-h)",
        display: "flex",
        flexDirection: "column",
        padding: "56px 24px calc(24px + var(--safe-b))",
        maxWidth: 440,
        margin: "0 auto",
      }}
    >
      <Logo height={56} />
      <div style={{ marginTop: 14, fontSize: 19, lineHeight: 1.45, maxWidth: 290 }}>
        Everyone votes. The room decides what plays next.
      </div>

      <div style={{ marginTop: 30, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>Room code</span>
        {codeFromLink && (
          <button
            onClick={() => setCodeFromLink(false)}
            className="link-btn"
            style={{ fontSize: 13, fontWeight: 600, color: "var(--red)", textDecoration: "underline" }}
          >
            Change
          </button>
        )}
      </div>
      <div style={{ marginTop: 10 }}>
        {codeFromLink ? (
          <CodeCells code={cleanCode} size={64} fontSize={30} />
        ) : (
          <CodeInput
            value={code}
            // Whitespace only. Safe to strip mid-typing (a keyboard commits any
            // composition before it emits a space), unlike changing case, which
            // is what broke Android input before.
            onChange={(v) => setCode(v.replace(/\s/g, ""))}
            onSubmit={doJoin}
          />
        )}
      </div>

      <label htmlFor="join-name" style={{ marginTop: 24, fontWeight: 700, fontSize: 14 }}>
        Your name
      </label>
      <input
        id="join-name"
        className="field"
        value={name}
        autoFocus={codeFromLink}
        enterKeyHint="go"
        autoComplete="nickname"
        maxLength={24}
        onChange={(e) => setName(e.target.value)}
        placeholder="what should the room call you"
        style={{ marginTop: 8 }}
        onKeyDown={(e) => e.key === "Enter" && doJoin()}
      />

      {(error || authError) && (
        <div role="alert" style={{ marginTop: 14, fontSize: 14, color: "var(--red)", fontWeight: 700 }}>
          {error ?? authError}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 24 }} />

      <button
        className="btn btn-primary"
        disabled={busy}
        onClick={doJoin}
        style={{ width: "100%", padding: "18px 24px", fontSize: 21 }}
      >
        {busy ? "Joining…" : "Join the room"}
      </button>

      {/* Never leave the primary action disabled without saying why. */}
      <div style={{ marginTop: 12, textAlign: "center", fontSize: 13, color: "var(--brown)", fontWeight: 600, minHeight: 20 }}>
        {hint ?? (!ready ? "Connecting…" : codeFromLink ? "You were invited to this room." : "")}
        <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, opacity: 0.75 }}>
          build 6 · {hydrated ? "react ready" : "react NOT mounted"} · {ready ? "signed in" : "no session"}
        </div>
      </div>
    </main>
  );
}
