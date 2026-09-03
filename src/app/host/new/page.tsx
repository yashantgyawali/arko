"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { CodeCells } from "@/components/CodeCells";
import { useAnonAuth } from "@/lib/use-anon-auth";
import { createRoom } from "@/lib/actions";
import { ruleHelp, ruleLabel, type SkipRule } from "@/lib/format";

const RULES: SkipRule[] = ["majority", "two_thirds", "anyone"];

export default function CreateRoomPage() {
  const router = useRouter();
  const { ready } = useAnonAuth();
  const [name, setName] = useState("Sam's kitchen");
  const [rule, setRule] = useState<SkipRule>("majority");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function doCreate() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const room = await createRoom(name.trim() || "the room", rule);
      router.push(`/host/${room.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create a room.");
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 980,
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: 48,
          alignItems: "center",
        }}
        className="host-new-grid"
      >
        <div>
          <div style={{ fontFamily: "var(--font-hand)", fontSize: 28, color: "var(--red)" }}>
            host a night
          </div>
          <Logo height={52} />
          <div style={{ marginTop: 16, fontSize: 22, lineHeight: 1.45, maxWidth: 440 }}>
            Start a room. Everyone in it votes on what plays next.
          </div>

          <div style={{ marginTop: 30, maxWidth: 440, display: "flex", flexDirection: "column", gap: 22 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Room name</div>
              <input
                className="field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="kitchen, deck, road trip"
              />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Skip when</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {RULES.map((r) => {
                  const active = rule === r;
                  return (
                    <button
                      key={r}
                      onClick={() => setRule(r)}
                      className="btn"
                      style={{
                        padding: "11px 18px",
                        fontSize: 14,
                        background: active ? "var(--red)" : "var(--paper)",
                        color: active ? "var(--paper)" : "var(--ink)",
                        boxShadow: active ? "4px 4px 0 0 var(--yellow)" : "none",
                      }}
                    >
                      {ruleLabel(r)}
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop: 10, fontSize: 13, color: "var(--brown)" }}>{ruleHelp(rule)}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
              <button
                onClick={doCreate}
                disabled={!ready || busy}
                className="btn btn-primary"
                style={{ padding: "16px 40px", fontSize: 19 }}
              >
                {busy ? "Creating…" : "Create room"}
              </button>
              <div style={{ fontFamily: "var(--font-hand)", fontSize: 18, color: "var(--brown)" }}>
                music plays from this computer
              </div>
            </div>
            {error && <div style={{ fontSize: 13, color: "var(--red)", fontWeight: 600 }}>{error}</div>}
          </div>
        </div>

        <div
          className="card-thick"
          style={{ padding: 26, boxShadow: "8px 8px 0 0 var(--yellow)" }}
        >
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--brown)" }}>Guests will join with</div>
          <div style={{ marginTop: 12 }}>
            <CodeCells code="" size={64} fontSize={28} alwaysFill />
          </div>
          <div style={{ marginTop: 22, borderTop: "2px dashed #C2B08B", paddingTop: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/player.svg" alt="" style={{ width: 24, height: 24, flex: "none" }} />
              <div style={{ fontSize: 14 }}>Everyone votes. Only you control playback.</div>
            </div>
            <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/youtube.svg" alt="" style={{ width: 24, height: 24, flex: "none" }} />
              <div style={{ fontSize: 14 }}>Songs stream from YouTube, so nothing is stored.</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
