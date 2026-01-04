import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { logAuthEvent } from "@/lib/auditLogger";

// Session timeout: 30 minutes of inactivity
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());
  const sessionRef = useRef<Session | null>(null);
  const initializingRef = useRef(false);

  // Keep session ref in sync
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Reset activity timer on user interaction
  const resetActivityTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Check for session timeout
  const checkSessionTimeout = useCallback(async () => {
    try {
      const timeSinceActivity = Date.now() - lastActivityRef.current;
      if (timeSinceActivity > SESSION_TIMEOUT_MS && sessionRef.current) {
        // Log auth event (fire and forget)
        void logAuthEvent("logout", { reason: "session_timeout" });
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
      }
    } catch {
      // Ignore errors in timeout check
    }
  }, []);

  useEffect(() => {
    // Prevent double initialization
    if (initializingRef.current) return;
    initializingRef.current = true;

    // Set up activity listeners
    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart", "click"];
    events.forEach(event => {
      document.addEventListener(event, resetActivityTimer, true);
    });

    // Check session timeout every minute
    const interval = setInterval(checkSessionTimeout, 60 * 1000);

    // First, get the existing session BEFORE setting up the listener
    // This prevents race conditions where the listener fires before we've checked
    const initializeAuth = async () => {
      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        
        // Set initial state
        setSession(existingSession);
        setUser(existingSession?.user ?? null);
        
        if (existingSession) {
          lastActivityRef.current = Date.now();
        }
      } catch {
        // Ignore initialization errors
      } finally {
        setLoading(false);
        setIsReady(true);
      }
    };

    // Initialize first
    initializeAuth();

    // Then set up the listener for future changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        // Use setTimeout to avoid potential deadlocks
        setTimeout(() => {
          setSession(newSession);
          setUser(newSession?.user ?? null);
          setLoading(false);
          setIsReady(true);
          
          if (event === "SIGNED_OUT") {
            // Log auth event (fire and forget)
            void logAuthEvent("logout");
            lastActivityRef.current = Date.now();
          } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
            lastActivityRef.current = Date.now();
          }
        }, 0);
      }
    );

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
      events.forEach(event => {
        document.removeEventListener(event, resetActivityTimer, true);
      });
      initializingRef.current = false;
    };
  }, []); // Empty dependency array - only run once on mount

  const signOut = async () => {
    // Log auth event (fire and forget)
    void logAuthEvent("logout");
    await supabase.auth.signOut();
  };

  return { user, session, loading, isReady, signOut };
};
