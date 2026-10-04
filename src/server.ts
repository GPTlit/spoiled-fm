import "./lib/error-capture";
import * as fs from "node:fs";
import * as path from "node:path";
import { execFile } from "node:child_process";
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

      const nodePath = process.execPath || "/usr/local/bin/node";
      const commonArgs = [
        "--js-runtimes",
        `node:${nodePath}`,
        "--no-check-certificates",
        "--geo-bypass",
        "--no-playlist",
      ];

      const templateOutput = path.resolve("/tmp", `${basePrefix}.%(ext)s`);

      if (type === "audio") {
        if (quality === "128") {
          ext = "m4a";
          args = [...commonArgs, "-f", "140/ba/b", "-o", templateOutput, videoUrl];
        } else {
          ext = "mp3";
          const bitrate = quality === "192" ? "192K" : quality === "256" ? "256K" : "320K";
          args = [
            ...commonArgs,
            "-x",
            "--audio-format",
            "mp3",
            "--audio-quality",
            bitrate,
            "-o",
            templateOutput,
            videoUrl,
          ];
        }
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

      try {
        // Run yt-dlp via python3 for 100% portability and permission safety
        await execFileAsync("python3", [binaryPath, ...args], { timeout: 180000 });

        // Locate generated file in /tmp
        const tmpFiles = await fs.promises.readdir("/tmp").catch(() => [] as string[]);
        const found = tmpFiles.find(
          (f) => f.startsWith(basePrefix) && (f.endsWith(`.${ext}`) || !f.endsWith(".part")),
        );

        const actualFile = found ? path.resolve("/tmp", found) : "";
        if (found) {
          const foundExt = path.extname(found).replace(".", "");
          if (foundExt) ext = foundExt;
        }

        if (!actualFile || !fs.existsSync(actualFile)) {
          // Direct fallback: extract stream URL directly and fetch it
          const streamFormat = type === "audio" ? "ba/b/140/251" : "18/best";
          const { stdout } = await execFileAsync(
            "python3",
            [binaryPath, ...commonArgs, "-f", streamFormat, "-g", videoUrl],
            { timeout: 60000 },
          );
          const directStreamUrl = stdout.trim().split("\n")[0];
          if (directStreamUrl && directStreamUrl.startsWith("http")) {
            const streamRes = await fetch(directStreamUrl, {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              },
            });
            if (streamRes.ok) {
              const arrayBuf = await streamRes.arrayBuffer();
              const contentType =
                type === "audio"
                  ? streamRes.headers.get("content-type") || "audio/mpeg"
                  : "video/mp4";
              const streamExt = contentType.includes("webm")
                ? "webm"
                : contentType.includes("mp4") || contentType.includes("m4a")
                  ? type === "audio"
                    ? "m4a"
                    : "mp4"
                  : ext;
              const filename = `${cleanTitle}.${streamExt}`;
              return new Response(arrayBuf, {
                headers: {
                  "content-type": contentType,
                  "content-disposition": `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
                  "content-length": arrayBuf.byteLength.toString(),
                  "access-control-allow-origin": "*",
                },
              });
            }
          }
          throw new Error("Downloaded file was not created by server");
        }

        const fileBuffer = await fs.promises.readFile(actualFile);
        await fs.promises.unlink(actualFile).catch(() => {});

        const contentType =
          type === "audio" ? (ext === "mp3" ? "audio/mpeg" : "audio/mp4") : "video/mp4";
        const filename = `${cleanTitle}.${ext}`;

        return new Response(fileBuffer, {
          headers: {
            "content-type": contentType,
            "content-disposition": `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
            "content-length": fileBuffer.byteLength.toString(),
            "access-control-allow-origin": "*",
          },
        });
      } catch (err: unknown) {
        console.error("Download error:", err);
        // Clean up any remnants
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

        const fallbackId = cleanId || rawId;
        const y2mateUrl = `https://www.y2mate.com/youtube/${fallbackId}`;
        const tenDownloaderUrl = `https://10downloader.com/download?v=${encodeURIComponent(videoUrl)}`;
        const cobaltUrl = `https://cobalt.tools/`;

        return new Response(
          JSON.stringify({
            fallback: true,
            message: "Direct download fallback engine active",
            videoId: fallbackId,
            videoUrl,
            y2mateUrl,
            tenDownloaderUrl,
            cobaltUrl,
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
              "access-control-allow-origin": "*",
            },
          },
        );
      }
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
