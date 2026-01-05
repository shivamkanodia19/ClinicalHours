import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { logAuthEvent } from "@/lib/auditLogger";
import { exchangeTokenForCookie, logout as logoutCookie } from "@/lib/authCookie";

// Session timeout: 30 minutes of inactivity
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

// Store CSRF token in memory (not localStorage to prevent XSS)
let csrfToken: string | null = null;

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const lastActivityRef = useRef<number>(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset activity timer on user interaction
  const resetActivityTimer = () => {
    lastActivityRef.current = Date.now();
  };

  // Check for session timeout
  const checkSessionTimeout = async () => {
    try {
      // Get current session directly instead of using closure
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const timeSinceActivity = Date.now() - lastActivityRef.current;
      if (timeSinceActivity > SESSION_TIMEOUT_MS && currentSession) {
        // Log auth event (fire and forget)
        void logAuthEvent("logout", { reason: "session_timeout" });
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
      }
    } catch (error) {
      // Ignore errors in timeout check
    }
  };

  useEffect(() => {
    let isMounted = true;
    let exchangeInProgress = false;

    // Set up activity listeners
    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart", "click"];
    events.forEach(event => {
      document.addEventListener(event, resetActivityTimer, true);
    });

    // Check session timeout every minute
    const interval = setInterval(() => {
      if (isMounted) {
        checkSessionTimeout();
      }
    }, 60 * 1000);

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!isMounted) return;
        
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
        
        if (event === "SIGNED_OUT") {
          // Clear cookies via logout endpoint
          await logoutCookie();
          csrfToken = null;
          // Log auth event (fire and forget)
          void logAuthEvent("logout");
          lastActivityRef.current = Date.now();
        } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          // Exchange token for httpOnly cookie (prevent multiple simultaneous exchanges)
          if (newSession?.access_token && !exchangeInProgress) {
            exchangeInProgress = true;
            try {
              const result = await exchangeTokenForCookie(
                newSession.access_token,
                newSession.refresh_token
              );
              if (result.success && result.csrfToken) {
                csrfToken = result.csrfToken;
              } else {
                console.error("Failed to exchange token for cookie:", result.error);
              }
            } catch (error) {
              console.error("Error exchanging token for cookie:", error);
            } finally {
              exchangeInProgress = false;
            }
          }
          lastActivityRef.current = Date.now();
        }
      }
    );

    // Check for existing session (only once on mount)
    const checkSession = async () => {
      if (!isMounted) return;
      
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      if (!isMounted) return;
      
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      setLoading(false);
      
      if (existingSession?.access_token && !exchangeInProgress) {
        exchangeInProgress = true;
        try {
          const result = await exchangeTokenForCookie(
            existingSession.access_token,
            existingSession.refresh_token
          );
          if (result.success && result.csrfToken) {
            csrfToken = result.csrfToken;
          }
        } catch (error) {
          console.error("Error exchanging existing token for cookie:", error);
        } finally {
          exchangeInProgress = false;
        }
        lastActivityRef.current = Date.now();
      }
    };
    checkSession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      clearInterval(interval);
      events.forEach(event => {
        document.removeEventListener(event, resetActivityTimer, true);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []); // Empty dependency array - only run once on mount

  const signOut = async () => {
    // Log auth event (fire and forget)
    void logAuthEvent("logout");
    // Clear cookies first
    await logoutCookie();
    csrfToken = null;
    // Then sign out from Supabase
    await supabase.auth.signOut();
  };

  return { user, session, loading, signOut };
};

// Export function to get CSRF token (for use in API requests)
export function getCSRFToken(): string | null {
  return csrfToken;
}
