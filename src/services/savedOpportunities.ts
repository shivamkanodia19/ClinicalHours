// Saved opportunities service layer
// Centralized API calls for saved opportunities

import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export interface SavedOpportunity {
  id: string;
  opportunity_id: string;
  user_id: string;
  created_at: string;
}

/**
 * Fetch saved opportunities for a user
 */
export async function fetchSavedOpportunities(
  userId: string
): Promise<{ data: SavedOpportunity[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from("saved_opportunities")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return { data: data || [], error: null };
  } catch (error) {
    logger.error("Error fetching saved opportunities", error);
    return { data: [], error: error as Error };
  }
}

/**
 * Add opportunity to saved list
 */
export async function addSavedOpportunity(
  userId: string,
  opportunityId: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.from("saved_opportunities").insert({
      user_id: userId,
      opportunity_id: opportunityId,
    });

    if (error) throw error;

    return { error: null };
  } catch (error) {
    logger.error("Error adding saved opportunity", error);
    return { error: error as Error };
  }
}

/**
 * Remove opportunity from saved list
 */
export async function removeSavedOpportunity(
  userId: string,
  opportunityId: string
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase
      .from("saved_opportunities")
      .delete()
      .eq("user_id", userId)
      .eq("opportunity_id", opportunityId);

    if (error) throw error;

    return { error: null };
  } catch (error) {
    logger.error("Error removing saved opportunity", error);
    return { error: error as Error };
  }
}

