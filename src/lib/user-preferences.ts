export interface WatchedVideo {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration?: string;
  watchedAt: number;
  lastTimestamp?: number;
}

const SEARCH_HISTORY_KEY = "spoiled_search_freq_v1";
const WATCH_HISTORY_KEY = "spoiled_watch_history_v1";
const APP_TITLE_KEY = "spoiled_app_title";
const APP_LOGO_KEY = "spoiled_app_logo";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function recordSearchTerm(term: string) {
  if (!term || typeof window === "undefined") return;
  const clean = term.trim().toLowerCase();
  if (clean.length < 2) return;

  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    const map: Record<string, { term: string; count: number; lastUsed: number }> = raw
      ? JSON.parse(raw)
      : {};

    const existing = map[clean] || { term: term.trim(), count: 0, lastUsed: Date.now() };
    map[clean] = {
      term: term.trim(),
      count: existing.count + 1,
      lastUsed: Date.now(),
    };

    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn("Could not save search history", err);
  }
}

export function getFrequentSearchTerms(limit = 6): string[] {
  if (typeof window === "undefined")
    return ["Music", "Jazz", "Lo-Fi", "Synthwave", "Live Mix", "Acoustic"];
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!raw) return ["Music", "Jazz", "Lo-Fi", "Synthwave", "Live Mix", "Acoustic"];
    const map: Record<string, { term: string; count: number; lastUsed: number }> = JSON.parse(raw);
    const sorted = Object.values(map)
      .sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed)
      .map((item) => item.term);

    // Merge with defaults if few
    const defaults = ["Jazz", "Lo-Fi", "Synthwave", "Beats", "Acoustic", "Live"];
    const set = new Set([...sorted, ...defaults]);
    return Array.from(set).slice(0, limit);
  } catch {
    return ["Music", "Jazz", "Lo-Fi", "Synthwave", "Live Mix", "Acoustic"];
  }
}

export function recordWatchedVideo(video: {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration?: string;
  lastTimestamp?: number;
}) {
  if (typeof window === "undefined" || !video.id) return;
  try {
    const raw = localStorage.getItem(WATCH_HISTORY_KEY);
    let list: WatchedVideo[] = raw ? JSON.parse(raw) : [];

    // Monthly auto-clearing: purge anything older than 30 days
    const now = Date.now();
    list = list.filter((item) => now - item.watchedAt < THIRTY_DAYS_MS);

    // Remove duplicates
    list = list.filter((item) => item.id !== video.id);

    // Prepend fresh record
    list.unshift({
      ...video,
      watchedAt: now,
    });

    // Cap at 100 entries
    if (list.length > 100) list = list.slice(0, 100);

    localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn("Could not save watch history", err);
  }
}

export function getWatchHistory(): WatchedVideo[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WATCH_HISTORY_KEY);
    if (!raw) return [];
    const list: WatchedVideo[] = JSON.parse(raw);
    const now = Date.now();
    // Auto-clean on read as well
    const pruned = list.filter((item) => now - item.watchedAt < THIRTY_DAYS_MS);
    if (pruned.length !== list.length) {
      localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(pruned));
    }
    return pruned;
  } catch {
    return [];
  }
}

export function clearWatchHistory() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(WATCH_HISTORY_KEY);
}

export function saveLastTimestamp(videoId: string, seconds: number) {
  if (typeof window === "undefined" || !videoId) return;
  try {
    localStorage.setItem(`spoiled_ts_${videoId}`, Math.floor(seconds).toString());
  } catch (e) {
    void e;
  }
}

export function getLastTimestamp(videoId: string): number {
  if (typeof window === "undefined" || !videoId) return 0;
  try {
    const val = localStorage.getItem(`spoiled_ts_${videoId}`);
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

export function getAppTitle(): string {
  if (typeof window === "undefined") return "SPOILED";
  return localStorage.getItem(APP_TITLE_KEY) || "SPOILED";
}

export function setAppTitle(title: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(APP_TITLE_KEY, title);
  document.title = `${title} — Your music, your world`;
}

export function getAppLogo(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(APP_LOGO_KEY);
}

export function setAppLogo(dataUrl: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(APP_LOGO_KEY, dataUrl);
}

export function setFavicon(dataUrl: string) {
  if (typeof window === "undefined") return;
  let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = dataUrl;
}
