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
  // Ensure env vars are loaded consistently in all environments (dev/preview/build)
  const env = loadEnv(mode, process.cwd(), "");

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
    // Provide explicit defines so the auto-generated Supabase client never sees undefined
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(env.VITE_SUPABASE_URL),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(env.VITE_SUPABASE_PUBLISHABLE_KEY),
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

