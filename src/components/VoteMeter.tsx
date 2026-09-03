export function VoteMeter({
  neinPct,
  ahoyPct,
  thresholdPct,
  showThreshold = true,
  compact = false,
}: {
  neinPct: number;
  ahoyPct: number;
  thresholdPct: number;
  showThreshold?: boolean;
  compact?: boolean;
}) {
  const height = compact ? 14 : 22;
  return (
    <div>
      <div
        style={{
          height,
          borderRadius: 999,
          background: "var(--beige)",
          border: `2px solid var(--ink)`,
          overflow: "hidden",
          display: "flex",
        }}
      >
        <div
          style={{
            height: "100%",
            background: "var(--ink)",
            transition: "width 300ms cubic-bezier(0,.35,0,1.25)",
            width: `${neinPct}%`,
          }}
        />
        <div style={{ flex: 1, background: "var(--paper)" }} />
        <div
          style={{
            height: "100%",
            background: "var(--red)",
            transition: "width 300ms cubic-bezier(0,.35,0,1.25)",
            width: `${ahoyPct}%`,
          }}
        />
      </div>
      {showThreshold && (
        <div style={{ marginTop: 5, position: "relative", height: 18 }}>
          <div
            style={{
              position: "absolute",
              top: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              left: `${thresholdPct}%`,
              transform: "translateX(-50%)",
            }}
          >
            <div style={{ width: 3, height: 6, background: "var(--ink)" }} />
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--brown)", whiteSpace: "nowrap" }}>
              skip line
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
