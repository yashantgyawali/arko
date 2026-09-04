"use client";

export type GuestScreen = "lobby" | "vote" | "search" | "room";

function NowPlayingIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="12" width="3.5" height="8" rx="1" fill="currentColor" />
      <rect x="10.25" y="6" width="3.5" height="14" rx="1" fill="currentColor" />
      <rect x="17.5" y="9.5" width="3.5" height="10.5" rx="1" fill="currentColor" />
    </svg>
  );
}

function AddSongIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8V16M8 12H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function RoomIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="8.5" cy="8" r="3" stroke="currentColor" strokeWidth="2" />
      <path d="M2.5 20c0-3.31 2.69-6 6-6s6 2.69 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16.5" cy="9" r="2.4" stroke="currentColor" strokeWidth="2" />
      <path d="M14.8 14.3c2.72.42 4.7 2.78 4.7 5.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const TABS: { key: GuestScreen; label: string; Icon: () => React.JSX.Element }[] = [
  { key: "vote", label: "Now playing", Icon: NowPlayingIcon },
  { key: "search", label: "Add a song", Icon: AddSongIcon },
  { key: "room", label: "Room", Icon: RoomIcon },
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
            <t.Icon />
            <span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
