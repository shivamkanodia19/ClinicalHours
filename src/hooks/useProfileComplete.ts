import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { logger } from "@/lib/logger";

interface ProfileCompletenessResult {
  isComplete: boolean;
  isLoading: boolean;
  missingFields: string[];
  profile: {
    full_name: string;
    university: string | null;
    major: string | null;
    graduation_year: number | null;
    clinical_hours: number | null;
  } | null;
}

// Fields required to participate in reviews and Q&A
const REQUIRED_FIELDS = [
  { key: "full_name", label: "Full Name" },
  { key: "university", label: "University" },
  { key: "major", label: "Major" },
  { key: "graduation_year", label: "Graduation Year" },
] as const;

export function useProfileComplete(): ProfileCompletenessResult {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileCompletenessResult["profile"]>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      setProfile(null);
      setMissingFields(REQUIRED_FIELDS.map(f => f.label));
      return;
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, university, major, graduation_year, clinical_hours")
        .eq("id", user.id)
        .single();

      if (error) throw error;

      setProfile(data);

      // Check which required fields are missing
      const missing: string[] = [];
      REQUIRED_FIELDS.forEach(({ key, label }) => {
        const value = data?.[key as keyof typeof data];
        const isEmpty = !value || (typeof value === "string" && value.trim() === "");
        if (isEmpty) {
          missing.push(label);
        }
      });

      setMissingFields(missing);
    } catch (error) {
      logger.error("Error fetching profile for completeness check", error);
      setMissingFields(REQUIRED_FIELDS.map(f => f.label));
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile, refreshKey]);

  // Refresh profile when window regains focus (user returns from profile page)
  useEffect(() => {
    const handleFocus = () => {
      if (user) {
        setRefreshKey(prev => prev + 1);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user]);

  // Simple boolean: profile is complete if loaded, user exists, and no missing fields
  const isComplete = !isLoading && !!user && !!profile && missingFields.length === 0;

  return {
    isComplete,
    isLoading,
    missingFields,
    profile,
  };
}

export { REQUIRED_FIELDS };
