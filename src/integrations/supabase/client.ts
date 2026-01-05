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

// Custom storage adapter that doesn't persist to localStorage
// This prevents XSS attacks while still allowing Supabase to manage auth state internally
const noStorageAdapter = {
  getItem: (_key: string) => null,
  setItem: (_key: string, _value: string) => {},
  removeItem: (_key: string) => {},
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
      }
    } catch (error) {
      console.error('Error adding CSRF token:', error);
    }
  }
  
  return fetch(url, enhancedOptions);
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: noStorageAdapter, // Use no-op storage to prevent localStorage usage
    persistSession: false, // Don't persist to localStorage
    autoRefreshToken: true,
  },
  global: {
    headers: {
      'X-Client-Info': 'clinicalhours-web',
    },
    fetch: customFetch,
  },
});