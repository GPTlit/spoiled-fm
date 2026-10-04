import { parseBlob } from "music-metadata";

export interface ParsedAudioMetadata {
  title: string;
  artist: string;
  album: string;
  year?: number;
  genre?: string;
  trackNumber?: number;
  duration?: number;
  pictureBlob?: Blob;
  pictureUrl?: string;
}

export function parseFilename(name: string): { title: string; artist: string } {
  // Strip common audio extensions
  const base = name
    .replace(/\.(mp3|flac|wav|m4a|ogg|aac|wma|aiff|opus)$/i, "")
    .replace(/_/g, " ")
    .trim();

  // Check for "Artist - Title" or "TrackNo. Artist - Title" or "TrackNo - Title"
  const cleaned = base.replace(/^\d+[\s.-]+/, "").trim();
  const parts = cleaned.split(/\s*[-–—]\s*/);

  if (parts.length >= 2 && parts[0] && parts[1]) {
    return {
      artist: parts[0].trim(),
      title: parts.slice(1).join(" - ").trim(),
    };
  }

  return {
    artist: "Unknown Artist",
    title: cleaned || base || "Untitled Track",
  };
}

export async function extractAudioMetadata(file: File): Promise<ParsedAudioMetadata> {
  const fallback = parseFilename(file.name);
  const folder = (file as File & { webkitRelativePath?: string }).webkitRelativePath
    ?.split("/")
    .slice(-2, -1)[0];

  try {
    const meta = await parseBlob(file, { duration: true, skipCovers: false });
    const common = meta.common;
    const format = meta.format;

    let pictureBlob: Blob | undefined;
    let pictureUrl: string | undefined;

    const pics = common.picture ?? [];
    const pic = pics.find((x) => /front/i.test(x.type ?? "")) ?? pics[0];
    if (pic && pic.data?.length) {
      pictureBlob = bytesToImageBlob(pic.data, pic.format);
    }
    if (!pictureBlob) pictureBlob = await extractCoverFallback(file);
    if (pictureBlob) pictureUrl = URL.createObjectURL(pictureBlob);

    return {
      title: common.title?.trim() || fallback.title,
      artist: common.artist?.trim() || fallback.artist,
      album: common.album?.trim() || folder || "Singles",
      year: common.year,
      genre: common.genre?.[0],
      trackNumber: common.track?.no ?? undefined,
      duration: format.duration && isFinite(format.duration) ? format.duration : undefined,
      pictureBlob,
      pictureUrl,
    };
  } catch (err) {
    console.warn("Could not read ID3 metadata for", file.name, err);
    const pictureBlob = await extractCoverFallback(file);
    return {
      ...(pictureBlob ? { pictureBlob, pictureUrl: URL.createObjectURL(pictureBlob) } : {}),
      title: fallback.title,
      artist: fallback.artist,
      album: folder || "Singles",
    };
  }
}

function sniffImageMime(b: Uint8Array, hint?: string): string | undefined {
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) return "image/webp";
  if (hint && /^image\//.test(hint)) return hint === "image/jpg" ? "image/jpeg" : hint;
  if (hint === "jpg" || hint === "jpeg") return "image/jpeg";
  if (hint === "png") return "image/png";
  return undefined;
}

function bytesToImageBlob(data: Uint8Array, hint?: string): Blob | undefined {
  // Copy into a fresh ArrayBuffer so offset views from the parser don't leak extra bytes.
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  const mime = sniffImageMime(copy, hint?.toLowerCase());
  return mime ? new Blob([copy.buffer], { type: mime }) : undefined;
}

/** Scan the file bytes for an embedded JPEG/PNG (ID3v2 APIC, MP4 covr, FLAC PICTURE). */
async function extractCoverFallback(file: File): Promise<Blob | undefined> {
  try {
    const head = new Uint8Array(await file.slice(0, Math.min(file.size, 12 * 1024 * 1024)).arrayBuffer());
    // ID3v2 APIC frame
    if (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) {
      const ver = head[3]!;
      const tagSize = ((head[6]! & 0x7f) << 21) | ((head[7]! & 0x7f) << 14) | ((head[8]! & 0x7f) << 7) | (head[9]! & 0x7f);
      let i = 10;
      const end = Math.min(head.length, 10 + tagSize);
      while (i + 10 < end) {
        const id = String.fromCharCode(head[i]!, head[i + 1]!, head[i + 2]!, head[i + 3]!);
        if (!/^[A-Z0-9]{4}$/.test(id)) break;
        const size = ver === 4
          ? ((head[i + 4]! & 0x7f) << 21) | ((head[i + 5]! & 0x7f) << 14) | ((head[i + 6]! & 0x7f) << 7) | (head[i + 7]! & 0x7f)
          : (head[i + 4]! << 24) | (head[i + 5]! << 16) | (head[i + 6]! << 8) | head[i + 7]!;
        if (id === "APIC" && size > 0) {
          const frame = head.subarray(i + 10, i + 10 + size);
          const blob = findImageIn(frame);
          if (blob) return blob;
        }
        i += 10 + size;
      }
    }
    return findImageIn(head);
  } catch {
    return undefined;
  }
}

function findImageIn(b: Uint8Array): Blob | undefined {
  for (let i = 0; i < b.length - 8; i++) {
    if (b[i] === 0xff && b[i + 1] === 0xd8 && b[i + 2] === 0xff) {
      for (let j = i + 4; j < b.length - 1; j++) {
        if (b[j] === 0xff && b[j + 1] === 0xd9 && j - i > 2000) {
          return bytesToImageBlob(b.subarray(i, j + 2), "image/jpeg");
        }
      }
      return undefined;
    }
    if (b[i] === 0x89 && b[i + 1] === 0x50 && b[i + 2] === 0x4e && b[i + 3] === 0x47) {
      for (let j = i + 8; j < b.length - 8; j++) {
        if (b[j] === 0x49 && b[j + 1] === 0x45 && b[j + 2] === 0x4e && b[j + 3] === 0x44) {
          return bytesToImageBlob(b.subarray(i, j + 8), "image/png");
        }
      }
      return undefined;
    }
  }
  return undefined;
}
