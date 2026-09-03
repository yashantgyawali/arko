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

type GuideEntry = { id: string; t: string; a: string; d: string };

/**
 * Guide pills ("party starters", "nepali", ...) are a fixed, curated set —
 * not a free-text query. They used to be implemented by sending a canned
 * query string ("party hits playlist") through YouTube's search.list, which
 * costs 100 quota units per tap, the same as a real search. That's the wrong
 * tool for browsing a small fixed list: every entry below is a specific,
 * hand-picked, pre-verified video (real id, embeddable, actual runtime
 * confirmed via videos.list — 1 unit — before being hardcoded here), so a
 * guide tap costs zero YouTube API quota, ever, key or no key, quota
 * exhausted or not. Only typing an actual search query touches search.list.
 */
export const GUIDE_CATALOG: Record<string, GuideEntry[]> = {
  "party starters": [
    { id: "OPf0YbXqDm0", t: "Uptown Funk", a: "Mark Ronson, Bruno Mars", d: "4:31" },
    { id: "ZbZSe6N_BXs", t: "Happy", a: "Pharrell Williams", d: "4:07" },
    { id: "9bZkp7q19f0", t: "Gangnam Style", a: "PSY", d: "4:13" },
    { id: "pRpeEdMmmQ0", t: "Waka Waka", a: "Shakira", d: "3:31" },
    { id: "TUVcZfQe-Kw", t: "Old Town Road", a: "Lil Nas X", d: "2:38" },
  ],
  "80s": [
    { id: "djV11Xbc914", t: "Take On Me", a: "a-ha", d: "3:48" },
    { id: "Zi_XLOBDo_Y", t: "Billie Jean", a: "Michael Jackson", d: "4:54" },
    { id: "fJ9rUzIMcZQ", t: "Bohemian Rhapsody", a: "Queen", d: "5:59" },
  ],
  "sing along": [
    { id: "fJ9rUzIMcZQ", t: "Bohemian Rhapsody", a: "Queen", d: "5:59" },
    { id: "L_jWHffIx5E", t: "All Star", a: "Smash Mouth", d: "3:56" },
    { id: "nfWlot6h_JM", t: "Shake It Off", a: "Taylor Swift", d: "4:03" },
    { id: "CevxZvSJLk8", t: "Roar", a: "Katy Perry", d: "4:34" },
  ],
  risky: [
    { id: "dQw4w9WgXcQ", t: "Never Gonna Give You Up", a: "Rick Astley", d: "3:33" },
    { id: "L_jWHffIx5E", t: "All Star", a: "Smash Mouth", d: "3:56" },
    { id: "9bZkp7q19f0", t: "Gangnam Style", a: "PSY", d: "4:13" },
  ],
  // Bipul Chettri + Sajjan Raj Vaidya + one contemporary pop pick, per request.
  nepali: [
    { id: "6FEsFvZ-hqY", t: "Dhairya", a: "Sajjan Raj Vaidya", d: "6:34" },
    { id: "suUZbb3zYw8", t: "Mooskaan", a: "Sajjan Raj Vaidya", d: "5:16" },
    { id: "csoXwcbmNLw", t: "Naganya Maya", a: "Sajjan Raj Vaidya", d: "5:21" },
    { id: "XcEC2q4CotY", t: "Sasto Mutu", a: "Sajjan Raj Vaidya", d: "5:03" },
    { id: "tELlvq18e4g", t: "Wildfire (Dadhelo)", a: "Bipul Chettri", d: "3:34" },
    { id: "nw-9nBJ_Tzk", t: "Eh Saathi", a: "Bipul Chettri", d: "4:32" },
    { id: "zb6Ndo0WyVg", t: "Katai Uslai", a: "Bipul Chettri", d: "5:19" },
    { id: "chn_GHs_Hy8", t: "Prakriti", a: "Bipul Chettri", d: "5:05" },
    { id: "HHgUgEUKNl8", t: "Bhaans Ghari", a: "Bipul Chettri", d: "5:12" },
    { id: "MEopSZOPQPY", t: "Bhawana", a: "Bipul Chettri", d: "3:31" },
    { id: "mqhyXNj1JVA", t: "Aashish", a: "Bipul Chettri", d: "5:33" },
    { id: "EQJxzSZM_mI", t: "Laakhau Hajarau", a: "Yabesh Thapa", d: "4:22" },
  ],
  // Narayan Gopal — "Swar Samrat" (Emperor of Voice), 1939-1990.
  "nepali classics": [
    { id: "4xfUFn6mx9g", t: "Euta Manche Ko Mayale Kati", a: "Narayan Gopal", d: "6:18" },
    { id: "x7faDV25Dxs", t: "Yeti Dherai Maya", a: "Narayan Gopal", d: "4:05" },
    { id: "5GwJXq3Jva4", t: "Kehi Mitho Baat Gara", a: "Narayan Gopal", d: "7:47" },
  ],
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

function entryToTrack(x: GuideEntry): Track {
  return {
    videoId: x.id,
    title: x.t,
    artist: x.a,
    durationS: secs(x.d),
    thumbUrl: `https://i.ytimg.com/vi/${x.id}/mqdefault.jpg`,
  };
}

export function demoTrack(id: string): Track {
  const x = DEMO_CATALOG.find((c) => c.id === id)!;
  return entryToTrack(x);
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

/** The one and only source for a guide pill's tracks — see GUIDE_CATALOG. */
export function guideTracks(guide: string): Track[] {
  return (GUIDE_CATALOG[guide] ?? []).map(entryToTrack);
}
