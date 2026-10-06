// Entry point for the native Android (Capacitor) build ONLY.
// The web app keeps using TanStack Start (vite.config.ts); this file is built by
// vite.capacitor.config.ts into dist-capacitor/.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  RouterProvider,
  createHashHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { Route as IndexFileRoute } from "./routes/index";
import { getApiUrl } from "./lib/api-url";
import "./styles.css";

// Route every relative /api call (including ones made by the download system)
// to the deployed backend, since there is no local server inside the APK.
const nativeFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  if (typeof input === "string" && input.startsWith("/api/")) {
    return nativeFetch(`${getApiUrl()}${input}`, init);
  }
  return nativeFetch(input, init);
};

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, refetchOnReconnect: false } },
});

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: IndexFileRoute.options.component!,
});

const routeTree = rootRoute.addChildren([indexRoute]);

const hashHistory = createHashHistory();
const router = createRouter({ routeTree, history: hashHistory, context: { queryClient } });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
