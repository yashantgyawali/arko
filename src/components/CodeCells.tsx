"use client";

/** Normalize typed input into a room code. Applied at submit, never per-keystroke. */
export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
}

/**
 * Read-only display of a room code as four chunky cells.
 * Used in the lobby, the host rail, and the invite-prefilled join screen.
 */
export function CodeCells({
  code,
  size = 68,
  fontSize = 30,
  activeFill = "var(--yellow)",
  alwaysFill = false,
}: {
  code: string;
  size?: number;
  fontSize?: number;
  activeFill?: string;
  alwaysFill?: boolean;
}) {
  const chars = code.padEnd(4, " ").slice(0, 4).split("");
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
      {chars.map((ch, i) => (
        <div
          key={i}
          style={{
            height: size,
            border: "2px solid var(--ink)",
            borderRadius: "var(--radius-sm)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize,
            background: ch.trim() || alwaysFill ? activeFill : "var(--paper)",
          }}
        >
          {ch.trim()}
        </div>
      ))}
    </div>
  );
}

/**
 * Editable room code — one real, visible, ordinary text input.
 *
 * Deliberately NOT the four-cells-with-a-transparent-overlay-input trick that
 * was here before. That technique broke on real Android Chrome in two
 * compounding ways:
 *
 *  1. It was a controlled input whose onChange rewrote the value on every
 *     keystroke (uppercase + strip). When the rewritten value differs from
 *     what the IME just committed, React writes back into the element
 *     mid-composition and GBoard drops the character — so typing produced
 *     nothing at all.
 *  2. The input's text was transparent (the cells did the rendering), so
 *     there was no feedback that anything was wrong.
 *
 * So: uppercase is done with CSS (`text-transform`) which does not touch the
 * value, length is bounded by the native `maxLength` rather than a JS slice,
 * and normalization happens once at submit via normalizeCode(). Nothing
 * fights the keyboard.
 */
export function CodeInput({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
}) {
  return (
    <input
      id="room-code-input"
      name="room-code"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSubmit?.();
      }}
      maxLength={4}
      aria-label="Room code"
      placeholder="ABCD"
      inputMode="text"
      autoCapitalize="characters"
      autoCorrect="off"
      autoComplete="off"
      spellCheck={false}
      enterKeyHint="next"
      style={{
        width: "100%",
        height: 76,
        border: "2px solid var(--ink)",
        borderRadius: "var(--radius-md)",
        background: value.trim() ? "var(--yellow)" : "var(--paper)",
        boxShadow: "4px 4px 0 0 var(--ink)",
        fontFamily: "var(--font-display)",
        fontWeight: 800,
        // visual-only uppercase: changing the value here would fight the IME
        textTransform: "uppercase",
        fontSize: 34,
        letterSpacing: "0.38em",
        // letter-spacing adds trailing space after the last glyph; nudge it back
        textIndent: "0.38em",
        textAlign: "center",
        color: "var(--ink)",
        caretColor: "var(--red)",
      }}
    />
  );
}
