"use client";

export type GuestScreen = "lobby" | "vote" | "search" | "room";

const TABS: { key: GuestScreen; label: string }[] = [
  { key: "vote", label: "Now playing" },
  { key: "search", label: "Add a song" },
  { key: "room", label: "Room" },
];

export function TabBar({ screen, onChange }: { screen: GuestScreen; onChange: (s: GuestScreen) => void }) {
  return (
    <nav className="tabbar" aria-label="Sections">
      {TABS.map((t) => {
        const active = screen === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className="tabbar-btn"
            aria-current={active ? "page" : undefined}
          >
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
