import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { extractAudioMetadata } from "./metadata";

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  year?: number;
  genre?: string;
  trackNumber?: number;
  url: string;
  duration?: number;
  liked?: boolean;
  hue: number;
  pictureUrl?: string;
  hasEmbeddedPicture?: boolean;
}

export type EqPreset = "Flat" | "Bass Boost" | "Vocal" | "Acoustic" | "Rock" | "Electronic";

export const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;

export const EQ_PRESETS: Record<EqPreset, number[]> = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  "Bass Boost": [5.5, 4.5, 3.0, 1.0, 0, 0, 0, 0, 0, 0],
  Vocal: [-2.0, -1.0, 0.5, 2.5, 4.0, 4.0, 2.5, 1.0, 0, -1.0],
  Acoustic: [3.5, 2.5, 1.0, 1.0, 2.0, 2.5, 3.0, 3.0, 2.0, 1.0],
  Rock: [4.5, 3.0, 1.0, -1.0, -1.5, 1.0, 2.5, 3.5, 4.5, 4.0],
  Electronic: [4.5, 3.5, 1.5, 0, -1.0, 1.0, 2.5, 3.5, 4.5, 3.5],
};

const DB_NAME = "spoiled-local-music";
const DB_VERSION = 2;

function openLibrary(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      return reject(new Error("indexedDB is not available"));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = request.result;
      if (!db.objectStoreNames.contains("tracks")) {
        db.createObjectStore("tracks", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("playlists")) {
        db.createObjectStore("playlists", { keyPath: "name" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveTrackToIdb(track: Track, file: File, pictureBlob?: Blob) {
  const db = await openLibrary();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("tracks", "readwrite");
    tx.objectStore("tracks").put({
      ...track,
      url: undefined, // Object URLs don't survive reload; recreate on boot
      pictureUrl: undefined,
      file,
      pictureBlob,
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

interface StoredTrackRecord extends Omit<Track, "url" | "pictureUrl"> {
  file: File;
  pictureBlob?: Blob;
}

interface Ctx {
  library: Track[];
  queue: string[];
  index: number;
  playing: boolean;
  time: number;
  duration: number;
  volume: number;
  crossfade: number;
  mixMode: "crossfade" | "automix";
  shuffle: boolean;
  repeat: boolean;
  current: Track | undefined;
  eqPreset: EqPreset;
  eqGains: number[];
  setEqPreset: (preset: EqPreset) => void;
  setEqGain: (bandIndex: number, gain: number) => void;
  addFiles: (files: FileList | File[]) => Promise<number>;
  addTrackWithArtwork: (
    file: File,
    pictureBlob?: Blob,
    metaOverrides?: { title?: string; artist?: string; album?: string },
  ) => Promise<Track>;
  playTrack: (id: string, list?: string[]) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (t: number) => void;
  setVolume: (v: number) => void;
  setCrossfade: (v: number) => void;
  setMixMode: (v: "crossfade" | "automix") => void;
  updateTrackInfo: (
    id: string,
    changes: Pick<Track, "title" | "artist" | "album">,
  ) => Promise<void>;
  setTrackArtwork: (id: string, pictureBlob: Blob) => Promise<void>;
  removeTrack: (id: string) => Promise<void>;
  setShuffle: (v: boolean) => void;
  setRepeat: (v: boolean) => void;
  enqueue: (id: string) => void;
  removeFromQueue: (i: number) => void;
  moveInQueue: (from: number, to: number) => void;
  toggleLike: (id: string) => void;
  exportBackup: () => Promise<string>;
  importBackup: (jsonStr: string) => Promise<boolean>;
  clearLibrary: () => Promise<void>;
}

const PlayerCtx = createContext<Ctx | null>(null);

export const usePlayer = () => {
  const c = useContext(PlayerCtx);
  if (!c) throw new Error("PlayerProvider missing");
  return c;
};

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [library, setLibrary] = useState<Track[]>([]);
  const [queue, setQueue] = useState<string[]>([]);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeS] = useState(0.85);
  const [crossfade, setCrossfade] = useState(4);
  const [mixMode, setMixMode] = useState<"crossfade" | "automix">("crossfade");
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);

  // Equalizer State
  const [eqPreset, setEqPresetState] = useState<EqPreset>("Flat");
  const [eqGains, setEqGains] = useState<number[]>([...EQ_PRESETS.Flat]);

  const decks = useRef<HTMLAudioElement[]>([]);
  const active = useRef(0);
  const fading = useRef(false);
  const fadeFrame = useRef<number | null>(null);

  // Web Audio Context, Gain Nodes & Filter Chains
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodesRef = useRef<GainNode[]>([]);
  const masterGainRef = useRef<GainNode | null>(null);
  const filterChainsRef = useRef<BiquadFilterNode[][]>([]);
  const preloadedTrackId = useRef<string | null>(null);

  const stateRef = useRef({ queue, index, library, crossfade, mixMode, repeat, volume, eqGains });
  stateRef.current = { queue, index, library, crossfade, mixMode, repeat, volume, eqGains };

  const current = library.find((t) => t.id === queue[index]);

  // Load persistent library from IndexedDB on mount
  useEffect(() => {
    let alive = true;
    openLibrary()
      .then((db) => {
        const tx = db.transaction("tracks", "readonly");
        const request = tx.objectStore("tracks").getAll();
        request.onsuccess = () => {
          if (!alive) return;
          const records = request.result as StoredTrackRecord[];
          const restoredTracks: Track[] = records.map((record) => {
            const url = URL.createObjectURL(record.file);
            const pictureUrl = record.pictureBlob
              ? URL.createObjectURL(record.pictureBlob)
              : undefined;
            return {
              id: record.id,
              title: record.title,
              artist: record.artist,
              album: record.album,
              year: record.year,
              genre: record.genre,
              trackNumber: record.trackNumber,
              duration: record.duration,
              liked: record.liked,
              hue: record.hue ?? Math.floor(Math.random() * 60) + 20,
              url,
              pictureUrl,
              hasEmbeddedPicture: Boolean(record.pictureBlob),
            };
          });

          setLibrary((prev) => {
            const existing = new Set(prev.map((t) => t.id));
            const fresh = restoredTracks.filter((t) => !existing.has(t.id));
            return [...fresh, ...prev];
          });
          db.close();
        };
      })
      .catch((err) => {
        if (typeof indexedDB !== "undefined") console.error(err);
      });

    return () => {
      alive = false;
    };
  }, []);

  // Initialize Web Audio Filter Chain with per-deck GainNodes for seamless Apple Music crossfade
  const initAudioNodes = useCallback(() => {
    if (audioCtxRef.current || typeof window === "undefined") return;
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;

      const masterGain = ctx.createGain();
      masterGain.gain.value = stateRef.current.volume;
      masterGain.connect(ctx.destination);
      masterGainRef.current = masterGain;

      decks.current.forEach((audioEl, deckIdx) => {
        try {
          const source = ctx.createMediaElementSource(audioEl);
          const filters = EQ_FREQUENCIES.map((freq, i) => {
            const filter = ctx.createBiquadFilter();
            if (i === 0) {
              filter.type = "lowshelf";
            } else if (i === EQ_FREQUENCIES.length - 1) {
              filter.type = "highshelf";
            } else {
              filter.type = "peaking";
              filter.Q.value = 1.4;
            }
            filter.frequency.value = freq;
            filter.gain.value = stateRef.current.eqGains[i] || 0;
            return filter;
          });

          const deckGain = ctx.createGain();
          deckGain.gain.value = deckIdx === 0 ? 1 : 0;
          gainNodesRef.current[deckIdx] = deckGain;

          // Chain: source -> filters -> deckGain -> masterGain -> destination
          source.connect(filters[0]!);
          for (let f = 0; f < filters.length - 1; f++) {
            filters[f]!.connect(filters[f + 1]!);
          }
          filters[filters.length - 1]!.connect(deckGain);
          deckGain.connect(masterGain);

          if (!filterChainsRef.current[deckIdx]) {
            filterChainsRef.current[deckIdx] = filters;
          }
        } catch {
          // Audio routing in test or restricted environment
        }
      });
    } catch {
      // AudioContext not allowed or unavailable
    }
  }, []);

  const setEqPreset = useCallback((preset: EqPreset) => {
    setEqPresetState(preset);
    const gains = EQ_PRESETS[preset];
    if (gains) {
      setEqGains([...gains]);
      filterChainsRef.current.forEach((chain) => {
        chain.forEach((filter, i) => {
          if (filter && typeof gains[i] === "number") {
            filter.gain.value = gains[i]!;
          }
        });
      });
    }
  }, []);

  const setEqGain = useCallback((bandIndex: number, gain: number) => {
    setEqPresetState("Flat");
    setEqGains((prev) => {
      const next = [...prev];
      next[bandIndex] = gain;
      filterChainsRef.current.forEach((chain) => {
        if (chain[bandIndex]) {
          chain[bandIndex]!.gain.value = gain;
        }
      });
      return next;
    });
  }, []);

  const loadOnDeck = useCallback(
    (track: Track, fadeSeconds: number) => {
      initAudioNodes();
      if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
        void audioCtxRef.current.resume();
      }

      const d = decks.current;
      if (!d.length) return;
      if (fadeFrame.current !== null) cancelAnimationFrame(fadeFrame.current);
      fadeFrame.current = null;
      fading.current = false;

      const fromIdx = active.current;
      const from = d[fromIdx]!;
      const shouldFade = fadeSeconds > 0 && !from.paused && from.currentTime > 0;
      const toIdx = shouldFade ? 1 - fromIdx : fromIdx;
      const to = d[toIdx]!;
      const vol = stateRef.current.volume;

      to.src = track.url;
      to.currentTime = 0;

      if (shouldFade) {
        fading.current = true;
        to.volume = 0;

        const ctx = audioCtxRef.current;
        const now = ctx ? ctx.currentTime : 0;
        const fromGain = gainNodesRef.current[fromIdx];
        const toGain = gainNodesRef.current[toIdx];

        // Apple Music Automix: roll off low-end on outgoing track to prevent muddy clashing
        const fromFilters = filterChainsRef.current[fromIdx];
        if (stateRef.current.mixMode === "automix" && fromFilters?.[0]) {
          try {
            fromFilters[0].gain.cancelScheduledValues(now);
            fromFilters[0].gain.linearRampToValueAtTime(-8, now + fadeSeconds * 0.6);
          } catch {
            /* ignore */
          }
        }

        if (ctx && fromGain && toGain) {
          try {
            fromGain.gain.cancelScheduledValues(now);
            toGain.gain.cancelScheduledValues(now);
            fromGain.gain.setValueAtTime(1, now);
            fromGain.gain.linearRampToValueAtTime(0, now + fadeSeconds);
            toGain.gain.setValueAtTime(0, now);
            toGain.gain.linearRampToValueAtTime(1, now + fadeSeconds);
          } catch {
            /* fallback to audio element volume */
          }
        }

        void to.play().catch(() => {
          from.pause();
          fading.current = false;
        });

        const ms = Math.max(300, fadeSeconds * 1000);
        const start = performance.now();

        const step = (currentNow: number) => {
          if (!fading.current) return;
          const p = Math.min(1, (currentNow - start) / ms);

          // Equal-power sinusoidal crossfade curve
          to.volume = vol * Math.sin((p * Math.PI) / 2);
          from.volume = vol * Math.cos((p * Math.PI) / 2);

          if (p < 1) {
            fadeFrame.current = requestAnimationFrame(step);
          } else {
            from.pause();
            from.volume = vol;
            if (fromGain) fromGain.gain.value = 1;
            // Restore EQ filter baseline
            if (fromFilters?.[0]) {
              fromFilters[0].gain.value = stateRef.current.eqGains[0] || 0;
            }
            fading.current = false;
            fadeFrame.current = null;
          }
        };

        fadeFrame.current = requestAnimationFrame(step);
        active.current = toIdx;
      } else {
        d.forEach((a, i) => i !== toIdx && a.pause());
        to.volume = vol;
        if (gainNodesRef.current[toIdx]) gainNodesRef.current[toIdx].gain.value = 1;
        void to.play().catch(() => {});
        active.current = toIdx;
      }
      setPlaying(true);
    },
    [initAudioNodes],
  );

  const goTo = useCallback(
    (i: number, fadeSeconds = 0) => {
      const { queue, library, repeat } = stateRef.current;
      let n = i;
      if (n >= queue.length) {
        if (!repeat) {
          decks.current[active.current]?.pause();
          setPlaying(false);
          return;
        }
        n = 0;
      }
      if (n < 0) n = 0;
      const t = library.find((x) => x.id === queue[n]);
      if (!t) return;
      setIndex(n);
      loadOnDeck(t, fadeSeconds);
    },
    [loadOnDeck],
  );

  useEffect(() => {
    const make = () => {
      const a = new Audio();
      a.preload = "auto";
      return a;
    };
    decks.current = [make(), make()];

    const tick = () => {
      const a = decks.current[active.current]!;
      setTime(a.currentTime);
      setDuration(isFinite(a.duration) ? a.duration : 0);
      const { crossfade, mixMode, index, queue, library } = stateRef.current;

      // Apple Music Automix: dynamically sets 3s to 8s overlap based on track length
      const transition =
        mixMode === "automix" ? Math.min(8, Math.max(3, (a.duration || 60) * 0.05)) : crossfade;

      // Preload next track audio buffer 2 seconds before crossfade initiates
      const nextIdx = index + 1;
      if (a.duration && a.duration - a.currentTime <= transition + 2 && nextIdx < queue.length) {
        const nextTrack = library.find((x) => x.id === queue[nextIdx]);
        if (nextTrack && preloadedTrackId.current !== nextTrack.id) {
          preloadedTrackId.current = nextTrack.id;
          const nextDeckIdx = 1 - active.current;
          const nextDeck = decks.current[nextDeckIdx];
          if (nextDeck && nextDeck.src !== nextTrack.url) {
            nextDeck.src = nextTrack.url;
            nextDeck.load();
          }
        }
      }

      if (
        !fading.current &&
        !a.paused &&
        a.duration &&
        transition > 0 &&
        a.duration - a.currentTime <= transition &&
        (index + 1 < queue.length || stateRef.current.repeat)
      ) {
        goTo(index + 1, transition);
      }
    };

    const onEnded = (e: Event) => {
      if (e.target === decks.current[active.current] && !fading.current) {
        goTo(stateRef.current.index + 1);
      }
    };

    decks.current.forEach((a) => {
      a.addEventListener("timeupdate", tick);
      a.addEventListener("ended", onEnded);
    });

    return () => {
      if (fadeFrame.current !== null) cancelAnimationFrame(fadeFrame.current);
      decks.current.forEach((a) => a.pause());
    };
  }, [goTo]);

  // MediaSession API Bindings
  useEffect(() => {
    if (!current || typeof navigator === "undefined" || !("mediaSession" in navigator)) return;

    const artworkList: MediaImage[] = [];
    if (current.pictureUrl) {
      artworkList.push({ src: current.pictureUrl, sizes: "512x512", type: "image/jpeg" });
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist,
      album: current.album,
      artwork: artworkList,
    });

    navigator.mediaSession.setActionHandler("play", () => {
      const a = decks.current[active.current];
      if (a) {
        void a.play();
        setPlaying(true);
      }
    });

    navigator.mediaSession.setActionHandler("pause", () => {
      const a = decks.current[active.current];
      if (a) {
        a.pause();
        setPlaying(false);
      }
    });

    navigator.mediaSession.setActionHandler("nexttrack", () => {
      goTo(stateRef.current.index + 1);
    });

    navigator.mediaSession.setActionHandler("previoustrack", () => {
      goTo(stateRef.current.index - 1);
    });

    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (details.seekTime !== undefined && details.seekTime !== null) {
        const a = decks.current[active.current];
        if (a) a.currentTime = details.seekTime;
      }
    });

    navigator.mediaSession.setActionHandler("seekforward", (details) => {
      const a = decks.current[active.current];
      if (a)
        a.currentTime = Math.min(
          a.duration || Infinity,
          a.currentTime + (details.seekOffset || 10),
        );
    });

    navigator.mediaSession.setActionHandler("seekbackward", (details) => {
      const a = decks.current[active.current];
      if (a) a.currentTime = Math.max(0, a.currentTime - (details.seekOffset || 10));
    });
  }, [current, goTo]);

  // Real ID3 extraction pipeline
  const addFiles = async (files: FileList | File[]): Promise<number> => {
    const list = Array.from(files).filter(
      (f) => f.type.startsWith("audio") || /\.(mp3|flac|wav|m4a|ogg|aac|opus|aiff)$/i.test(f.name),
    );
    if (!list.length) return 0;

    const newTracks: Track[] = [];

    for (const file of list) {
      const meta = await extractAudioMetadata(file);
      const url = URL.createObjectURL(file);
      const track: Track = {
        id: crypto.randomUUID(),
        title: meta.title,
        artist: meta.artist,
        album: meta.album,
        year: meta.year,
        genre: meta.genre,
        trackNumber: meta.trackNumber,
        duration: meta.duration,
        url,
        pictureUrl: meta.pictureUrl,
        hasEmbeddedPicture: Boolean(meta.pictureBlob),
        hue: Math.floor(Math.random() * 60) + 20,
      };

      newTracks.push(track);
      void saveTrackToIdb(track, file, meta.pictureBlob).catch(console.error);
    }

    setLibrary((prev) => [...prev, ...newTracks]);
    return newTracks.length;
  };

  const addTrackWithArtwork = async (
    file: File,
    pictureBlob?: Blob,
    metaOverrides?: { title?: string; artist?: string; album?: string },
  ): Promise<Track> => {
    const meta = await extractAudioMetadata(file);
    const url = URL.createObjectURL(file);
    const picBlob = pictureBlob || meta.pictureBlob;
    const track: Track = {
      id: crypto.randomUUID(),
      title: metaOverrides?.title || meta.title,
      artist: metaOverrides?.artist || meta.artist,
      album: metaOverrides?.album || meta.album,
      year: meta.year,
      genre: meta.genre,
      trackNumber: meta.trackNumber,
      duration: meta.duration,
      url,
      pictureUrl: picBlob ? URL.createObjectURL(picBlob) : meta.pictureUrl,
      hasEmbeddedPicture: Boolean(picBlob),
      hue: Math.floor(Math.random() * 60) + 20,
    };

    await saveTrackToIdb(track, file, picBlob);
    setLibrary((prev) => [...prev, track]);
    return track;
  };

  const playTrack = (id: string, list?: string[]) => {
    let q = list ?? library.map((t) => t.id);
    if (shuffle) q = [id, ...q.filter((x) => x !== id).sort(() => Math.random() - 0.5)];
    setQueue(q);
    stateRef.current.queue = q;
    goTo(q.indexOf(id));
  };

  const toggle = () => {
    initAudioNodes();
    const a = decks.current[active.current]!;
    if (!a?.src) {
      if (library[0]) playTrack(library[0].id);
      return;
    }
    if (a.paused) {
      void a.play().catch(() => {});
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  // Export metadata & playlist backup to JSON
  const exportBackup = async (): Promise<string> => {
    const backupData = {
      version: 1,
      appName: "SPOILED",
      exportedAt: new Date().toISOString(),
      tracks: library.map((t) => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        album: t.album,
        year: t.year,
        genre: t.genre,
        liked: t.liked,
      })),
      playlists: JSON.parse(localStorage.getItem("spoiled-playlists") || "[]"),
      lyrics: JSON.parse(localStorage.getItem("spoiled-lyrics") || "{}"),
    };
    return JSON.stringify(backupData, null, 2);
  };

  const importBackup = async (jsonStr: string): Promise<boolean> => {
    try {
      const data = JSON.parse(jsonStr);
      if (data.playlists && Array.isArray(data.playlists)) {
        localStorage.setItem("spoiled-playlists", JSON.stringify(data.playlists));
      }
      if (data.lyrics && typeof data.lyrics === "object") {
        localStorage.setItem("spoiled-lyrics", JSON.stringify(data.lyrics));
      }
      return true;
    } catch {
      return false;
    }
  };

  const clearLibrary = async () => {
    decks.current.forEach((a) => a.pause());
    setPlaying(false);
    setLibrary([]);
    setQueue([]);
    setIndex(-1);
    try {
      const db = await openLibrary();
      const tx = db.transaction("tracks", "readwrite");
      tx.objectStore("tracks").clear();
      tx.oncomplete = () => db.close();
    } catch (e) {
      console.warn("Could not clear IndexedDB library", e);
    }
  };

  const updateTrackInfo = async (
    id: string,
    changes: Pick<Track, "title" | "artist" | "album">,
  ) => {
    const db = await openLibrary();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("tracks", "readwrite");
      const store = tx.objectStore("tracks");
      const request = store.get(id);
      request.onsuccess = () => {
        if (request.result) store.put({ ...request.result, ...changes });
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    setLibrary((tracks) =>
      tracks.map((track) => (track.id === id ? { ...track, ...changes } : track)),
    );
  };

  const setTrackArtwork = async (id: string, pictureBlob: Blob) => {
    const db = await openLibrary();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("tracks", "readwrite");
      const store = tx.objectStore("tracks");
      const request = store.get(id);
      request.onsuccess = () => {
        if (request.result) store.put({ ...request.result, pictureBlob });
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    const pictureUrl = URL.createObjectURL(pictureBlob);
    setLibrary((tracks) =>
      tracks.map((track) =>
        track.id === id ? { ...track, pictureUrl, hasEmbeddedPicture: true } : track,
      ),
    );
  };

  const removeTrack = async (id: string) => {
    if (current?.id === id) {
      if (queue.length > 1) {
        goTo(index + 1);
      } else {
        decks.current.forEach((a) => a.pause());
        setPlaying(false);
      }
    }
    setLibrary((tracks) => tracks.filter((t) => t.id !== id));
    setQueue((q) => q.filter((tId) => tId !== id));
    try {
      const db = await openLibrary();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("tracks", "readwrite");
        const store = tx.objectStore("tracks");
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (e) {
      console.warn("Could not delete track from IndexedDB", e);
    }
  };

  return (
    <PlayerCtx.Provider
      value={{
        library,
        queue,
        index,
        playing,
        time,
        duration,
        volume,
        crossfade,
        mixMode,
        shuffle,
        repeat,
        current,
        eqPreset,
        eqGains,
        setEqPreset,
        setEqGain,
        addFiles,
        addTrackWithArtwork,
        playTrack,
        toggle,
        next: () =>
          goTo(
            index + 1,
            mixMode === "automix" ? Math.min(6, Math.max(1.5, (duration || 60) * 0.06)) : crossfade,
          ),
        prev: () => (time > 3 ? (decks.current[active.current]!.currentTime = 0) : goTo(index - 1)),
        seek: (t) => {
          const a = decks.current[active.current];
          if (a) a.currentTime = t;
        },
        setVolume: (v) => {
          setVolumeS(v);
          if (!fading.current) decks.current.forEach((a) => (a.volume = v));
        },
        setCrossfade,
        setMixMode,
        updateTrackInfo,
        setTrackArtwork,
        removeTrack,
        setShuffle,
        setRepeat,
        enqueue: (id) => setQueue((q) => [...q.slice(0, index + 1), id, ...q.slice(index + 1)]),
        removeFromQueue: (i) => {
          setQueue((q) => q.filter((_, j) => j !== i));
          if (i < index) setIndex(index - 1);
        },
        moveInQueue: (from, to) =>
          setQueue((q) => {
            const c = [...q];
            const [x] = c.splice(from, 1);
            if (x) c.splice(to, 0, x);
            return c;
          }),
        toggleLike: (id) =>
          setLibrary((l) =>
            l.map((t) => {
              if (t.id !== id) return t;
              const updated = { ...t, liked: !t.liked };
              void openLibrary().then((db) => {
                const tx = db.transaction("tracks", "readwrite");
                const request = tx.objectStore("tracks").get(id);
                request.onsuccess = () => {
                  if (request.result) {
                    tx.objectStore("tracks").put({ ...request.result, liked: updated.liked });
                  }
                };
                tx.oncomplete = () => db.close();
              });
              return updated;
            }),
          ),
        exportBackup,
        importBackup,
        clearLibrary,
      }}
    >
      {children}
    </PlayerCtx.Provider>
  );
}

export const fmt = (s: number) =>
  !s || !isFinite(s)
    ? "0:00"
    : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
