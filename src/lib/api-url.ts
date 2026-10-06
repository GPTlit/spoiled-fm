// Base URL for the app's own /api endpoints.
// Web: same origin (empty prefix) unless VITE_API_URL is set.
// Native APK (capacitor:// or https://localhost): the deployed web app.
const DEFAULT_REMOTE = "https://spoiled-fm.vercel.app";

function isNativeShell(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
  return Boolean(w.Capacitor?.isNativePlatform?.()) || import.meta.env["VITE_NATIVE"] === "1";
}

export function getApiUrl(): string {
  const fromEnv = import.meta.env["VITE_API_URL"] as string | undefined;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return isNativeShell() ? DEFAULT_REMOTE : "";
}

export const apiUrl = (path: string) => `${getApiUrl()}${path}`;
