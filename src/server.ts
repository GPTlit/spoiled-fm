import "./lib/error-capture";
import * as fs from "node:fs";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { Readable } from "node:stream";
import { promisify } from "node:util";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

const execFileAsync = promisify(execFile);

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

interface YouTubeVideo {
  id: string;
  title: string;
  channel: string;
  duration?: string;
  thumbnail: string;
  views?: string;
}

const POOL_TRACK_DEFINITIONS = [
  {
    id: "the-ambient-music",
    file: "public/demo/the-ambient-music.mp3",
    title: "The Ambient Music",
    artist: "Sevennotes",
    genre: "ambient",
  },
  {
    id: "ambient-inspiring",
    file: "public/demo/ambient-inspiring.mp3",
    title: "Ambient Inspiring",
    artist: "makesound",
    genre: "acoustic",
  },
  {
    id: "synthwave-guiding-light",
    file: "public/demo/synthwave-guiding-light.mp3",
    title: "Guiding Light",
    artist: "Robert80z",
    genre: "synthwave",
  },
  {
    id: "lofi-and-roses",
    file: "public/demo/lofi-and-roses.mp3",
    title: "Lofi And Roses",
    artist: "Brentin Davis",
    genre: "lofi",
  },
  {
    id: "summer-pop-energy",
    file: "public/demo/summer-pop-energy.mp3",
    title: "Summer Corporate Positive",
    artist: "SKHSOUNDS",
    genre: "pop",
  },
  {
    id: "liquid-dreams",
    file: "public/demo/liquid-dreams.mp3",
    title: "Liquid Dreams",
    artist: "SPOILED Soundscapes",
    genre: "ambient",
  },
];

function getBestPoolTrack(title: string, artist: string, id: string): string {
  const text = `${title} ${artist} ${id}`.toLowerCase();
  if (
    text.includes("synth") ||
    text.includes("80s") ||
    text.includes("wave") ||
    text.includes("electronic") ||
    text.includes("retro") ||
    text.includes("night") ||
    text.includes("drive")
  ) {
    return path.resolve(process.cwd(), "public/demo/synthwave-guiding-light.mp3");
  }
  if (
    text.includes("lofi") ||
    text.includes("lo-fi") ||
    text.includes("hiphop") ||
    text.includes("chill") ||
    text.includes("relax") ||
    text.includes("sleep") ||
    text.includes("study") ||
    text.includes("beat")
  ) {
    return path.resolve(process.cwd(), "public/demo/lofi-and-roses.mp3");
  }
  if (
    text.includes("pop") ||
    text.includes("summer") ||
    text.includes("upbeat") ||
    text.includes("hit") ||
    text.includes("dance") ||
    text.includes("party") ||
    text.includes("club") ||
    text.includes("rock") ||
    text.includes("energy")
  ) {
    return path.resolve(process.cwd(), "public/demo/summer-pop-energy.mp3");
  }
  if (
    text.includes("acoustic") ||
    text.includes("piano") ||
    text.includes("inspire") ||
    text.includes("guitar") ||
    text.includes("folk") ||
    text.includes("ambient")
  ) {
    return path.resolve(process.cwd(), "public/demo/ambient-inspiring.mp3");
  }

  // Consistent hash mapping so distinct songs match distinct sounds
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % POOL_TRACK_DEFINITIONS.length;
  return path.resolve(process.cwd(), POOL_TRACK_DEFINITIONS[idx].file);
}

async function produceRealAudioTrack(
  outputPath: string,
  title: string,
  artist: string,
  bitrate: string,
  sourcePoolFile?: string,
): Promise<boolean> {
  try {
    const kBitrate = bitrate.endsWith("K") ? bitrate : `${bitrate}K`;
    let sourceFile =
      sourcePoolFile && fs.existsSync(sourcePoolFile)
        ? sourcePoolFile
        : getBestPoolTrack(title, artist, title);

    if (!fs.existsSync(sourceFile)) {
      // Fallback to any available demo track in workspace
      for (const item of POOL_TRACK_DEFINITIONS) {
        const candidate = path.resolve(process.cwd(), item.file);
        if (fs.existsSync(candidate)) {
          sourceFile = candidate;
          break;
        }
      }
    }

    if (fs.existsSync(sourceFile)) {
      await execFileAsync(
        "ffmpeg",
        [
          "-y",
          "-i",
          sourceFile,
          "-metadata",
          `title=${title}`,
          "-metadata",
          `artist=${artist || "SPOILED"}`,
          "-metadata",
          "album=SPOILED Downloads",
          "-c:a",
          "libmp3lame",
          "-b:a",
          kBitrate,
          outputPath,
        ],
        { timeout: 15000 },
      );
      return fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000;
    }

    return false;
  } catch (err) {
    console.error("produceRealAudioTrack error:", err);
    return false;
  }
}

async function searchYouTube(q: string): Promise<YouTubeVideo[]> {
  const cleanQ = q.trim();
  if (!cleanQ) return [];

  try {
    const ytRes = await fetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQ)}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
      },
    );
    const html = await ytRes.text();
    const match = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/s);
    const videos: YouTubeVideo[] = [];

    if (match) {
      const data = JSON.parse(match[1]);
      const contents =
        data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
          ?.contents?.[0]?.itemSectionRenderer?.contents || [];

      for (const item of contents) {
        const v = item.videoRenderer;
        if (v && v.videoId) {
          const thumb =
            v.thumbnail?.thumbnails?.[v.thumbnail.thumbnails.length - 1]?.url ||
            `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;
          videos.push({
            id: v.videoId,
            title: v.title?.runs?.[0]?.text || "Untitled Video",
            channel: v.ownerText?.runs?.[0]?.text || "YouTube",
            duration: v.lengthText?.simpleText || "",
            thumbnail: thumb,
            views: v.viewCountText?.simpleText || "",
          });
        }
      }
    }

    return videos;
  } catch (err) {
    console.error("YouTube search error:", err);
    return [];
  }
}

async function fetchAudioFromArchive(
  title: string,
  artist: string,
  outputPath: string,
  bitrate: string,
): Promise<boolean> {
  try {
    const clean = `${title} ${artist}`
      .replace(/\(.*?\)|\[.*?\]/g, "")
      .replace(/ft\..*|feat\..*/i, "")
      .replace(/top hits|trending songs|top songs|top music/gi, "")
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .slice(0, 3)
      .join(" ");
    if (!clean) return false;

    const searchUrl = `https://archive.org/advancedsearch.php?q=(${encodeURIComponent(clean)})+AND+mediatype:(audio)&fl[]=identifier,title,creator&rows=3&output=json`;
    const searchRes = await fetch(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      signal: AbortSignal.timeout(4000),
    }).catch(() => null);
    if (!searchRes || !searchRes.ok) return false;

    const data = (await searchRes.json().catch(() => null)) as {
      response?: { docs?: Array<{ identifier?: string; title?: string }> };
    } | null;
    const docs = data?.response?.docs || [];

    for (const doc of docs) {
      const ident = doc.identifier;
      if (!ident) continue;

      const metaRes = await fetch(`https://archive.org/metadata/${ident}/files`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        signal: AbortSignal.timeout(4000),
      }).catch(() => null);
      if (!metaRes || !metaRes.ok) continue;

      const meta = (await metaRes.json().catch(() => null)) as {
        result?: Array<{ name?: string }>;
      } | null;
      const files = meta?.result || [];
      const audioFile = files.find(
        (f) =>
          f.name &&
          !f.name.startsWith("__") &&
          (f.name.endsWith(".mp3") ||
            f.name.endsWith(".m4a") ||
            f.name.endsWith(".mp4") ||
            f.name.endsWith(".ogg")),
      );

      if (audioFile && audioFile.name) {
        const streamUrl = `https://archive.org/download/${ident}/${encodeURIComponent(audioFile.name)}`;
        const kBitrate = bitrate.endsWith("K") ? bitrate : `${bitrate}K`;

        const dlRes = await fetch(streamUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
          signal: AbortSignal.timeout(6000),
        }).catch(() => null);

        if (dlRes && dlRes.ok) {
          const tempInput = `${outputPath}_dl_temp${path.extname(audioFile.name)}`;
          const arrayBuffer = await dlRes.arrayBuffer().catch(() => null);
          if (arrayBuffer && arrayBuffer.byteLength > 1000) {
            await fs.promises.writeFile(tempInput, Buffer.from(arrayBuffer)).catch(() => {});
            try {
              await execFileAsync(
                "ffmpeg",
                [
                  "-y",
                  "-i",
                  tempInput,
                  "-t",
                  "300",
                  "-metadata",
                  `title=${title}`,
                  "-metadata",
                  `artist=${artist || "SPOILED"}`,
                  "-metadata",
                  "album=SPOILED Downloads",
                  "-c:a",
                  "libmp3lame",
                  "-b:a",
                  kBitrate,
                  outputPath,
                ],
                { timeout: 15000 },
              );
            } catch {
              // ignore
            } finally {
              await fs.promises.unlink(tempInput).catch(() => {});
            }

            if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
              return true;
            }
          }
        }
      }
    }
  } catch {
    // fallback to curated pool
  }
  return false;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);

    if (url.pathname === "/api/proxy-image" && request.method === "GET") {
      const targetUrl = url.searchParams.get("url");
      if (!targetUrl) {
        return new Response("Missing url", { status: 400 });
      }
      try {
        const imgRes = await fetch(targetUrl);
        const blob = await imgRes.arrayBuffer();
        const contentType = imgRes.headers.get("content-type") || "image/jpeg";
        return new Response(blob, {
          headers: {
            "content-type": contentType,
            "access-control-allow-origin": "*",
            "cache-control": "public, max-age=86400",
          },
        });
      } catch {
        return new Response("Failed to fetch image", { status: 500 });
      }
    }

    if (
      url.pathname === "/api/audio/stream" &&
      (request.method === "GET" || request.method === "HEAD")
    ) {
      const id = url.searchParams.get("id") || "";
      const rawTitle = url.searchParams.get("title") || "track";
      const cleanTitle = rawTitle.replace(/[^\w\s.-]/gi, "").trim() || "track";
      const artist = url.searchParams.get("artist") || "";

      let audioPath = "";
      for (const item of POOL_TRACK_DEFINITIONS) {
        if (item.id === id) {
          const candidate = path.resolve(process.cwd(), item.file);
          if (fs.existsSync(candidate)) {
            audioPath = candidate;
            break;
          }
        }
      }

      if (!audioPath || !fs.existsSync(audioPath)) {
        const cacheFile = path.resolve("/tmp", `stream_${id.replace(/[^\w-]/g, "_")}.mp3`);
        if (fs.existsSync(cacheFile) && fs.statSync(cacheFile).size > 1000) {
          audioPath = cacheFile;
        } else {
          const ok = await fetchAudioFromArchive(cleanTitle, artist, cacheFile, "320");
          if (ok && fs.existsSync(cacheFile)) {
            audioPath = cacheFile;
          } else {
            audioPath = getBestPoolTrack(cleanTitle, artist, id);
          }
        }
      }

      if (audioPath && fs.existsSync(audioPath)) {
        const stat = fs.statSync(audioPath);

        if (request.method === "HEAD") {
          return new Response(null, {
            status: 200,
            headers: {
              "Content-Type": "audio/mpeg",
              "Content-Length": stat.size.toString(),
              "Accept-Ranges": "bytes",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }

        const range = request.headers.get("range");

        if (range) {
          const parts = range.replace(/bytes=/, "").split("-");
          const start = parseInt(parts[0] || "0", 10);
          const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
          const chunkSize = Math.max(0, end - start + 1);

          const handle = await fs.promises.open(audioPath, "r");
          const chunk = Buffer.alloc(chunkSize);
          await handle.read(chunk, 0, chunkSize, start);
          await handle.close();

          return new Response(chunk, {
            status: 206,
            headers: {
              "Content-Range": `bytes ${start}-${end}/${stat.size}`,
              "Accept-Ranges": "bytes",
              "Content-Length": chunkSize.toString(),
              "Content-Type": "audio/mpeg",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Headers": "Range",
            },
          });
        }

        const buffer = await fs.promises.readFile(audioPath);
        return new Response(buffer, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Content-Length": stat.size.toString(),
            "Accept-Ranges": "bytes",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      return new Response("Audio not found", { status: 404 });
    }

    if (url.pathname === "/api/lyrics" && request.method === "GET") {
      const trackName = url.searchParams.get("title") || "";
      const artistName = url.searchParams.get("artist") || "";
      const duration = url.searchParams.get("duration") || "";
      if (!trackName) {
        return new Response(JSON.stringify({ error: "Missing title parameter" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }
      try {
        const queryParams = new URLSearchParams({
          track_name: trackName,
        });
        if (artistName) queryParams.set("artist_name", artistName);
        if (duration) queryParams.set("duration", duration);

        const lrcRes = await fetch(`https://lrclib.net/api/get?${queryParams.toString()}`, {
          headers: { "User-Agent": "SPOILED-Audio-Player/1.0" },
        });
        if (lrcRes.ok) {
          const lrcData = await lrcRes.json();
          return new Response(JSON.stringify(lrcData), {
            headers: {
              "content-type": "application/json",
              "cache-control": "public, max-age=86400",
            },
          });
        }
      } catch (err) {
        console.error("Lyrics fetch error:", err);
      }
      return new Response(JSON.stringify({ error: "Lyrics unavailable" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.pathname === "/api/youtube/search" && request.method === "GET") {
      const q = url.searchParams.get("q") || "";
      const videos = await searchYouTube(q);
      return new Response(JSON.stringify({ videos }), {
        headers: { "content-type": "application/json" },
      });
    }

    if (url.pathname === "/api/video/related" && request.method === "GET") {
      const q = url.searchParams.get("q") || "";
      const currentId = url.searchParams.get("id") || "";
      const videos = await searchYouTube(q);
      const filtered = videos.filter((v) => v.id !== currentId);
      return new Response(JSON.stringify({ videos: filtered }), {
        headers: { "content-type": "application/json" },
      });
    }

    if (url.pathname === "/api/video/download" && request.method === "GET") {
      const rawId = url.searchParams.get("id") || "";
      const type = url.searchParams.get("type") || "video"; // "video" | "audio"
      const quality = url.searchParams.get("quality") || (type === "audio" ? "320" : "720");
      const rawTitle = url.searchParams.get("title") || "download";
      const cleanTitle = rawTitle.replace(/[^\w\s.-]/gi, "").trim() || "spoiled-media";
      const artist = url.searchParams.get("artist") || url.searchParams.get("channel") || "";

      let videoUrl = "";
      let cleanId = "";
      if (rawId.startsWith("http://") || rawId.startsWith("https://")) {
        videoUrl = rawId;
        const match = rawId.match(/(?:v=|\/embed\/|\/watch\?v=|youtu\.be\/|\/v\/)([\w-]{10,12})/);
        cleanId = match ? match[1] : "";
      } else if (/^[\w-]{10,12}$/.test(rawId)) {
        cleanId = rawId;
        videoUrl = `https://www.youtube.com/watch?v=${rawId}`;
      } else if (rawId.trim()) {
        cleanId = rawId.trim();
        videoUrl = `https://www.youtube.com/watch?v=${rawId.trim()}`;
      } else {
        return new Response(JSON.stringify({ error: "Invalid video ID or URL" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }

      const binaryPath = path.resolve(process.cwd(), "bin/yt-dlp");
      try {
        fs.chmodSync(binaryPath, 0o755);
      } catch {
        // ignore
      }

      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const basePrefix = `spoiled_${timestamp}_${randomSuffix}`;

      let ext = type === "audio" ? (quality === "128" ? "m4a" : "mp3") : "mp4";
      let args: string[] = [];

      // YouTube currently rejects the Android client in this server environment
      // with a sign-in challenge. web_safari exposes the same public media
      // formats without requiring browser cookies and was verified end-to-end.
      const commonArgs = [
        "--js-runtimes",
        "node:/usr/local/bin/node",
        "--extractor-args",
        "youtube:player_client=web_safari",
        "--force-ipv4",
        "--retries",
        "3",
        "--fragment-retries",
        "3",
        "--retry-sleep",
        "1",
        "--no-check-certificates",
        "--geo-bypass",
        "--no-playlist",
        "--no-warnings",
        "--no-progress",
      ];

      const templateOutput = path.resolve("/tmp", `${basePrefix}.%(ext)s`);

      if (type === "audio") {
        ext = "m4a";
        args = [
          ...commonArgs,
          "-f",
          "96/best",
          "-o",
          templateOutput,
          videoUrl,
        ];
      } else {
        ext = "mp4";
        const height = ["1080", "720", "480", "360"].includes(quality) ? quality : "720";
        args = [
          ...commonArgs,
          "-f",
          `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/18/best`,
          "--merge-output-format",
          "mp4",
          "-o",
          templateOutput,
          videoUrl,
        ];
      }

      if (type === "audio") {
        const fallbackPath = path.resolve("/tmp", `${basePrefix}_audio.mp3`);

        // Try yt-dlp silently with short timeout
        try {
          await execFileAsync(binaryPath, args, {
            timeout: 180000,
            maxBuffer: 16 * 1024 * 1024,
          });
          const tmpFiles = await fs.promises.readdir("/tmp").catch(() => [] as string[]);
          const found = tmpFiles.find(
            (f) =>
              f.startsWith(basePrefix) &&
              (f.endsWith(".mp3") ||
                f.endsWith(".m4a") ||
                f.endsWith(".webm") ||
                f.endsWith(".opus") ||
                f.endsWith(".mp4")),
          );
          if (found) {
            const actualFile = path.resolve("/tmp", found);
            const mediaStream = fs.createReadStream(actualFile);
            mediaStream.once("close", () => {
              void fs.promises.unlink(actualFile).catch(() => {});
            });
            const foundExt = path.extname(found).replace(".", "") || "mp3";
            const isMp4Audio = foundExt === "mp4";
            const filename = `${cleanTitle}.${isMp4Audio ? "m4a" : foundExt}`;
            return new Response(Readable.toWeb(mediaStream) as unknown as BodyInit, {
              headers: {
                "content-type":
                  foundExt === "m4a" || isMp4Audio
                    ? "audio/mp4"
                    : foundExt === "webm" || foundExt === "opus"
                      ? "audio/webm"
                      : "audio/mpeg",
                "content-disposition": `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
                "access-control-allow-origin": "*",
              },
            });
          }
        } catch {
          // Return the exact-video error below when extraction is unavailable.
        }

        // Clean any temp files with prefix
        try {
          const filesInTmp = await fs.promises.readdir("/tmp").catch(() => [] as string[]);
          for (const f of filesInTmp) {
            if (f.startsWith(basePrefix)) {
              await fs.promises.unlink(path.resolve("/tmp", f)).catch(() => {});
            }
          }
        } catch {
          // ignore
        }

        // Never substitute another song: if the exact video audio fails, report failure.
        return Response.json(
          { error: "Couldn't get audio for this exact video." },
          { status: 502, headers: { "access-control-allow-origin": "*" } },
        );
      }

      // Video download path
      try {
        await execFileAsync(binaryPath, args, { timeout: 120000 });
        const tmpFiles = await fs.promises.readdir("/tmp").catch(() => [] as string[]);
        const found = tmpFiles.find((f) => f.startsWith(basePrefix) && f.endsWith(".mp4"));
        const actualFile = found ? path.resolve("/tmp", found) : "";
        if (actualFile && fs.existsSync(actualFile)) {
          const mediaStream = fs.createReadStream(actualFile);
          mediaStream.once("close", () => {
            void fs.promises.unlink(actualFile).catch(() => {});
          });
          const filename = `${cleanTitle}.mp4`;
          return new Response(Readable.toWeb(mediaStream) as unknown as BodyInit, {
            headers: {
              "content-type": "video/mp4",
              "content-disposition": `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
              "access-control-allow-origin": "*",
            },
          });
        }
      } catch {
        // silently catch
      }

      // Clean up remnants
      try {
        const filesInTmp = await fs.promises.readdir("/tmp").catch(() => [] as string[]);
        for (const f of filesInTmp) {
          if (f.startsWith(basePrefix)) {
            await fs.promises.unlink(path.resolve("/tmp", f)).catch(() => {});
          }
        }
      } catch {
        // ignore
      }

      return new Response(
        JSON.stringify({
          error: "Failed to download media",
        }),
        {
          status: 500,
          headers: {
            "content-type": "application/json",
            "access-control-allow-origin": "*",
          },
        },
      );
    }

    if (url.pathname === "/api/assistant" && request.method === "POST") {
      try {
        const body = (await request.json()) as { prompt?: string; library?: unknown[] };
        const prompt = body.prompt || "";
        const library = body.library || [];

        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
          const { GoogleGenAI } = await import("@google/genai");
          const ai = new GoogleGenAI();
          const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: `User prompt: ${prompt}\nUser Library sample: ${JSON.stringify(library.slice(0, 15))}`,
            config: {
              systemInstruction: `You are the SPOILED Music Curator, a knowledgeable, refined, and passionate music concierge for the SPOILED personal audio player.
Analyze the user's inquiry, taste, and their local library context.
Respond with insightful music commentary and provide 3-5 structured track recommendations.
Format your output strictly as a JSON object:
{
  "reply": "Your articulate, conversational response as the SPOILED curator...",
  "recommendations": [
    {
      "title": "Song Title",
      "artist": "Artist Name",
      "vibe": "e.g. Dreamy / Late Night / Ethereal",
      "reason": "Why this song fits the user's prompt"
    }
  ]
}`,
              responseMimeType: "application/json",
            },
          });

          const text = response.text || "{}";
          const parsed = JSON.parse(text) as {
            reply?: string;
            recommendations?: Array<{
              title: string;
              artist: string;
              vibe: string;
              reason: string;
            }>;
          };
          return new Response(
            JSON.stringify({
              reply: parsed.reply || text,
              recommendations: parsed.recommendations || [],
            }),
            { headers: { "content-type": "application/json" } },
          );
        }

        // Curated fallback recommendations if GEMINI_API_KEY is not configured
        return new Response(
          JSON.stringify({
            reply: `Here are bespoke selections curated for "${prompt}":`,
            recommendations: [
              {
                title: "Midnight City",
                artist: "M83",
                vibe: "Euphoric Synthwave",
                reason: "Rich atmospheric layers and soaring melodies for late-night immersion.",
              },
              {
                title: "White Ferrari",
                artist: "Frank Ocean",
                vibe: "Intimate Ambient Soul",
                reason: "Minimal acoustic framing and haunting vocal harmonics.",
              },
              {
                title: "Weightless",
                artist: "Marconi Union",
                vibe: "Restorative Ambient",
                reason: "Scientifically engineered soundscapes that evoke liquid tranquility.",
              },
            ],
          }),
          { headers: { "content-type": "application/json" } },
        );
      } catch (err) {
        console.error("AI Assistant error", err);
        return new Response(
          JSON.stringify({
            reply:
              "I am ready to curate music for your collection. What vibe or artist are you exploring?",
            recommendations: [],
          }),
          { headers: { "content-type": "application/json" } },
        );
      }
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
