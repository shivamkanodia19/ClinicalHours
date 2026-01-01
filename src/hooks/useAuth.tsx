import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { logAuthEvent } from "@/lib/auditLogger";

// Session timeout: 30 minutes of inactivity
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

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
      const timeSinceActivity = Date.now() - lastActivityRef.current;
      if (timeSinceActivity > SESSION_TIMEOUT_MS && session) {
        // Don't await logAuthEvent to avoid blocking
        logAuthEvent("logout", { reason: "session_timeout" }).catch(() => {});
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
      }
    } catch (error) {
      // Ignore errors in timeout check
    }
  };

  useEffect(() => {
    // Set up activity listeners
    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart", "click"];
    events.forEach(event => {
      document.addEventListener(event, resetActivityTimer, true);
    });

    // Check session timeout every minute
    const interval = setInterval(checkSessionTimeout, 60 * 1000);

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        if (event === "SIGNED_OUT") {
          // Don't await to avoid blocking
          logAuthEvent("logout").catch(() => {});
          lastActivityRef.current = Date.now();
        } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          lastActivityRef.current = Date.now();
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session) {
        lastActivityRef.current = Date.now();
      }
    });

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
      events.forEach(event => {
        document.removeEventListener(event, resetActivityTimer, true);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [session]);

  const signOut = async () => {
    // Don't await to avoid blocking
    logAuthEvent("logout").catch(() => {});
    await supabase.auth.signOut();
  };

  return { user, session, loading, signOut };
};
