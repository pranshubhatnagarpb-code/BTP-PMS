import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import type { Connect } from 'vite';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  preview: {
    port: 8080,
    host: true,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
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
