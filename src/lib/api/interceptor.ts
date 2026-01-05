/**
 * Request interceptor for Supabase function calls
 * Adds CSRF tokens and ensures credentials are included
 */

import { getCSRFToken } from "@/lib/csrf";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/**
 * State-changing HTTP methods that require CSRF protection
 */
const STATE_CHANGING_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

/**
 * Enhanced fetch wrapper that adds CSRF tokens and credentials
 */
export async function fetchWithCSRF(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const isStateChanging = options.method && STATE_CHANGING_METHODS.includes(options.method.toUpperCase());

  // Get CSRF token for state-changing requests
  let csrfToken: string | null = null;
  if (isStateChanging) {
    csrfToken = await getCSRFToken();
  }

  // Prepare headers
  const headers = new Headers(options.headers);

  // Add CSRF token header for state-changing requests
  if (isStateChanging && csrfToken) {
    headers.set("X-CSRF-Token", csrfToken);
  }

  // Ensure credentials are included for cookie transmission
  const enhancedOptions: RequestInit = {
    ...options,
    headers,
    credentials: "include" as RequestCredentials,
  };

  // Make the request
  const response = await fetch(url, enhancedOptions);

  // If CSRF token is invalid/missing, try to refresh it
  if (response.status === 403 && isStateChanging) {
    const errorText = await response.text();
    if (errorText.includes("CSRF") || errorText.includes("csrf")) {
      // Try refreshing CSRF token and retry once
      const newToken = await getCSRFToken();
      if (newToken && newToken !== csrfToken) {
        headers.set("X-CSRF-Token", newToken);
        return fetch(url, {
          ...enhancedOptions,
          headers,
        });
      }
    }
  }

  return response;
}

/**
 * Invoke Supabase function with CSRF protection
 * Wrapper around supabase.functions.invoke() that adds CSRF tokens
 */
export async function invokeFunctionWithCSRF(
  functionName: string,
  options: {
    body?: any;
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  } = {}
): Promise<{ data: any; error: any }> {
  const method = options.method || (options.body ? "POST" : "GET");
  const isStateChanging = STATE_CHANGING_METHODS.includes(method);

  // Get CSRF token for state-changing requests
  let csrfToken: string | null = null;
  if (isStateChanging) {
    csrfToken = await getCSRFToken();
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Add CSRF token header
  if (isStateChanging && csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
      method,
      headers,
      credentials: "include", // Important: include cookies
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        data: null,
        error: {
          message: data.error || "Request failed",
          status: response.status,
        },
      };
    }

    return { data, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        message: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
}

