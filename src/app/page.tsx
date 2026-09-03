import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function LandingPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        textAlign: "center",
        gap: 4,
      }}
    >
      <Logo height={72} />
      <div style={{ marginTop: 14, fontSize: 20, lineHeight: 1.45, maxWidth: 320 }}>
        Everyone votes. The room decides what plays next.
      </div>

      <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 14, width: "100%", maxWidth: 320 }}>
        <Link
          href="/host/new"
          className="btn btn-primary"
          style={{ padding: "18px 24px", fontSize: 19, textDecoration: "none", textAlign: "center" }}
        >
          Host a room
        </Link>
        <Link
          href="/join"
          className="btn btn-secondary"
          style={{ padding: "16px 24px", fontSize: 17, textDecoration: "none", textAlign: "center", border: "2px solid var(--ink)" }}
        >
          Join a room
        </Link>
      </div>

      <div style={{ marginTop: 28, fontFamily: "var(--font-hand)", fontSize: 16, color: "var(--brown)", maxWidth: 320 }}>
        free, and it works best with everyone in the same room
      </div>
    </main>
  );
}
