import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { webcrypto } from "node:crypto";

if (!("crypto" in globalThis)) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
}

const nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
const canUsePwaPlugin = Number.isFinite(nodeMajor) && nodeMajor >= 20;

function requestLoggingPlugin() {
  const seenClients = new Set<string>();

  const logRequest = (req: { method?: string; url?: string; socket?: { remoteAddress?: string } }) => {
    const ip = req.socket?.remoteAddress ?? "unknown";
    if (!seenClients.has(ip)) {
      seenClients.add(ip);
      console.log(`[server] client connected: ${ip}`);
    }

    const method = req.method ?? "GET";
    const url = req.url ?? "/";
    console.log(`[server] resource request: ${ip} ${method} ${url}`);
  };

  return {
    name: "request-logging",
    configureServer(server: { middlewares: { use: (handler: (req: any, _res: any, next: () => void) => void) => void } }) {
      server.middlewares.use((req, _res, next) => {
        logRequest(req);
        next();
      });
    },
    configurePreviewServer(server: { middlewares: { use: (handler: (req: any, _res: any, next: () => void) => void) => void } }) {
      server.middlewares.use((req, _res, next) => {
        logRequest(req);
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    requestLoggingPlugin(),
    react(),
    ...(canUsePwaPlugin
      ? [
          VitePWA({
            registerType: "autoUpdate",
            includeAssets: ["favicon.svg"],
            manifest: {
              name: "Singularity Webapp",
              short_name: "Singularity",
              description: "Browser-native rewrite foundation for Endgame: Singularity.",
              theme_color: "#f05a28",
              background_color: "#f7f1e1",
              display: "standalone",
              start_url: "/",
              icons: [
                {
                  src: "favicon.svg",
                  sizes: "any",
                  type: "image/svg+xml",
                  purpose: "any"
                }
              ]
            }
          }),
        ]
      : [])
  ]
});