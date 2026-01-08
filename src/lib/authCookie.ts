/**
 * Cookie-based authentication utilities
 * Handles exchange of Supabase JWT tokens for httpOnly cookies
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export interface CookieExchangeResponse {
  success: boolean;
  csrfToken?: string;
  user?: {
    id: string;
    email?: string;
  };
  error?: string;
}

/**
 * Exchange Supabase JWT token for httpOnly session cookie
 * @param accessToken - The Supabase access token
 * @param refreshToken - The Supabase refresh token
 * @param rememberMe - If true, stores a persistent cookie to keep user logged in across browser sessions
 */
export async function exchangeTokenForCookie(
  accessToken: string,
  refreshToken?: string,
  rememberMe?: boolean
): Promise<CookieExchangeResponse> {
  try {
    // Use Supabase function invoke which handles authentication properly
    const { supabase } = await import("@/integrations/supabase/client");
    
    const { data, error } = await supabase.functions.invoke("auth-cookie", {
      body: {
        accessToken,
        refreshToken,
        rememberMe: rememberMe ?? false,
      },
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    if (error) {
      return {
        success: false,
        error: error.message || "Failed to exchange token for cookie",
      };
    }

    return {
      success: true,
      csrfToken: data?.csrfToken,
      user: data?.user,
    };
  } catch (error) {
    console.error("Error exchanging token for cookie:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get CSRF token from backend endpoint
 */
export async function getCSRFToken(): Promise<string | null> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/csrf-token`, {
      method: "GET",
      credentials: "include", // Important: include cookies
    });

    if (!response.ok) {
      console.error("Failed to get CSRF token");
      return null;
    }

    const data = await response.json();
    return data.csrfToken || null;
  } catch (error) {
    console.error("Error getting CSRF token:", error);
    return null;
  }
}

/**
 * Restore session from httpOnly cookie
 * Returns access token if session is valid
 */
export async function restoreSessionFromCookie(): Promise<{ success: boolean; accessToken?: string; refreshToken?: string; user?: { id: string; email?: string }; error?: string }> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/restore-session`, {
      method: "GET",
      credentials: "include", // Important: include cookies
    });

    if (!response.ok) {
      return {
        success: false,
        error: "Failed to restore session",
      };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error restoring session from cookie:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Logout and clear cookies
 */
export async function logout(): Promise<boolean> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/logout`, {
      method: "POST",
      credentials: "include", // Important: include cookies
    });

    return response.ok;
  } catch (error) {
    console.error("Error logging out:", error);
    return false;
  }
}

