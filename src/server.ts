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

    if (url.pathname === "/api/youtube/search" && request.method === "GET") {
      const q = url.searchParams.get("q") || "";
      const videos = await searchYouTube(q);
      return new Response(JSON.stringify({ videos, results: videos }), {
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

    if (url.pathname === "/api/video/fallback" && request.method === "GET") {
      const id = url.searchParams.get("id") || "";
      const type = url.searchParams.get("type") === "audio" ? "audio" : "video";
      const title =
        (url.searchParams.get("title") || "download").replace(/[^\w\s.-]/gi, "").trim() ||
        "spoiled-media";
      if (!/^[\w-]{10,12}$/.test(id)) {
        return new Response(JSON.stringify({ error: "Invalid video ID" }), { status: 400 });
      }
      const { fallbackDownload } = await import("./lib/download-fallback.server");
      const res = await fallbackDownload(id, type, title);
      return res ?? new Response(JSON.stringify({ error: "busy" }), { status: 503 });
    }

    if (url.pathname === "/api/video/download" && request.method === "GET") {
      const id = url.searchParams.get("id");
      const type = url.searchParams.get("type") || "video"; // "video" | "audio"
      const quality = url.searchParams.get("quality") || (type === "audio" ? "320" : "720");
      const rawTitle = url.searchParams.get("title") || "download";
      const cleanTitle = rawTitle.replace(/[^\w\s.-]/gi, "").trim() || "spoiled-media";

      if (!id || !/^[\w-]{10,12}$/.test(id)) {
        return new Response(JSON.stringify({ error: "Invalid video ID" }), {
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

      const videoUrl = `https://www.youtube.com/watch?v=${id}`;
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);

      let ext = "mp4";
      let targetFile = "";
      let args: string[] = [];

      const nodePath = process.execPath || "/usr/local/bin/node";
      const commonArgs = [
        "--js-runtimes",
        `node:${nodePath}`,
        "--extractor-args",
        "youtube:player_client=mweb,web,android",
        "--no-check-certificates",
        "--geo-bypass",
        "--no-playlist",
      ];

      if (type === "audio") {
        if (quality === "128") {
          ext = "m4a";
          targetFile = path.resolve("/tmp", `spoiled_${timestamp}_${randomSuffix}.${ext}`);
          args = [...commonArgs, "-f", "140/ba/b", "-o", targetFile, videoUrl];
        } else {
          ext = "mp3";
          targetFile = path.resolve("/tmp", `spoiled_${timestamp}_${randomSuffix}.${ext}`);
          const bitrate = quality === "192" ? "192K" : "320K";
          args = [
            ...commonArgs,
            "-x",
            "--audio-format",
            "mp3",
            "--audio-quality",
            bitrate,
            "-o",
            targetFile,
            videoUrl,
          ];
        }
      } else {
        ext = "mp4";
        targetFile = path.resolve("/tmp", `spoiled_${timestamp}_${randomSuffix}.${ext}`);
        const height = ["1080", "720", "480", "360"].includes(quality) ? quality : "720";
        args = [
          ...commonArgs,
          "-f",
          `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/best`,
          "--merge-output-format",
          "mp4",
          "-o",
          targetFile,
          videoUrl,
        ];
      }

      try {
        await execFileAsync(binaryPath, args, { timeout: 35000 });

        if (!fs.existsSync(targetFile)) {
          throw new Error("Downloaded file was not created");
        }

        const fileBuffer = await fs.promises.readFile(targetFile);
        await fs.promises.unlink(targetFile).catch(() => {});

        const contentType =
          type === "audio" ? (ext === "mp3" ? "audio/mpeg" : "audio/mp4") : "video/mp4";
        const filename = `${cleanTitle}.${ext}`;

        return new Response(fileBuffer, {
          headers: {
            "content-type": contentType,
            "content-disposition": `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
            "content-length": fileBuffer.byteLength.toString(),
          },
        });
      } catch (err: unknown) {
        console.error("Download error:", err);
        if (targetFile && fs.existsSync(targetFile)) {
          await fs.promises.unlink(targetFile).catch(() => {});
        }
        const message = err instanceof Error ? err.message : "Download processing failed";
        const isBotCheck =
          message.includes("Sign in to confirm you") ||
          message.includes("bot") ||
          message.includes("login required");

        return new Response(
          JSON.stringify({
            error: isBotCheck ? "bot_detected" : message,
            isBotCheck,
            message: isBotCheck
              ? "YouTube restricted server download for this track (Bot verification). Use Direct Web Download to save instantly."
              : message,
            directLinks: {
              downloader10: `https://10downloader.com/download?v=${id}`,
              y2mate: `https://www.y2mate.com/youtube/${id}`,
              ssyoutube: `https://ssyoutube.com/watch?v=${id}`,
            },
          }),
          {
            status: isBotCheck ? 403 : 500,
            headers: { "content-type": "application/json" },
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
