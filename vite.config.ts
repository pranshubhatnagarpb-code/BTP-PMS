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
      includeAssets: ["favicon.ico", "apple-touch-icon.png"],
      manifest: {
        name: "From Monday — Practice Management",
        short_name: "From Monday",
        description: "From Monday — Dr. Aamit Shah, Health & Lifestyle Coach. Internal practice management dashboard.",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#155cac",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
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
