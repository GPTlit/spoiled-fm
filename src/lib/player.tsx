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
import {
  updateNativePlayback,
  stopNativePlayback,
  listenToNativeMediaCommands,
} from "./native-mediasession";
import { getAppCoverLogo, recordWatchedVideo } from "./user-preferences";

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
  contentUri?: string;
  isNativeMediaStore?: boolean;
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

export const DB_NAME = "spoiled-local-music";
export const DB_VERSION = 2;

export function openLibrary(): Promise<IDBDatabase> {
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

export async function saveTrackToIdb(track: Track, file: File, pictureBlob?: Blob) {
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

export interface StoredTrackRecord extends Omit<Track, "url" | "pictureUrl"> {
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
  resetEqToDefault: () => void;
  saveCurrentSongEq: () => void;
  stemMode: "normal" | "vocals-only" | "beats-only";
  setStemMode: (mode: "normal" | "vocals-only" | "beats-only") => void;
  exportStemTrack: (track: Track, mode: "vocals-only" | "beats-only") => Promise<Track>;
  addFiles: (files: FileList | File[]) => Promise<number>;
  playTrack: (id: string, list?: string[]) => void;
  toggle: () => void;
  stopPlayback: () => void;
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
  setShuffle: (v: boolean) => void;
  setRepeat: (v: boolean) => void;
  setRepeatOne: (v: boolean) => void;
  enqueue: (id: string) => void;
  removeFromQueue: (i: number) => void;
  moveInQueue: (from: number, to: number) => void;
  toggleLike: (id: string) => void;
  deleteTrack: (id: string) => Promise<void>;
  addNativeTracks: (tracks: Track[]) => void;
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

function bufferToWave(abuffer: AudioBuffer, len: number): Blob {
  const numOfChan = abuffer.numberOfChannels;
  const length = len * numOfChan * 2 + 44;
  const out = new DataView(new ArrayBuffer(length));
  const channels: Float32Array[] = [];
  let offset = 0;
  let pos = 0;

  function setUint16(data: number) {
    out.setUint16(pos, data, true);
    pos += 2;
  }
  function setUint32(data: number) {
    out.setUint32(pos, data, true);
    pos += 4;
  }

  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8);
  setUint32(0x45564157); // "WAVE"
  setUint32(0x20746d66); // "fmt "
  setUint32(16);
  setUint16(1); // PCM
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2);
  setUint16(16); // 16-bit
  setUint32(0x61746164); // "data"
  setUint32(length - pos - 4);

  for (let i = 0; i < abuffer.numberOfChannels; i++) {
    channels.push(abuffer.getChannelData(i));
  }

  while (offset < len) {
    for (let i = 0; i < numOfChan; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i]![offset] || 0));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      out.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([out.buffer], { type: "audio/wav" });
}

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
  const repeatOne = useRef(false);

  // Equalizer State with persistent presets
  const [eqPreset, setEqPresetState] = useState<EqPreset>("Flat");
  const [savedPresetGains, setSavedPresetGains] = useState<Record<EqPreset, number[]>>(() => ({
    Flat: [...EQ_PRESETS.Flat],
    "Bass Boost": [...EQ_PRESETS["Bass Boost"]],
    Vocal: [...EQ_PRESETS.Vocal],
    Acoustic: [...EQ_PRESETS.Acoustic],
    Rock: [...EQ_PRESETS.Rock],
    Electronic: [...EQ_PRESETS.Electronic],
  }));
  const [eqGains, setEqGains] = useState<number[]>([...EQ_PRESETS.Flat]);
  const [stemMode, setStemModeState] = useState<"normal" | "vocals-only" | "beats-only">("normal");

  const decks = useRef<HTMLAudioElement[]>([]);
  const active = useRef(0);
  const fading = useRef(false);
  const fadeFrame = useRef<number | null>(null);

  // Web Audio Context & Biquad Filter Chains
  const audioCtxRef = useRef<AudioContext | null>(null);
  const filterChainsRef = useRef<BiquadFilterNode[][]>([]);

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
              : getAppCoverLogo();
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

  // Initialize Web Audio Filter Chain
  const initAudioNodes = useCallback(() => {
    if (audioCtxRef.current || typeof window === "undefined") return;
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;

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

          // Chain filters: source -> filter0 -> filter1 ... -> destination
          source.connect(filters[0]!);
          for (let f = 0; f < filters.length - 1; f++) {
            filters[f]!.connect(filters[f + 1]!);
          }
          filters[filters.length - 1]!.connect(ctx.destination);

          if (!filterChainsRef.current[deckIdx]) {
            filterChainsRef.current[deckIdx] = filters;
          }
        } catch {
          // Audio routing in test or locked environment
        }
      });
    } catch {
      // AudioContext not allowed or mock
    }
  }, []);

  // Session-only current song custom EQ overrides
  const [currentSongEqMap, setCurrentSongEqMap] = useState<Record<string, number[]>>({});

  const applyGainsToAudioChain = useCallback((gains: number[]) => {
    filterChainsRef.current.forEach((chain) => {
      chain.forEach((filter, i) => {
        if (filter && typeof gains[i] === "number") {
          filter.gain.value = gains[i]!;
        }
      });
    });
  }, []);

  const setEqPreset = useCallback((preset: EqPreset) => {
    setEqPresetState(preset);
    const gains = savedPresetGains[preset] || EQ_PRESETS[preset] || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    setEqGains([...gains]);
    applyGainsToAudioChain(gains);
  }, [savedPresetGains, applyGainsToAudioChain]);

  const setEqGain = useCallback((bandIndex: number, gain: number) => {
    // Preserve current preset without reverting to Flat!
    setEqGains((prev) => {
      const next = [...prev];
      next[bandIndex] = gain;
      applyGainsToAudioChain(next);
      return next;
    });
    setSavedPresetGains((prev) => {
      const presetArr = prev[eqPreset]
        ? [...prev[eqPreset]]
        : [...(EQ_PRESETS[eqPreset] || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0])];
      presetArr[bandIndex] = gain;
      return {
        ...prev,
        [eqPreset]: presetArr,
      };
    });
  }, [eqPreset, applyGainsToAudioChain]);

  const resetEqToDefault = useCallback(() => {
    const defaultGains = [...EQ_PRESETS[eqPreset]];
    setSavedPresetGains((prev) => ({
      ...prev,
      [eqPreset]: [...defaultGains],
    }));
    setEqGains([...defaultGains]);
    applyGainsToAudioChain(defaultGains);
    if (current?.id) {
      setCurrentSongEqMap((prev) => {
        const next = { ...prev };
        delete next[current.id];
        return next;
      });
    }
  }, [eqPreset, current?.id, applyGainsToAudioChain]);

  const saveCurrentSongEq = useCallback(() => {
    if (!current?.id) return;
    setCurrentSongEqMap((prev) => ({
      ...prev,
      [current.id]: [...eqGains],
    }));
  }, [current?.id, eqGains]);

  const setStemMode = useCallback((mode: "normal" | "vocals-only" | "beats-only") => {
    setStemModeState(mode);
    if (mode === "vocals-only") {
      // Isolate vocal frequencies: attenuate sub-bass and ultra-highs, boost mids
      const vocalGains = [-14, -12, -6, 2, 6, 6, 4, 0, -6, -14];
      applyGainsToAudioChain(vocalGains);
    } else if (mode === "beats-only") {
      // Attenuate mid vocal range (300Hz-3kHz), boost punchy low end and hi-hats
      const beatGains = [8, 7, 5, 0, -14, -16, -12, 2, 5, 4];
      applyGainsToAudioChain(beatGains);
    } else {
      applyGainsToAudioChain(eqGains);
    }
  }, [applyGainsToAudioChain, eqGains]);

  const exportStemTrack = useCallback(async (track: Track, mode: "vocals-only" | "beats-only"): Promise<Track> => {
    const res = await fetch(track.url);
    const arrayBuffer = await res.arrayBuffer();
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const tempCtx = new AudioContextClass();
    const decoded = await tempCtx.decodeAudioData(arrayBuffer);
    await tempCtx.close();

    const sampleRate = decoded.sampleRate;
    const length = decoded.length;
    const numChannels = decoded.numberOfChannels;

    const leftIn = decoded.getChannelData(0);
    const rightIn = numChannels > 1 ? decoded.getChannelData(1) : leftIn;

    const offlineCtx = new OfflineAudioContext(2, length, sampleRate);
    const processedBuffer = offlineCtx.createBuffer(2, length, sampleRate);
    const leftOut = processedBuffer.getChannelData(0);
    const rightOut = processedBuffer.getChannelData(1);

    if (mode === "vocals-only") {
      // Center isolate (vocals)
      for (let i = 0; i < length; i++) {
        const mid = (leftIn[i]! + rightIn[i]!) * 0.5;
        const side = (leftIn[i]! - rightIn[i]!) * 0.5;
        const v = mid * 1.3 - side * 0.2;
        leftOut[i] = v;
        rightOut[i] = v;
      }
    } else {
      // Beat isolate / vocal cancellation (L - R)
      for (let i = 0; i < length; i++) {
        const side = (leftIn[i]! - rightIn[i]!) * 0.6;
        leftOut[i] = side;
        rightOut[i] = -side;
      }
    }

    const sourceNode = offlineCtx.createBufferSource();
    sourceNode.buffer = processedBuffer;

    if (mode === "vocals-only") {
      const hp = offlineCtx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 260;
      const lp = offlineCtx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 3600;
      sourceNode.connect(hp);
      hp.connect(lp);
      lp.connect(offlineCtx.destination);
    } else {
      const bass = offlineCtx.createBiquadFilter();
      bass.type = "lowshelf";
      bass.frequency.value = 180;
      bass.gain.value = 8;
      sourceNode.connect(bass);
      bass.connect(offlineCtx.destination);
    }

    sourceNode.start(0);
    const rendered = await offlineCtx.startRendering();
    const wavBlob = bufferToWave(rendered, rendered.length);

    const suffix = mode === "vocals-only" ? "Vocals (Acapella)" : "Beats (Instrumental)";
    const fileName = `${track.title} [${suffix}].wav`;
    const newFile = new File([wavBlob], fileName, { type: "audio/wav" });
    const newUrl = URL.createObjectURL(newFile);

    const defaultCover = getAppCoverLogo();
    const newTrack: Track = {
      id: crypto.randomUUID(),
      title: `${track.title} [${suffix}]`,
      artist: track.artist,
      album: `${track.album || "Spoiled"} (${suffix})`,
      duration: rendered.duration,
      url: newUrl,
      pictureUrl: track.pictureUrl || defaultCover,
      hasEmbeddedPicture: track.hasEmbeddedPicture,
      hue: (track.hue + 45) % 360,
    };

    await saveTrackToIdb(newTrack, newFile);
    setLibrary((prev) => [newTrack, ...prev]);
    return newTrack;
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

      const from = d[active.current]!;
      const shouldFade = fadeSeconds > 0 && !from.paused;
      const toIdx = shouldFade ? 1 - active.current : active.current;
      const to = d[toIdx]!;
      to.src = track.url;
      const vol = stateRef.current.volume;

      if (shouldFade) {
        fading.current = true;
        to.volume = 0;
        void to.play().catch(() => {
          from.pause();
          from.currentTime = 0;
          fading.current = false;
        });
        const ms = Math.max(
          250,
          Math.min(fadeSeconds, from.duration - from.currentTime || fadeSeconds) * 1000,
        );
        const start = performance.now();
        const step = (now: number) => {
          if (!fading.current) return;
          const p = Math.min(1, (now - start) / ms);
          to.volume = vol * Math.sin((p * Math.PI) / 2);
          from.volume = vol * Math.cos((p * Math.PI) / 2);
          if (p < 1) {
            fadeFrame.current = requestAnimationFrame(step);
          } else {
            from.pause();
            from.currentTime = 0;
            from.volume = vol;
            fading.current = false;
            fadeFrame.current = null;
          }
        };
        fadeFrame.current = requestAnimationFrame(step);
        active.current = toIdx;
      } else {
        // Immediate clean stop of all other decks to prevent two songs playing together
        d.forEach((a, i) => {
          if (i !== toIdx) {
            a.pause();
            a.currentTime = 0;
            a.volume = vol;
          }
        });
        to.volume = vol;
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

      // Auto-record to monthly watch/listening history
      recordWatchedVideo({
        id: t.id,
        title: t.title,
        channel: t.artist,
        thumbnail: t.pictureUrl || getAppCoverLogo(),
        duration: fmt(t.duration || 0),
      });

      // Apply song-specific session EQ if user temporarily adjusted and saved it
      if (currentSongEqMap[t.id]) {
        const songGains = currentSongEqMap[t.id]!;
        setEqGains([...songGains]);
        applyGainsToAudioChain(songGains);
      } else {
        const presetGains = savedPresetGains[eqPreset] || EQ_PRESETS[eqPreset];
        setEqGains([...presetGains]);
        applyGainsToAudioChain(presetGains);
      }
    },
    [loadOnDeck, currentSongEqMap, savedPresetGains, eqPreset, applyGainsToAudioChain],
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

      if (
        typeof navigator !== "undefined" &&
        "mediaSession" in navigator &&
        "setPositionState" in navigator.mediaSession &&
        isFinite(a.duration) &&
        a.duration > 0
      ) {
        try {
          navigator.mediaSession.setPositionState({
            duration: Math.max(0, a.duration),
            playbackRate: 1,
            position: Math.min(Math.max(0, a.currentTime), a.duration),
          });
        } catch {
          /* ignore */
        }
      }

      const { crossfade, mixMode, index } = stateRef.current;
      const transition =
        mixMode === "automix" ? Math.min(6, Math.max(1.5, a.duration * 0.06)) : crossfade;
      if (
        !repeatOne.current &&
        !fading.current &&
        !a.paused &&
        a.duration &&
        transition > 0 &&
        a.duration - a.currentTime <= transition &&
        (index + 1 < stateRef.current.queue.length || stateRef.current.repeat)
      ) {
        goTo(index + 1, transition);
      }
    };

    const onEnded = (e: Event) => {
      if (e.target === decks.current[active.current] && repeatOne.current) {
        const a = decks.current[active.current]!;
        a.currentTime = 0;
        void a.play().catch(() => {});
        return;
      }
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
      goTo(stateRef.current.index + 1, 0);
    });

    navigator.mediaSession.setActionHandler("previoustrack", () => {
      goTo(stateRef.current.index - 1, 0);
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

  useEffect(() => {
    if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
      navigator.mediaSession.playbackState = playing ? "playing" : "paused";
    }
  }, [playing]);

  // Synchronize playback state, metadata and artwork with Android MediaSession / Notification / Lock-Screen / Widget
  useEffect(() => {
    if (!current) {
      void stopNativePlayback();
      return;
    }

    void updateNativePlayback({
      title: current.title,
      artist: current.artist,
      album: current.album,
      duration: duration || current.duration || 0,
      position: time || 0,
      isPlaying: playing,
      artworkUrl: current.pictureUrl || getAppCoverLogo(),
    });
  }, [current, playing, duration]);

  // Periodic heartbeat during active playback to update progress in notification & widget
  useEffect(() => {
    if (!playing || !current) return;
    const interval = setInterval(() => {
      void updateNativePlayback({
        title: current.title,
        artist: current.artist,
        album: current.album,
        duration: duration || current.duration || 0,
        position: time || 0,
        isPlaying: true,
        artworkUrl: current.pictureUrl || getAppCoverLogo(),
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [playing, current, duration, time]);

  // Handle incoming control commands from Android system media controls, lock screen, and home-screen widget
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    void listenToNativeMediaCommands((info) => {
      const { action, position } = info;
      const d = decks.current;
      const curDeck = d[active.current];

      if (action === "play") {
        if (curDeck) {
          void curDeck.play().catch(() => {});
          setPlaying(true);
        }
      } else if (action === "pause") {
        if (curDeck) {
          curDeck.pause();
          setPlaying(false);
        }
      } else if (action === "next") {
        goTo(stateRef.current.index + 1, 0);
      } else if (action === "prev") {
        if (curDeck && curDeck.currentTime > 3) {
          curDeck.currentTime = 0;
        } else {
          goTo(stateRef.current.index - 1, 0);
        }
      } else if (action === "seek" && typeof position === "number") {
        if (curDeck) {
          curDeck.currentTime = Math.max(0, Math.min(position, curDeck.duration || position));
        }
      }
    }).then((unsub) => {
      cleanup = unsub;
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, [goTo]);

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
      const defaultCover = getAppCoverLogo();
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
        pictureUrl: meta.pictureUrl || defaultCover,
        hasEmbeddedPicture: Boolean(meta.pictureBlob),
        hue: Math.floor(Math.random() * 60) + 20,
      };

      newTracks.push(track);
      void saveTrackToIdb(track, file, meta.pictureBlob).catch(console.error);
    }

    setLibrary((prev) => [...prev, ...newTracks]);
    return newTracks.length;
  };

  const playTrack = (id: string, list?: string[]) => {
    let q = list ?? library.map((t) => t.id);
    if (shuffle) q = [id, ...q.filter((x) => x !== id).sort(() => Math.random() - 0.5)];
    setQueue(q);
    stateRef.current.queue = q;
    goTo(q.indexOf(id), 0);
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

  const stopPlayback = useCallback(() => {
    if (fadeFrame.current !== null) cancelAnimationFrame(fadeFrame.current);
    fadeFrame.current = null;
    fading.current = false;
    decks.current.forEach((a) => {
      try {
        a.pause();
        a.currentTime = 0;
      } catch {
        // ignore
      }
    });
    setPlaying(false);
    void stopNativePlayback();
  }, []);

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

  const deleteTrack = async (id: string) => {
    // If this track is currently active, stop playback
    const currentActiveId = stateRef.current.queue[stateRef.current.index];
    if (currentActiveId === id) {
      decks.current.forEach((a) => {
        try {
          a.pause();
        } catch {
          /* ignore */
        }
      });
      setPlaying(false);
    }

    // Clean up object URLs
    setLibrary((tracks) => {
      const match = tracks.find((t) => t.id === id);
      if (match?.url) {
        try {
          URL.revokeObjectURL(match.url);
        } catch {
          /* ignore */
        }
      }
      if (match?.pictureUrl) {
        try {
          URL.revokeObjectURL(match.pictureUrl);
        } catch {
          /* ignore */
        }
      }
      return tracks.filter((t) => t.id !== id);
    });

    // Remove from active queue
    setQueue((q) => q.filter((x) => x !== id));

    // Delete from IndexedDB
    try {
      const db = await openLibrary();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("tracks", "readwrite");
        tx.objectStore("tracks").delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (e) {
      console.warn("Could not delete track from IndexedDB:", e);
    }
  };

  const addNativeTracks = useCallback((incoming: Track[]) => {
    const defaultCover = getAppCoverLogo();
    setLibrary((prev) => {
      const existing = new Set(prev.map((t) => t.id));
      const fresh = incoming
        .filter((t) => !existing.has(t.id))
        .map((t) => ({ ...t, pictureUrl: t.pictureUrl || defaultCover }));
      if (!fresh.length) return prev;
      return [...prev, ...fresh];
    });
  }, []);

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
        resetEqToDefault,
        saveCurrentSongEq,
        stemMode,
        setStemMode,
        exportStemTrack,
        addFiles,
        addNativeTracks,
        playTrack,
        toggle,
        stopPlayback,
        next: () => goTo(index + 1, 0),
        prev: () => (time > 3 ? (decks.current[active.current]!.currentTime = 0) : goTo(index - 1, 0)),
        seek: (t) => {
          const a = decks.current[active.current];
          if (a && isFinite(t)) {
            const maxD = isFinite(a.duration) && a.duration > 0 ? a.duration : t;
            const target = Math.max(0, Math.min(t, maxD));
            try {
              a.currentTime = target;
            } catch {
              /* ignore */
            }
            setTime(target);
            if (
              typeof navigator !== "undefined" &&
              "mediaSession" in navigator &&
              "setPositionState" in navigator.mediaSession &&
              isFinite(a.duration) &&
              a.duration > 0
            ) {
              try {
                navigator.mediaSession.setPositionState({
                  duration: Math.max(0, a.duration),
                  playbackRate: 1,
                  position: Math.min(target, a.duration),
                });
              } catch {
                /* ignore */
              }
            }
          }
        },
        setVolume: (v) => {
          setVolumeS(v);
          if (!fading.current) decks.current.forEach((a) => (a.volume = v));
        },
        setCrossfade,
        setMixMode,
        updateTrackInfo,
        setTrackArtwork,
        setShuffle,
        setRepeat,
        setRepeatOne: (v) => {
          repeatOne.current = v;
        },
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
        deleteTrack,
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
