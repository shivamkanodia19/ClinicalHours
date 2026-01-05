import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Apply CSP headers to all routes for comprehensive XSS protection
// This includes all application routes to prevent script injection attacks
const shouldApplyCSP = (pathname: string): boolean => {
  // Exclude static assets and API routes from CSP
  // Apply CSP to all HTML pages and application routes
  const excludedPaths = [
    "/@vite",           // Vite dev server internal
    "/@react-refresh",  // React refresh
    "/@id",             // Vite module resolution
    "/node_modules",    // Node modules
    ".js",              // JavaScript files
    ".css",             // CSS files
    ".json",            // JSON files
    ".png",             // Images
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".ico",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
  ];
  
  // Check if path is an excluded static asset
  const isExcluded = excludedPaths.some((excluded) => 
    pathname.includes(excluded) || pathname.endsWith(excluded)
  );
  
  // Apply CSP to all HTML pages and application routes
  return !isExcluded;
};

// Generate CSP policy based on environment and Supabase URL
const generateCSPPolicy = (isDev: boolean, supabaseUrl: string): string => {
  // Extract domain from Supabase URL (e.g., https://xxx.supabase.co -> *.supabase.co)
  const supabaseDomain = supabaseUrl.replace(/^https?:\/\/([^/]+).*$/, "$1");
  const supabaseWildcard = supabaseDomain.includes("supabase.co") 
    ? "https://*.supabase.co" 
    : supabaseUrl;

  if (isDev) {
    // Development policy - more permissive for Vite HMR
    // Note: CSP doesn't support wildcard ports, so we allow localhost with common ports
    const localhostPorts = [
      "http://localhost:8080",
      "http://localhost:5173",
      "http://localhost:5174",
      "ws://localhost:8080",
      "ws://localhost:5173",
      "ws://localhost:5174",
      "wss://localhost:8080",
      "wss://localhost:5173",
      "wss://localhost:5174",
    ].join(" ");
    
    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https:",
      `connect-src 'self' ${supabaseWildcard} https://api.mapbox.com https://*.tiles.mapbox.com https://events.mapbox.com ${localhostPorts}`,
      "frame-ancestors 'none'",
    ].join("; ");
  } else {
    // Production policy - strict, no inline scripts
    return [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https:",
      `connect-src 'self' ${supabaseWildcard} https://api.mapbox.com https://*.tiles.mapbox.com https://events.mapbox.com`,
      "frame-ancestors 'none'",
    ].join("; ");
  }
};

// Plugin to add security headers including CSP
const securityHeadersPlugin = (isDev: boolean, supabaseUrl: string) => ({
  name: "security-headers",
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      const pathname = req.url?.split("?")[0] || "/";
      
      // Always set basic security headers
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "DENY");
      res.setHeader("X-XSS-Protection", "1; mode=block");
      res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
      
      // Add CSP header to all application routes for comprehensive XSS protection
      if (shouldApplyCSP(pathname)) {
        const cspPolicy = generateCSPPolicy(isDev, supabaseUrl);
        res.setHeader("Content-Security-Policy", cspPolicy);
      }
      
      next();
    });
  },
  configurePreviewServer(server: any) {
    // Also apply headers in preview mode (production build testing)
    server.middlewares.use((req: any, res: any, next: any) => {
      const pathname = req.url?.split("?")[0] || "/";
      
      // Always set basic security headers
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "DENY");
      res.setHeader("X-XSS-Protection", "1; mode=block");
      res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
      
      // Add CSP header to all application routes (production policy in preview)
      if (shouldApplyCSP(pathname)) {
        const cspPolicy = generateCSPPolicy(false, supabaseUrl);
        res.setHeader("Content-Security-Policy", cspPolicy);
      }
      
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
  const DEFAULT_VITE_MAPBOX_PUBLIC_TOKEN =
    "pk.eyJ1IjoicmFnaGF2dDIwMDciLCJhIjoiY21oeTJzb2dvMDhsdDJ3cTZqMzVtc3Q4cCJ9.DXBjsf0TdbDT_KFXcc2mpg";

  const VITE_SUPABASE_URL =
    env.VITE_SUPABASE_URL ??
    (process.env.VITE_SUPABASE_URL as string | undefined) ??
    DEFAULT_VITE_SUPABASE_URL;

  const VITE_SUPABASE_PUBLISHABLE_KEY =
    env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    (process.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
    DEFAULT_VITE_SUPABASE_PUBLISHABLE_KEY;

  const VITE_MAPBOX_PUBLIC_TOKEN =
    env.VITE_MAPBOX_PUBLIC_TOKEN ??
    (process.env.VITE_MAPBOX_PUBLIC_TOKEN as string | undefined) ??
    DEFAULT_VITE_MAPBOX_PUBLIC_TOKEN;

  return {
    server: {
      host: "127.0.0.1", // Use localhost explicitly
      port: 3000, // Try a different port that's less likely to be blocked
      strictPort: false, // Try next available port if 3000 is taken
      open: false, // Don't auto-open browser
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      securityHeadersPlugin(mode === "development", VITE_SUPABASE_URL),
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
      "import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN": JSON.stringify(
        VITE_MAPBOX_PUBLIC_TOKEN
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

