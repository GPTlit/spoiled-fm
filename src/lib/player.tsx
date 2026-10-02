import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export type Track = { id: string; title: string; artist: string; album: string; url: string; duration?: number; liked?: boolean; hue: number };

type Ctx = {
  library: Track[];
  queue: string[];
  index: number;
  playing: boolean;
  time: number;
  duration: number;
  volume: number;
  crossfade: number;
  shuffle: boolean;
  repeat: boolean;
  current?: Track;
  addFiles: (files: FileList) => void;
  playTrack: (id: string, list?: string[]) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (t: number) => void;
  setVolume: (v: number) => void;
  setCrossfade: (v: number) => void;
  setShuffle: (v: boolean) => void;
  setRepeat: (v: boolean) => void;
  enqueue: (id: string) => void;
  removeFromQueue: (i: number) => void;
  moveInQueue: (from: number, to: number) => void;
  toggleLike: (id: string) => void;
};

const PlayerCtx = createContext<Ctx | null>(null);
export const usePlayer = () => {
  const c = useContext(PlayerCtx);
  if (!c) throw new Error("PlayerProvider missing");
  return c;
};

function parseName(name: string) {
  const base = name.replace(/\.[^.]+$/, "").replace(/_/g, " ");
  const parts = base.split(" - ");
  if (parts.length >= 2) return { artist: parts[0].trim(), title: parts.slice(1).join(" - ").trim() };
  return { artist: "Unknown artist", title: base.trim() };
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [library, setLibrary] = useState<Track[]>([]);
  const [queue, setQueue] = useState<string[]>([]);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeS] = useState(0.8);
  const [crossfade, setCrossfade] = useState(4);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const decks = useRef<HTMLAudioElement[]>([]);
  const active = useRef(0);
  const fading = useRef(false);
  const stateRef = useRef({ queue, index, library, crossfade, repeat, volume });
  stateRef.current = { queue, index, library, crossfade, repeat, volume };

  const current = library.find((t) => t.id === queue[index]);

  const loadOnDeck = useCallback((track: Track, fade: boolean) => {
    const d = decks.current;
    if (!d.length) return;
    const from = d[active.current];
    const toIdx = fade ? 1 - active.current : active.current;
    const to = d[toIdx];
    to.src = track.url;
    const vol = stateRef.current.volume;
    if (fade && !from.paused) {
      fading.current = true;
      to.volume = 0;
      void to.play();
      const ms = stateRef.current.crossfade * 1000;
      const start = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / ms);
        // equal-power curve
        to.volume = vol * Math.sin((p * Math.PI) / 2);
        from.volume = vol * Math.cos((p * Math.PI) / 2);
        if (p < 1) requestAnimationFrame(step);
        else { from.pause(); from.volume = vol; fading.current = false; }
      };
      requestAnimationFrame(step);
      active.current = toIdx;
    } else {
      d.forEach((a, i) => i !== toIdx && a.pause());
      to.volume = vol;
      void to.play();
      active.current = toIdx;
    }
    setPlaying(true);
  }, []);

  const goTo = useCallback((i: number, fade = false) => {
    const { queue, library, repeat } = stateRef.current;
    let n = i;
    if (n >= queue.length) { if (!repeat) { setPlaying(false); return; } n = 0; }
    if (n < 0) n = 0;
    const t = library.find((x) => x.id === queue[n]);
    if (!t) return;
    setIndex(n);
    loadOnDeck(t, fade);
  }, [loadOnDeck]);

  useEffect(() => {
    const make = () => { const a = new Audio(); a.preload = "auto"; return a; };
    decks.current = [make(), make()];
    const tick = () => {
      const a = decks.current[active.current];
      setTime(a.currentTime);
      setDuration(isFinite(a.duration) ? a.duration : 0);
      const { crossfade, index } = stateRef.current;
      if (!fading.current && !a.paused && a.duration && crossfade > 0 && a.duration - a.currentTime <= crossfade) {
        goTo(index + 1, true);
      }
    };
    const onEnded = (e: Event) => {
      if (e.target === decks.current[active.current] && !fading.current) goTo(stateRef.current.index + 1);
    };
    decks.current.forEach((a) => { a.addEventListener("timeupdate", tick); a.addEventListener("ended", onEnded); });
    return () => decks.current.forEach((a) => a.pause());
  }, [goTo]);

  useEffect(() => {
    if (!current || typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: current.title, artist: current.artist, album: current.album });
    navigator.mediaSession.setActionHandler("nexttrack", () => goTo(stateRef.current.index + 1));
    navigator.mediaSession.setActionHandler("previoustrack", () => goTo(stateRef.current.index - 1));
  }, [current, goTo]);

  const addFiles = (files: FileList) => {
    const added: Track[] = Array.from(files).filter((f) => f.type.startsWith("audio") || /\.(mp3|flac|wav|m4a|ogg|aac)$/i.test(f.name)).map((f) => {
      const { artist, title } = parseName(f.name);
      const folder = (f as File & { webkitRelativePath?: string }).webkitRelativePath?.split("/").slice(-2, -1)[0];
      return { id: crypto.randomUUID(), title, artist, album: folder || "Singles", url: URL.createObjectURL(f), hue: Math.floor(Math.random() * 60) + 20 };
    });
    setLibrary((l) => [...l, ...added]);
  };

  const playTrack = (id: string, list?: string[]) => {
    let q = list ?? library.map((t) => t.id);
    if (shuffle) q = [id, ...q.filter((x) => x !== id).sort(() => Math.random() - 0.5)];
    setQueue(q);
    stateRef.current.queue = q;
    goTo(q.indexOf(id));
  };

  const toggle = () => {
    const a = decks.current[active.current];
    if (!a?.src) { if (library[0]) playTrack(library[0].id); return; }
    if (a.paused) { void a.play(); setPlaying(true); } else { a.pause(); setPlaying(false); }
  };

  return (
    <PlayerCtx.Provider value={{
      library, queue, index, playing, time, duration, volume, crossfade, shuffle, repeat, current,
      addFiles, playTrack, toggle,
      next: () => goTo(index + 1, crossfade > 0),
      prev: () => (time > 3 ? (decks.current[active.current].currentTime = 0) : goTo(index - 1)),
      seek: (t) => { decks.current[active.current].currentTime = t; },
      setVolume: (v) => { setVolumeS(v); decks.current.forEach((a) => (a.volume = v)); },
      setCrossfade, setShuffle, setRepeat,
      enqueue: (id) => setQueue((q) => [...q.slice(0, index + 1), id, ...q.slice(index + 1)]),
      removeFromQueue: (i) => { setQueue((q) => q.filter((_, j) => j !== i)); if (i < index) setIndex(index - 1); },
      moveInQueue: (from, to) => setQueue((q) => { const c = [...q]; const [x] = c.splice(from, 1); c.splice(to, 0, x); return c; }),
      toggleLike: (id) => setLibrary((l) => l.map((t) => (t.id === id ? { ...t, liked: !t.liked } : t))),
    }}>
      {children}
    </PlayerCtx.Provider>
  );
}

export const fmt = (s: number) => (!s || !isFinite(s) ? "0:00" : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`);
