/**
 * SPOILED — Native & Direct Device Downloader
 *
 * Provides client-side and native Android stream extraction and audio/video download.
 * Runs directly from the phone's/client's IP address (bypassing cloud datacenter IP blocks).
 * Uses Capacitor HTTP when available to avoid CORS restrictions on mobile.
 */

import { saveTrackToIdb, type Track } from "./player";

export interface NativeDownloadParams {
  videoId: string;
  title: string;
  channel?: string;
  thumbnail?: string;
  type: "audio" | "video";
  quality?: string;
  onStatus?: (status: string) => void;
}

export interface NativeDownloadResult {
  success: boolean;
  blob?: Blob;
  ext?: string;
  filename?: string;
  error?: string;
  restricted?: boolean;
  directLinks?: {
    y2mate: string;
    downloader10: string;
    ssyoutube: string;
    original: string;
  };
}

const INVIDIOUS_MIRRORS = [
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://yewtu.be",
  "https://invidious.private.coffee",
  "https://iv.ggtyler.dev",
];

const PIPED_MIRRORS = [
  "https://pipedapi.kavin.rocks",
  "https://api.piped.private.coffee",
  "https://pipedapi.adminforge.de",
  "https://pipedapi.r4fo.com",
];

/**
 * Checks whether the app is currently running inside Capacitor on a native device (e.g. Android).
 */
export function isNativeAndroidApp(): boolean {
  if (typeof window === "undefined") return false;
  const win = window as unknown as {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
    };
  };
  return Boolean(
    win.Capacitor?.isNativePlatform?.() ||
    win.Capacitor?.getPlatform?.() === "android" ||
    win.Capacitor?.getPlatform?.() === "ios",
  );
}

/**
 * Fetch a URL directly using CapacitorHttp (if native) or standard fetch.
 * Bypasses web CORS when executed on native mobile.
 */
async function fetchBinary(url: string, timeoutMs = 25000): Promise<Blob> {
  const win = window as unknown as {
    Capacitor?: {
      Plugins?: {
        CapacitorHttp?: {
          get: (options: {
            url: string;
            responseType?: string;
            headers?: Record<string, string>;
          }) => Promise<{
            data: string | Blob;
            status: number;
          }>;
        };
      };
    };
  };

  const capHttp = win.Capacitor?.Plugins?.CapacitorHttp;

  if (isNativeAndroidApp() && capHttp) {
    try {
      const res = await capHttp.get({
        url,
        responseType: "blob",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        },
      });

      if (res.data instanceof Blob) {
        return res.data;
      } else if (typeof res.data === "string") {
        // Base64 response
        const byteCharacters = atob(res.data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        return new Blob([new Uint8Array(byteNumbers)]);
      }
    } catch {
      // Fallback to fetch
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "*/*",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.blob();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Extract direct media stream URL from Invidious or Piped directly from client's IP.
 */
async function extractClientStream(
  id: string,
  type: "audio" | "video",
  onStatus?: (msg: string) => void,
): Promise<{ streamUrl: string; mime: string; ext: string } | null> {
  // 1. Try Invidious endpoints
  for (const mirror of INVIDIOUS_MIRRORS) {
    try {
      onStatus?.(`Resolving direct stream via ${new URL(mirror).hostname}…`);
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(`${mirror}/api/v1/videos/${id}?local=true`, {
        signal: ctrl.signal,
        headers: { Accept: "application/json" },
      }).finally(() => clearTimeout(t));

      if (res.ok) {
        const data = (await res.json()) as {
          adaptiveFormats?: { url: string; type: string; bitrate?: string }[];
          formatStreams?: { url: string; type: string }[];
        };

        if (type === "audio" && data.adaptiveFormats) {
          const audioFormats = data.adaptiveFormats
            .filter((f) => f.type && f.type.startsWith("audio/"))
            .sort((a, b) => Number(b.bitrate || 0) - Number(a.bitrate || 0));

          if (audioFormats[0]?.url) {
            const rawUrl = audioFormats[0].url;
            const streamUrl = rawUrl.startsWith("http") ? rawUrl : `${mirror}${rawUrl}`;
            const ext =
              audioFormats[0].type.includes("mp4") || audioFormats[0].type.includes("m4a")
                ? "m4a"
                : "mp3";
            return { streamUrl, mime: audioFormats[0].type.split(";")[0] || "audio/mp4", ext };
          }
        }

        if (type === "video" && (data.formatStreams || data.adaptiveFormats)) {
          const videoFormats = (data.formatStreams || [])
            .concat(data.adaptiveFormats || [])
            .filter((f) => f.type && f.type.startsWith("video/mp4"));

          if (videoFormats[0]?.url) {
            const rawUrl = videoFormats[0].url;
            const streamUrl = rawUrl.startsWith("http") ? rawUrl : `${mirror}${rawUrl}`;
            return { streamUrl, mime: "video/mp4", ext: "mp4" };
          }
        }
      }
    } catch {
      // try next
    }
  }

  // 2. Try Piped mirrors
  for (const mirror of PIPED_MIRRORS) {
    try {
      onStatus?.(`Resolving media link via ${new URL(mirror).hostname}…`);
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(`${mirror}/streams/${id}`, {
        signal: ctrl.signal,
        headers: { Accept: "application/json" },
      }).finally(() => clearTimeout(t));

      if (res.ok) {
        const data = (await res.json()) as {
          audioStreams?: { url: string; mimeType: string; bitrate: number }[];
          videoStreams?: { url: string; mimeType: string; videoOnly: boolean }[];
        };

        if (type === "audio" && data.audioStreams && data.audioStreams.length > 0) {
          const sorted = [...data.audioStreams].sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
          const target = sorted[0];
          if (target?.url) {
            const ext =
              target.mimeType.includes("mp4") || target.mimeType.includes("m4a") ? "m4a" : "mp3";
            return {
              streamUrl: target.url,
              mime: target.mimeType.split(";")[0] || "audio/mp4",
              ext,
            };
          }
        }

        if (type === "video" && data.videoStreams && data.videoStreams.length > 0) {
          const prog = data.videoStreams.filter((v) => !v.videoOnly);
          const target = prog[0] || data.videoStreams[0];
          if (target?.url) {
            return {
              streamUrl: target.url,
              mime: target.mimeType.split(";")[0] || "video/mp4",
              ext: "mp4",
            };
          }
        }
      }
    } catch {
      // try next
    }
  }

  return null;
}

/**
 * Downloads audio or video directly using the native device's connection.
 */
export async function downloadViaNativeDevice(
  params: NativeDownloadParams,
): Promise<NativeDownloadResult> {
  const { videoId, title, type, onStatus } = params;
  const cleanTitle = title.replace(/[^\w\s.-]/gi, "").trim() || "spoiled-track";

  onStatus?.("Connecting via client phone network…");

  const streamInfo = await extractClientStream(videoId, type, onStatus);

  if (!streamInfo) {
    return {
      success: false,
      restricted: true,
      error: "Stream restricted by provider. Try direct device download or open link directly.",
      directLinks: {
        y2mate: `https://www.y2mate.com/youtube/${videoId}`,
        downloader10: `https://10downloader.com/download?v=${videoId}`,
        ssyoutube: `https://ssyoutube.com/watch?v=${videoId}`,
        original: `https://www.youtube.com/watch?v=${videoId}`,
      },
    };
  }

  try {
    onStatus?.(`Downloading direct ${type} stream…`);
    const blob = await fetchBinary(streamInfo.streamUrl);
    const filename = `${cleanTitle}.${streamInfo.ext}`;

    return {
      success: true,
      blob,
      ext: streamInfo.ext,
      filename,
    };
  } catch (fetchErr) {
    console.warn("Direct binary fetch failed, attempting browser blob bridge:", fetchErr);
    return {
      success: false,
      restricted: true,
      error: "Stream restricted by provider. Try direct device download or open link directly.",
      directLinks: {
        y2mate: `https://www.y2mate.com/youtube/${videoId}`,
        downloader10: `https://10downloader.com/download?v=${videoId}`,
        ssyoutube: `https://ssyoutube.com/watch?v=${videoId}`,
        original: `https://www.youtube.com/watch?v=${videoId}`,
      },
    };
  }
}

/**
 * Saves a downloaded audio Blob directly into the SPOILED IndexedDB database
 * with metadata, title, artist, and extracted thumbnail.
 */
export async function importNativeAudioToLibrary(params: {
  blob: Blob;
  title: string;
  artist?: string;
  album?: string;
  thumbnailUrl?: string;
  ext?: string;
}): Promise<Track> {
  const {
    blob,
    title,
    artist = "Unknown Artist",
    album = "Single",
    thumbnailUrl,
    ext = "mp3",
  } = params;

  // Attempt to fetch and store thumbnail as pictureBlob
  let pictureBlob: Blob | undefined;
  if (thumbnailUrl) {
    try {
      const imgRes = await fetch(thumbnailUrl);
      if (imgRes.ok) {
        pictureBlob = await imgRes.blob();
      }
    } catch {
      // Ignore artwork fetch failure
    }
  }

  const mime = ext === "m4a" ? "audio/mp4" : "audio/mpeg";
  const file = new File([blob], `${title}.${ext}`, { type: mime });

  const id = `native-dl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const url = URL.createObjectURL(file);
  const pictureUrl = pictureBlob ? URL.createObjectURL(pictureBlob) : undefined;

  const track: Track = {
    id,
    title,
    artist,
    album,
    duration: 180, // estimated until playback metadata fires
    liked: false,
    hue: Math.floor(Math.random() * 60) + 20,
    url,
    pictureUrl,
    hasEmbeddedPicture: Boolean(pictureBlob),
  };

  await saveTrackToIdb(track, file, pictureBlob);
  return track;
}
