import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Validate required environment variables
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  const missingVars = [];
  if (!SUPABASE_URL) missingVars.push('VITE_SUPABASE_URL');
  if (!SUPABASE_PUBLISHABLE_KEY) missingVars.push('VITE_SUPABASE_PUBLISHABLE_KEY');
  
  throw new Error(
    `Missing required Supabase environment variables: ${missingVars.join(', ')}. ` +
    `Please ensure these are set in your .env file or environment configuration.`
  );
}

// Use sessionStorage instead of localStorage for Supabase sessions
// sessionStorage is cleared when tab closes, reducing XSS risk while allowing session persistence
// We still use httpOnly cookies as the primary security mechanism
const sessionStorageAdapter = {
  getItem: (key: string) => {
    try {
      return typeof window !== 'undefined' ? sessionStorage.getItem(key) : null;
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(key, value);
      }
    } catch {
      // Ignore errors (e.g., quota exceeded)
    }
  },
  removeItem: (key: string) => {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(key);
      }
    } catch {
      // Ignore errors
    }
  },
};

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

// Custom fetch wrapper that adds CSRF tokens and credentials
const customFetch = async (url: RequestInfo | URL, options: RequestInit = {}): Promise<Response> => {
  const urlString = typeof url === 'string' ? url : url.toString();
  
  // Only add credentials for our edge functions, not Supabase auth endpoints
  // Supabase auth endpoints don't support credentials mode with CORS
  const isEdgeFunction = urlString.includes('/functions/v1/');
  const isSupabaseAuth = urlString.includes('/auth/v1/');
  
  const enhancedOptions: RequestInit = {
    ...options,
  };
  
  // Only include credentials for edge functions (not Supabase auth)
  if (isEdgeFunction && !isSupabaseAuth) {
    enhancedOptions.credentials = 'include' as RequestCredentials;
  }
  
  // Add CSRF token for state-changing requests to edge functions
  const method = options.method?.toUpperCase();
  const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  
  if (method && stateChangingMethods.includes(method) && isEdgeFunction) {
    try {
      // Import dynamically to avoid circular dependency
      const { getCSRFToken } = await import('@/lib/csrf');
      const csrfToken = await getCSRFToken();
      
      if (csrfToken) {
        const headers = new Headers(options.headers);
        headers.set('X-CSRF-Token', csrfToken);
        enhancedOptions.headers = headers;
        // Debug logging (remove in production if needed)
        console.log('[CSRF] Added X-CSRF-Token header to', urlString);
      } else {
        console.warn('[CSRF] No CSRF token available for', urlString);
      }
    } catch (error) {
      console.error('Error adding CSRF token:', error);
    }
  }
  
  return fetch(url, enhancedOptions);
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: sessionStorageAdapter, // Use sessionStorage (cleared on tab close) instead of localStorage
    persistSession: true, // Allow session persistence in sessionStorage
    autoRefreshToken: true,
    detectSessionInUrl: false, // Don't detect session in URL
  },
  global: {
    headers: {
      'X-Client-Info': 'clinicalhours-web',
    },
    fetch: customFetch,
  },
});