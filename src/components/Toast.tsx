export function Toast({ text, thumbUrl }: { text: string; thumbUrl?: string | null }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        // clears the vote dock + tab bar + home indicator
        bottom: "calc(128px + var(--safe-b))",
        zIndex: 40,
        maxWidth: 460,
        marginInline: "auto",
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "var(--ink)",
        borderRadius: "var(--radius-md)",
        padding: "12px 14px",
        boxShadow: "6px 6px 0 0 var(--red)",
        animation: "nRise 320ms cubic-bezier(0,.35,0,1.25) both",
      }}
    >
      {thumbUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbUrl}
          alt=""
          style={{ width: 40, height: 40, borderRadius: "var(--radius-sm)", objectFit: "cover", flex: "none" }}
        />
      )}
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 17, color: "var(--yellow)" }}>
        {text}
      </span>
    </div>
  );
}
