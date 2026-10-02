import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

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
      if (!q.trim()) {
        return new Response(JSON.stringify({ videos: [] }), {
          headers: { "content-type": "application/json" },
        });
      }

      try {
        const ytRes = await fetch(
          `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
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
        const videos: Array<{
          id: string;
          title: string;
          channel: string;
          duration?: string;
          thumbnail: string;
          views?: string;
        }> = [];

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

        return new Response(JSON.stringify({ videos }), {
          headers: { "content-type": "application/json" },
        });
      } catch (err) {
        console.error("YouTube search error:", err);
        return new Response(JSON.stringify({ videos: [] }), {
          headers: { "content-type": "application/json" },
        });
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
