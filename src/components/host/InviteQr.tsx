"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { inviteLink } from "@/lib/format";

/**
 * The room code on a screen still has to be read out and typed. A QR is the
 * shortest path from "someone new walked in" to "they're voting", so it needs
 * to be scannable from across a room — hence the blown-up view rather than
 * just a thumbnail on the console.
 *
 * SVG, not canvas: the same markup stays sharp from the 128px inline version
 * to a projector, with nothing to re-render at a second resolution.
 */
export function InviteQr({ code, size = 116 }: { code: string; size?: number }) {
  const [open, setOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  // Whether *we* put this element into fullscreen. Plenty of real contexts
  // refuse the request (embedded webviews, permissions policy, some mobile
  // browsers), and without this the exit listener below would read "nothing
  // is fullscreen" as "the host dismissed it" and tear the overlay down the
  // instant it opened.
  const enteredFullscreenRef = useRef(false);
  const url = inviteLink(code);

  const close = useCallback(() => {
    setOpen(false);
    // Only exit if we're the ones who entered — the host may have put the
    // whole browser into fullscreen themselves, and stealing that back would
    // be rude.
    if (enteredFullscreenRef.current && document.fullscreenElement === overlayRef.current) {
      document.exitFullscreen?.().catch(() => {});
    }
    enteredFullscreenRef.current = false;
  }, []);

  // Escape is the reflex for anything fullscreen. The browser also exits
  // fullscreen on Escape by itself, so this keeps the overlay in step with a
  // dismissal we never handled.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onFullscreenChange = () => {
      if (enteredFullscreenRef.current && !document.fullscreenElement) {
        enteredFullscreenRef.current = false;
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [open, close]);

  const expand = () => {
    setOpen(true);
    // Real fullscreen hides the browser chrome, which is the difference
    // between readable and not when the laptop is across the room. It can be
    // refused (permissions policy, some embedded contexts) — the overlay
    // already covers the viewport, so a refusal costs nothing.
    requestAnimationFrame(() => {
      overlayRef.current
        ?.requestFullscreen?.()
        .then(() => {
          enteredFullscreenRef.current = true;
        })
        .catch(() => {
          // Refused — the overlay already covers the viewport, so the only
          // thing lost is hiding the browser's own chrome.
        });
    });
  };

  return (
    <>
      <button
        onClick={expand}
        aria-label="Show the join QR code fullscreen"
        className="tap"
        style={{
          display: "block",
          padding: size >= 100 ? 10 : 6,
          background: "var(--paper)",
          border: "2px solid var(--ink)",
          borderRadius: "var(--radius-md)",
          cursor: "pointer",
          lineHeight: 0,
        }}
      >
        <QRCodeSVG value={url} size={size} bgColor="#ffffff" fgColor="#130d01" level="M" />
      </button>

      {/* Portalled to <body>, not left in the console tree: the YouTube
          iframe gets promoted to its own compositing layer and painted over
          this overlay — partially covering the QR and making it unscannable —
          even though the overlay sits at a higher z-index. A top-level
          stacking context is the dependable fix. */}
      {open && createPortal(
        <div
          ref={overlayRef}
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Join this room by scanning"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "var(--beige)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "3vmin",
            padding: "4vmin",
            cursor: "zoom-out",
          }}
        >
          <div style={{ fontFamily: "var(--font-hand)", fontSize: "clamp(20px, 4vmin, 44px)", color: "var(--red)" }}>
            scan to join
          </div>

          {/* vmin so it fills the shorter axis on any screen or orientation */}
          <div
            style={{
              background: "var(--paper)",
              padding: "2.5vmin",
              border: "0.6vmin solid var(--ink)",
              borderRadius: "2vmin",
              lineHeight: 0,
            }}
          >
            <QRCodeSVG
              value={url}
              bgColor="#ffffff"
              fgColor="#130d01"
              level="M"
              style={{ width: "58vmin", height: "58vmin", display: "block" }}
            />
          </div>

          {/* The code and the URL stay visible: not every phone camera
              cooperates, and someone across the room may want to type it. */}
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: "clamp(28px, 9vmin, 96px)",
              letterSpacing: "0.14em",
              lineHeight: 1,
            }}
          >
            {code}
          </div>
          <div style={{ fontSize: "clamp(12px, 2.2vmin, 24px)", color: "var(--brown)", fontWeight: 600 }}>
            {url.replace(/^https?:\/\//, "")}
          </div>
          <div style={{ fontSize: "clamp(11px, 1.7vmin, 18px)", color: "var(--brown)", opacity: 0.75 }}>
            Tap anywhere to close
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
