import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "@/lib/tracking";
import { useAuth } from "@/hooks/useAuth";

/**
 * PageViewTracker Component
 * 
 * Tracks page views on route changes.
 * Must be placed inside BrowserRouter context.
 * Uses fire-and-forget pattern to avoid blocking navigation.
 */
export function PageViewTracker() {
  const location = useLocation();
  const { user } = useAuth();
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Track page view on location change
    // Skip tracking on first render if it's a hash navigation (OAuth callback)
    const isOAuthCallback = location.hash.includes("access_token");
    
    if (isFirstRender.current && isOAuthCallback) {
      isFirstRender.current = false;
      return;
    }

    isFirstRender.current = false;

    // Fire and forget - don't await
    trackPageView(user?.id);
  }, [location.pathname, location.search, user?.id]);

  return null;
}

export default PageViewTracker;
