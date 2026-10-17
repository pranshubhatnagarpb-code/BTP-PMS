import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import type { Connect } from 'vite';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 8080,
    host: true,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["logo.png"],
      manifest: {
        name: "Bounce The Pound — Practice Management",
        short_name: "Bounce The Pound",
        description: "Bounce The Pound — Sustainable Weight Loss. Internal practice management dashboard.",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#42756F",
        icons: [
          { src: "/logo.png", sizes: "350x148", type: "image/png" },
        ],
      },
      workbox: {
        // Never let the service worker intercept API calls — they're
        // dynamic/auth-sensitive, not part of the static app shell.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [],
        // The app's main bundle is a few MB (no code-splitting configured);
        // raise Workbox's default 2 MiB precache limit to fit it.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  // Handle SPA routing
  configureServer(server: any) {
    server.middlewares.use((req: Connect.IncomingMessage, res: any, next: Connect.NextFunction) => {
      // Skip for static assets and API routes
      if (req.url?.includes('.') || req.url?.startsWith('/api/')) {
        return next();
      }
      
      // For all other routes, serve index.html
      if (req.url !== '/' && req.url !== '/index.html') {
        req.url = '/index.html';
      }
      next();
    });
  },
}));
