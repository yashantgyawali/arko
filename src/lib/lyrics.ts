/**
 * Lyrics: matching a queued YouTube video against a lyrics database, and
 * parsing the timed ones.
 *
 * All pure — no fetching, no React, no Supabase — so the API route and the
 * browser can both use it, and so a plain node script can exercise it.
 */

export type LyricLine = { t: number; text: string };

/** "instrumental" is distinct from "none" on purpose: it's a fact about the
 *  song, not a gap in the database, so it's worth saying out loud and worth
 *  never re-checking. */
export type LyricsStatus = "synced" | "plain" | "instrumental" | "none";

export type LrclibCandidate = {
  id: number;
  trackName: string;
  artistName: string;
  duration: number | null;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
};

export type MatchTarget = {
  rawTitle: string;  // the untouched YouTube title
  track: string;     // cleanTrackQuery(...).track
  artist: string;    // cleanTrackQuery(...).artist
  /** Whether `artist` came from somewhere trustworthy — see CleanQuery. */
  artistConfident: boolean;
  durationS: number; // queue_items.duration_s
};

/* ------------------------------------------------------------------ LRC --- */

/** [mm:ss], [mm:ss.xx], [mm:ss.xxx], and [mm:ss:xx] — some writers use a
 *  colon for the fraction. Minutes get three digits because LRC doesn't wrap
 *  them at 60. */
const TIME_TAG = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
const OFFSET_TAG = /^\[offset:\s*([+-]?\d+)\s*\]$/i;

/**
 * LRC text -> lines sorted by time, in absolute seconds.
 *
 * Timed-but-empty lines are kept rather than dropped. "[01:12.00]" with no
 * text is the file saying nothing is sung here, and discarding it leaves the
 * previous line lit through a twenty-second solo.
 */
export function parseLrc(text: string | null | undefined): LyricLine[] {
  if (!text) return [];

  const lines: LyricLine[] = [];
  let offsetS = 0;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const off = line.match(OFFSET_TAG);
    if (off) {
      offsetS = Number(off[1]) / 1000;
      continue;
    }

    // Only the unbroken run of stamps at the very start counts. That's what
    // makes "[ar:Adele]" and a stray "[00:12]" mid-sentence fall through
    // harmlessly instead of being read as timings.
    TIME_TAG.lastIndex = 0;
    const stamps: number[] = [];
    let end = 0;
    let m: RegExpExecArray | null;
    while ((m = TIME_TAG.exec(line)) !== null) {
      if (m.index !== end) break;
      end = m.index + m[0].length;
      const frac = m[3] ?? "";
      // Divide by 10^digits rather than assuming centiseconds: a naive /100
      // reads a 3-digit millisecond field as a 1.5-second error.
      stamps.push(
        Number(m[1]) * 60 +
          Number(m[2]) +
          (frac ? Number(frac) / Math.pow(10, frac.length) : 0),
      );
    }
    if (stamps.length === 0) continue;

    // "[00:12.00][01:30.00] chorus" — one body, two appearances.
    const body = line.slice(end).trim();
    for (const t of stamps) lines.push({ t, text: body });
  }

  // Never trust file order: repeated-chorus stamps arrive out of sequence by
  // construction, and activeLineIndex binary-searches this.
  lines.sort((a, b) => a.t - b.t);

  // LRC's offset is a correction in milliseconds, and positive means "show
  // these earlier". Applying it here means the client receives times that are
  // already correct and its own nudge can never double-apply against it.
  return offsetS === 0
    ? lines
    : lines.map((l) => ({ t: Math.max(0, l.t - offsetS), text: l.text }));
}

/**
 * Index of the last line at or before `t`, or -1 before the first.
 *
 * A stateless binary search rather than a moving cursor, so it is equally
 * right on the first tick after opening the card mid-song, after a resync,
 * and after the guest nudges the offset backwards.
 */
export function activeLineIndex(lines: LyricLine[], t: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].t <= t) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/* ------------------------------------------------------------ similarity --- */

// Words that turn up in YouTube titles and lyrics-database entries with equal
// frequency whatever the song is. They carry no identity, so counting them
// makes everything look similar to everything.
const STOP = new Set([
  "official", "video", "music", "audio", "lyrics", "lyric", "lyrical",
  "hd", "hq", "4k", "8k", "mv", "full", "song", "remastered", "remaster",
  "version", "feat", "ft", "featuring", "the", "and", "with", "original",
  "soundtrack", "theme", "visualizer", "visualiser", "explicit", "new",
]);

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // é -> e, so "Beyoncé" matches "Beyonce"
    // \p{L}\p{N} rather than a-z, and \p{M} with them: a big slice of this
    // app's catalogue is Nepali. An ASCII-only class empties every Devanagari
    // title outright, and dropping marks is nearly as bad — the matras and
    // virama in "न्यौली" are category M, so without them the word
    // shatters into single letters and scores zero against itself.
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): Set<string> {
  const out = new Set<string>();
  for (const w of norm(s).split(" ")) if (w.length > 1 && !STOP.has(w)) out.add(w);
  return out;
}

/**
 * Sørensen–Dice over word sets: 0 shares nothing, 1 is the same words.
 *
 * Word-order-insensitive on purpose — "Adele - Rolling in the Deep" and
 * "Rolling in the Deep · Adele" are one song written two ways.
 */
export function similarity(a: string, b: string): number {
  const A = tokens(a);
  const B = tokens(b);
  if (A.size === 0 || B.size === 0) return 0;
  let hits = 0;
  for (const w of A) if (B.has(w)) hits++;
  return (2 * hits) / (A.size + B.size);
}

/* -------------------------------------------------------------- cleaning --- */

// Bracketed chunks that are production noise rather than part of the name.
// "(Dadhelo)" and "(Live at Wembley)" are deliberately absent: the first is
// genuinely part of the title, the second names a different recording we'd
// rather match than mis-match.
const BRACKET_NOISE =
  /official|video|audio|lyrics?|lyrical|visuali[sz]er|\bhd\b|\b4k\b|\b8k\b|\bmv\b|m\/v|full song|out now|prod\.?\s|copyright|remaster(ed)?|color\s?coded|eng sub/i;

const FEAT = /\s*[([]?\s*(feat\.?|ft\.?|featuring)\s+.*$/i;
const CHANNEL_SUFFIX = /\s*-\s*Topic$|VEVO$|\s+(Official|Music|Records?|TV|Channel)$/i;

// The scrape fallback writes the literal "YouTube" when a video has no owner
// field (api/search/route.ts). It means "we had no channel name", not an
// artist, and searching for it matches everything and nothing.
const NOT_AN_ARTIST = /^(?:youtube|various(?: artists)?|va|unknown|topic)$/i;

export type CleanQuery = {
  track: string;
  artist: string;
  /**
   * True when the artist came from the title's own "Artist - Track" split or
   * from a YouTube auto-generated "<Artist> - Topic" channel. Both name the
   * artist directly. A bare channel name doesn't — an upload by "MUSICRAFT"
   * says nothing about who made the song — so it stays false there.
   */
  artistConfident: boolean;
};

/**
 * A cleaned (track, artist) guess to search with.
 *
 * Only ever the *second* attempt. The raw title is tried first, because a
 * good number of contributed lyrics are filed under the raw YouTube title and
 * timed to that exact upload rather than to the album cut — cleaning up front
 * would throw the better-synced entries away.
 *
 * Nothing here rewrites what's stored or displayed; the queue still shows
 * exactly what YouTube called the video.
 */
export function cleanTrackQuery(title: string, artist: string): CleanQuery {
  const rawTitle = String(title ?? "");

  // A pipe is a hard separator on YouTube ("Song | Movie | Label") and it also
  // breaks the provider's free-text search outright. Fullwidth ｜ too, which
  // is common on Asian-market uploads.
  let t = rawTitle.split(/[|｜]/)[0];

  t = t.replace(/[([{][^)\]}]*[)\]}]/g, (m) => (BRACKET_NOISE.test(m) ? " " : m));
  t = t.replace(FEAT, "");

  // Split at the FIRST dash. Splitting at the last one mangles
  // "Bipul Chettri - Wildfire - Dadhelo".
  let fromTitle = "";
  const dash = t.match(/^(.{1,45}?)\s+[-–—]\s+(.+)$/);
  if (dash) {
    fromTitle = dash[1].trim();
    t = dash[2];
  }

  t = t.replace(/[-–—•·:\s]+$/, "").replace(/\s{2,}/g, " ").trim();

  return { track: t || rawTitle.trim(), ...cleanArtist(fromTitle, String(artist ?? "")) };
}

function cleanArtist(fromTitle: string, channel: string): { artist: string; artistConfident: boolean } {
  // Prefer what the title claims. A cover channel ("Sophie Sings") uploading
  // "Adele - Hello" is about Adele's song; the channel name is not.
  if (fromTitle && !NOT_AN_ARTIST.test(fromTitle)) {
    return { artist: fromTitle, artistConfident: true };
  }

  const ch = channel.trim();
  if (!ch || NOT_AN_ARTIST.test(ch)) return { artist: "", artistConfident: false };

  // "<Artist> - Topic" is YouTube's own auto-generated per-artist channel, so
  // the name in front of it really is the artist.
  const isTopic = /\s*-\s*Topic$/i.test(ch);

  const cleaned = (
    ch
      .replace(CHANNEL_SUFFIX, "")
      // "MarkRonsonVEVO" -> "MarkRonson" -> "Mark Ronson". VEVO channels are
      // concatenated with no spaces, and a substring match against the real
      // spelling finds nothing at all, so the whole tier would contribute
      // zero candidates. Guarding on a *lowercase* left side leaves all-caps
      // names like BTS and NCT alone.
      .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, "$1 $2")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
  return { artist: cleaned, artistConfident: isTopic && cleaned.length > 0 };
}

/* --------------------------------------------------------------- scoring --- */

/** Below this we show nothing. Wrong lyrics are worse than no lyrics. */
export const MIN_SCORE = 70;

/**
 * The title has to actually look like the same song.
 *
 * This floor exists because of a real miss: "Murder Mountain" by Srijana
 * matched "Murder at the 18th St. Garage" by The Mountain Goats, which is
 * 172s against our 173s. Two words in common and a one-second coincidence
 * were enough. The title similarity there is 0.29, so a floor catches it
 * while leaving genuine matches (0.85+) untouched.
 */
const MIN_TRACK_SIM = 0.35;

/** Docked when a trustworthy artist disagrees. A deduction rather than a
 *  veto: lyric-video uploads are filed under the uploader ("Hade Music" for
 *  a Taylor Swift song) and are often the best-timed entry there is, so a
 *  very strong title match is still allowed to carry a mismatched artist. */
const ARTIST_MISMATCH_PENALTY = 35;

/** Past this gap the timings visibly drift by the last chorus, so the entry's
 *  words are still worth showing but its timestamps are not. */
const SYNC_TOLERANCE_S = 15;

/**
 * How good a match a candidate is for the song actually playing.
 *
 * Title and artist are compared separately and never pooled into one bag of
 * words. Pooling them is what let "Mountain" in "The Mountain Goats" satisfy
 * "Murder Mountain" — the candidate's artist was quietly answering for the
 * title. They are different questions and get asked separately.
 *
 * Beyond that, three signals weighted by what they're worth:
 *
 *  - Has synced lyrics. Dominant, because a plain entry can't drive karaoke
 *    at all, so it must never outrank a timed one.
 *  - Duration proximity. Not merely an identity check: a lot of entries were
 *    timed against one specific YouTube upload, so a duration equal to *this
 *    video's* is direct evidence the timestamps fit the audio this room is
 *    hearing. The clean album cut, six seconds shorter, is the same song with
 *    worse sync.
 *  - Title and artist agreement, the title with a hard floor under it.
 */
export function scoreCandidate(c: LrclibCandidate, want: MatchTarget): number {
  if (!c.syncedLyrics && !c.plainLyrics) return -Infinity;

  // Against the raw title as well as the cleaned track, because a good share
  // of entries are filed under the raw YouTube title verbatim.
  const trackSim = Math.max(
    similarity(c.trackName, want.rawTitle),
    similarity(c.trackName, want.track),
  );
  if (trackSim < MIN_TRACK_SIM) return -Infinity;

  const artistSim = want.artist ? similarity(c.artistName, want.artist) : 0;

  let score = c.syncedLyrics ? 100 : 0;

  // duration_s is an int and the provider's is a float — always a tolerance,
  // never equality.
  const dd = Math.abs((c.duration ?? 0) - want.durationS);
  if (dd <= 2) score += 60;
  else if (dd <= 5) score += 45;
  else if (dd <= 10) score += 25;
  else if (dd <= 20) score += 5;
  else score -= 30;

  score += Math.round(trackSim * 40);
  score += Math.round(artistSim * 25);
  if (want.artistConfident && want.artist && artistSim === 0) {
    score -= ARTIST_MISMATCH_PENALTY;
  }

  return score;
}

export type Match = { best: LrclibCandidate | null; status: LyricsStatus };

export function pickBest(candidates: LrclibCandidate[], want: MatchTarget): Match {
  let best: LrclibCandidate | null = null;
  let bestScore = MIN_SCORE - 1;
  for (const c of candidates) {
    if (c.instrumental) continue;
    const s = scoreCandidate(c, want);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }

  if (best) {
    const dd = Math.abs((best.duration ?? 0) - want.durationS);
    // Won on words but not on length: show the words, drop the timings rather
    // than let the highlight walk away from the music.
    if (best.syncedLyrics && dd <= SYNC_TOLERANCE_S) return { best, status: "synced" };
    if (best.plainLyrics) return { best, status: "plain" };
    if (best.syncedLyrics) return { best, status: "synced" };
  }

  // Nothing had words. Before saying "no lyrics", check whether the database
  // is telling us this track *has* no words — a different message for the
  // guest, and one worth caching forever instead of re-asking every week.
  const instrumental = candidates.some(
    (c) =>
      c.instrumental &&
      Math.max(similarity(c.trackName, want.rawTitle), similarity(c.trackName, want.track)) >= 0.5 &&
      Math.abs((c.duration ?? 0) - want.durationS) <= 10,
  );
  return { best: null, status: instrumental ? "instrumental" : "none" };
}
