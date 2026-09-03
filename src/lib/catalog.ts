// Fallback catalog used when YOUTUBE_API_KEY isn't configured, so the app
// is runnable out of the box. Swapped for real YouTube search once a key is set.
export const DEMO_CATALOG = [
  { id: "dQw4w9WgXcQ", t: "Never Gonna Give You Up", a: "Rick Astley", d: "3:33" },
  { id: "rYEDA3JcQqw", t: "Rolling in the Deep", a: "Adele", d: "3:48" },
  { id: "OPf0YbXqDm0", t: "Uptown Funk", a: "Mark Ronson, Bruno Mars", d: "4:31" },
  { id: "djV11Xbc914", t: "Take On Me", a: "a-ha", d: "3:48" },
  { id: "fJ9rUzIMcZQ", t: "Bohemian Rhapsody", a: "Queen", d: "5:59" },
  { id: "TUVcZfQe-Kw", t: "Old Town Road", a: "Lil Nas X", d: "2:38" },
  { id: "nfWlot6h_JM", t: "Shake It Off", a: "Taylor Swift", d: "4:03" },
  { id: "Zi_XLOBDo_Y", t: "Billie Jean", a: "Michael Jackson", d: "4:54" },
  { id: "ZbZSe6N_BXs", t: "Happy", a: "Pharrell Williams", d: "4:07" },
  { id: "hT_nvWreIhg", t: "Counting Stars", a: "OneRepublic", d: "4:44" },
  { id: "ktvTqknDobU", t: "Radioactive", a: "Imagine Dragons", d: "4:07" },
  { id: "L_jWHffIx5E", t: "All Star", a: "Smash Mouth", d: "3:56" },
  { id: "60ItHLz5WEA", t: "Faded", a: "Alan Walker", d: "3:32" },
  { id: "JGwWNGJdvx8", t: "Shape of You", a: "Ed Sheeran", d: "4:24" },
  { id: "kJQP7kiw5Fk", t: "Despacito", a: "Luis Fonsi, Daddy Yankee", d: "4:42" },
  { id: "9bZkp7q19f0", t: "Gangnam Style", a: "PSY", d: "4:13" },
  { id: "CevxZvSJLk8", t: "Roar", a: "Katy Perry", d: "4:34" },
  { id: "09R8_2nJtjg", t: "Sugar", a: "Maroon 5", d: "5:01" },
  { id: "RgKAFK5djSk", t: "See You Again", a: "Wiz Khalifa, Charlie Puth", d: "3:58" },
  { id: "pRpeEdMmmQ0", t: "Waka Waka", a: "Shakira", d: "3:31" },
];

export const SEARCH_GUIDES: Record<string, string[]> = {
  "party starters": ["OPf0YbXqDm0", "ZbZSe6N_BXs", "9bZkp7q19f0", "pRpeEdMmmQ0", "TUVcZfQe-Kw"],
  "80s": ["djV11Xbc914", "Zi_XLOBDo_Y", "fJ9rUzIMcZQ"],
  "sing along": ["fJ9rUzIMcZQ", "L_jWHffIx5E", "nfWlot6h_JM", "CevxZvSJLk8"],
  risky: ["dQw4w9WgXcQ", "L_jWHffIx5E", "9bZkp7q19f0"],
};

function secs(d: string): number {
  const [m, s] = d.split(":");
  return Number(m) * 60 + Number(s);
}

export type Track = {
  videoId: string;
  title: string;
  artist: string;
  durationS: number;
  thumbUrl: string;
};

export function demoTrack(id: string): Track {
  const x = DEMO_CATALOG.find((c) => c.id === id)!;
  return {
    videoId: x.id,
    title: x.t,
    artist: x.a,
    durationS: secs(x.d),
    thumbUrl: `https://i.ytimg.com/vi/${x.id}/mqdefault.jpg`,
  };
}

export function demoDefaultResults(): Track[] {
  return [1, 2, 3, 8, 10, 13, 17, 19].map((i) => demoTrack(DEMO_CATALOG[i].id));
}

export function demoSearch(query: string): Track[] {
  const q = query.trim().toLowerCase();
  return DEMO_CATALOG.filter((x) => (x.t + " " + x.a).toLowerCase().includes(q)).map((x) =>
    demoTrack(x.id),
  );
}

export function demoGuide(guide: string): Track[] {
  return (SEARCH_GUIDES[guide] ?? []).map((id) => demoTrack(id));
}
