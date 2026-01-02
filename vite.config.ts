import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Plugin to add security headers in development
const securityHeadersPlugin = () => ({
  name: "security-headers",
  configureServer(server: any) {
    server.middlewares.use((_req: any, res: any, next: any) => {
      // Security headers (CSP removed - too strict for dev, should be set at server/CDN level)
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "DENY");
      res.setHeader("X-XSS-Protection", "1; mode=block");
      res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
      next();
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // In this environment, VITE_ vars may be provided via runtime env injection rather than a local .env file.
  // We read from BOTH loadEnv + process.env and then define them explicitly so `import.meta.env.*` is never undefined.
  const env = loadEnv(mode, process.cwd(), "VITE_");

  const DEFAULT_VITE_SUPABASE_URL = "https://sysbtcikrbrrgafffody.supabase.co";
  const DEFAULT_VITE_SUPABASE_PUBLISHABLE_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5c2J0Y2lrcmJycmdhZmZmb2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNTc5MzUsImV4cCI6MjA3ODYzMzkzNX0.5jN1B2RIscA42w7FYfwxaQHFW6ROldslPzUFYtQCgLc";

  const VITE_SUPABASE_URL =
    env.VITE_SUPABASE_URL ??
    (process.env.VITE_SUPABASE_URL as string | undefined) ??
    DEFAULT_VITE_SUPABASE_URL;

  const VITE_SUPABASE_PUBLISHABLE_KEY =
    env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    (process.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
    DEFAULT_VITE_SUPABASE_PUBLISHABLE_KEY;

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      mode === "development" && securityHeadersPlugin(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(VITE_SUPABASE_URL),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        VITE_SUPABASE_PUBLISHABLE_KEY
      ),
    },
    build: {
      // Optimize chunk splitting
      rollupOptions: {
        output: {
          manualChunks: {
            // Vendor chunks
            "react-vendor": ["react", "react-dom", "react-router-dom"],
            "ui-vendor": [
              "@radix-ui/react-dialog",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-select",
            ],
            "query-vendor": ["@tanstack/react-query"],
            "map-vendor": ["mapbox-gl"],
            // Large components
            map: ["./src/pages/MapView", "./src/components/OpportunityMap"],
          },
        },
      },
      // Enable minification
      minify: "esbuild",
      // Increase chunk size warning limit
      chunkSizeWarningLimit: 1000,
      // Optimize asset handling
      assetsInlineLimit: 4096, // Inline small assets (< 4kb) as base64
    },
    // Optimize dependencies
    optimizeDeps: {
      include: ["react", "react-dom", "react-router-dom"],
    },
  };
});

