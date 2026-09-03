export function VerdictOverlay({
  verdict,
  subline,
  next,
  size = "phone",
}: {
  verdict: "nein" | "ahoy";
  subline: string;
  next?: { title: string; artist: string; thumbUrl: string } | null;
  size?: "phone" | "desktop";
}) {
  const isAhoy = verdict === "ahoy";
  const bg = isAhoy ? "var(--red)" : "var(--ink)";
  const fg = isAhoy ? "var(--beige)" : "var(--yellow)";
  const shadow = isAhoy ? "var(--ink)" : "var(--red)";
  const wordSize = size === "desktop" ? 176 : 88;
  const shadowOffset = size === "desktop" ? 14 : 8;

  return (
    <div
      role="alertdialog"
      aria-label={isAhoy ? "The room kept this song" : "The room skipped this song"}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 28,
        textAlign: "center",
        animation: "nFade 160ms linear",
        background: bg,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: wordSize,
          lineHeight: 0.9,
          letterSpacing: "-0.05em",
          animation: "nStamp 400ms cubic-bezier(0,.35,0,1.25) both",
          color: fg,
          textShadow: `${shadowOffset}px ${shadowOffset}px 0 ${shadow}`,
        }}
      >
        {isAhoy ? "AHOY" : "NEIN"}
      </div>
      <div
        style={{
          marginTop: size === "desktop" ? 34 : 26,
          fontWeight: 700,
          fontSize: size === "desktop" ? 22 : 17,
          maxWidth: size === "desktop" ? 560 : 290,
          textWrap: "pretty",
          color: fg,
        }}
      >
        {subline}
      </div>
      {!isAhoy && next && (
        <div
          style={{
            marginTop: size === "desktop" ? 34 : 30,
            display: "flex",
            alignItems: "center",
            gap: size === "desktop" ? 14 : 12,
            background: "var(--beige)",
            border: "2px solid var(--ink)",
            borderRadius: "var(--radius-md)",
            padding: size === "desktop" ? "14px 20px 14px 14px" : "11px 16px 11px 11px",
            animation: "nRise 400ms cubic-bezier(0,.35,0,1.25) 180ms both",
            boxShadow: `${size === "desktop" ? 8 : 6}px ${size === "desktop" ? 8 : 6}px 0 0 var(--yellow)`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={next.thumbUrl}
            alt=""
            style={{
              width: size === "desktop" ? 64 : 52,
              height: size === "desktop" ? 64 : 52,
              borderRadius: "var(--radius-sm)",
              objectFit: "cover",
              flex: "none",
              border: "1px solid var(--ink)",
            }}
          />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontFamily: "var(--font-hand)", fontSize: size === "desktop" ? 18 : 16, color: "var(--red)" }}>
              up next
            </div>
            <div style={{ fontWeight: 700, fontSize: size === "desktop" ? 18 : 15, color: "var(--ink)" }}>
              {next.title}
            </div>
            <div style={{ fontSize: size === "desktop" ? 13 : 12, color: "var(--brown)" }}>{next.artist}</div>
          </div>
        </div>
      )}
    </div>
  );
}
