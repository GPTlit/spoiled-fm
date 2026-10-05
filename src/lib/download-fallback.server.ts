// Fallback downloader used only after the primary /api/video/download path fails.
// It asks public Piped / Invidious mirrors for a stream and proxies the bytes back,
// so it works the same whether the listener is signed in or not.

const PIPED = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://api.piped.private.coffee",
  "https://pipedapi.r4fo.com",
];
const INVIDIOUS = [
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://yewtu.be",
  "https://invidious.private.coffee",
  "https://iv.ggtyler.dev",
];

type Candidate = { url: string; mime: string };

async function getJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "user-agent": "Mozilla/5.0" } });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function fromPiped(base: string, id: string, type: string): Promise<Candidate[]> {
  const data = (await getJson(`${base}/streams/${id}`)) as {
    audioStreams?: { url: string; mimeType: string; bitrate: number }[];
    videoStreams?: { url: string; mimeType: string; videoOnly: boolean; height?: number }[];
  };
  if (type === "audio") {
    return (data.audioStreams ?? [])
      .sort((a, b) => b.bitrate - a.bitrate)
      .map((s) => ({ url: s.url, mime: s.mimeType }));
  }
  return (data.videoStreams ?? [])
    .filter((s) => !s.videoOnly)
    .sort((a, b) => (b.height ?? 0) - (a.height ?? 0))
    .map((s) => ({ url: s.url, mime: s.mimeType }));
}

async function fromInvidious(base: string, id: string, type: string): Promise<Candidate[]> {
  const data = (await getJson(`${base}/api/v1/videos/${id}?local=true`)) as {
    adaptiveFormats?: { url: string; type: string; bitrate?: string }[];
    formatStreams?: { url: string; type: string }[];
  };
  const abs = (u: string) => (u.startsWith("http") ? u : `${base}${u}`);
  if (type === "audio") {
    return (data.adaptiveFormats ?? [])
      .filter((f) => f.type.startsWith("audio/"))
      .sort((a, b) => Number(b.bitrate ?? 0) - Number(a.bitrate ?? 0))
      .map((f) => ({ url: abs(f.url), mime: f.type.split(";")[0] ?? "audio/mp4" }));
  }
  return (data.formatStreams ?? []).map((f) => ({
    url: abs(f.url),
    mime: f.type.split(";")[0] ?? "video/mp4",
  }));
}

export async function fallbackDownload(id: string, type: string, title: string) {
  const sources: Array<() => Promise<Candidate[]>> = [
    ...INVIDIOUS.map((b) => () => fromInvidious(b, id, type)),
    ...PIPED.map((b) => () => fromPiped(b, id, type)),
  ];
  for (const source of sources) {
    let candidates: Candidate[] = [];
    try {
      candidates = await source();
    } catch {
      continue;
    }
    for (const c of candidates.slice(0, 3)) {
      try {
        const res = await fetch(c.url, { headers: { "user-agent": "Mozilla/5.0" } });
        if (!res.ok || !res.body) continue;
        const mime = res.headers.get("content-type") || c.mime;
        if (!/audio|video|octet/.test(mime)) continue;
        const ext = mime.includes("webm") ? "webm" : type === "audio" ? "m4a" : "mp4";
        const filename = `${title}.${ext}`;
        const headers = new Headers({
          "content-type": mime,
          "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
          "x-spoiled-ext": ext,
        });
        const len = res.headers.get("content-length");
        if (len) headers.set("content-length", len);
        return new Response(res.body, { headers });
      } catch {
        // try next candidate
      }
    }
  }
  return null;
}
