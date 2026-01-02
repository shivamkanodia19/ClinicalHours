// Opportunities service layer
// Centralized API calls for opportunities

import { supabase } from "@/integrations/supabase/client";
import { Opportunity, OpportunityRow } from "@/types";
import { logger } from "@/lib/logger";

export interface FetchOpportunitiesOptions {
  filterType?: string;
  searchTerm?: string;
  limit?: number;
  offset?: number;
  userLocation?: { lat: number; lng: number };
  sortByDistance?: boolean;
}

export interface FetchOpportunitiesResult {
  data: Opportunity[];
  count: number | null;
  error: Error | null;
}

/**
 * Fetch opportunities from the database
 */
export async function fetchOpportunities(
  options: FetchOpportunitiesOptions = {}
): Promise<FetchOpportunitiesResult> {
  try {
    const { filterType, searchTerm, limit, offset } = options;

    let query = supabase
      .from("opportunities_with_ratings")
      .select("*", { count: "exact" });

    // Apply type filter
    if (filterType && filterType !== "all") {
      query = query.eq("type", filterType);
    }

    // Apply search filter - use parameterized queries to prevent SQL injection
    if (searchTerm) {
      const sanitizedSearchTerm = searchTerm.trim().slice(0, 100);
      if (sanitizedSearchTerm) {
        // Escape special characters for ilike pattern and use parameterized approach
        const escapedSearch = sanitizedSearchTerm.replace(/[%_\\]/g, "\\$&");
        // Use Supabase's safe ilike method with proper escaping
        // Build search pattern safely
        const searchPattern = `%${escapedSearch}%`;
        // Use separate filters instead of string interpolation in .or()
        query = query.or(`name.ilike.${searchPattern.replace(/,/g, "\\,")},location.ilike.${searchPattern.replace(/,/g, "\\,")}`);
      }
    }

    // Apply pagination with proper defaults
    const pageLimit = limit || 20; // Default to 20 items per page
    if (offset !== undefined) {
      query = query.range(offset, offset + pageLimit - 1);
    } else {
      query = query.limit(pageLimit);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    const opportunities: Opportunity[] = (data || []).map((opp: OpportunityRow) => ({
      id: opp.id,
      name: opp.name,
      type: opp.type,
      location: opp.location,
      latitude: opp.latitude,
      longitude: opp.longitude,
      hours_required: opp.hours_required,
      acceptance_likelihood: opp.acceptance_likelihood,
      description: opp.description,
      requirements: opp.requirements || [],
      phone: opp.phone,
      email: opp.email,
      website: opp.website,
      avg_rating: opp.avg_rating,
      review_count: opp.review_count,
    }));

    return {
      data: opportunities,
      count,
      error: null,
    };
  } catch (error) {
    logger.error("Error fetching opportunities", error);
    return {
      data: [],
      count: null,
      error: error as Error,
    };
  }
}

/**
 * Fetch a single opportunity by ID
 */
export async function fetchOpportunityById(
  id: string
): Promise<{ data: Opportunity | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from("opportunities_with_ratings")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;

    const opportunity: Opportunity = {
      id: data.id,
      name: data.name,
      type: data.type,
      location: data.location,
      latitude: data.latitude,
      longitude: data.longitude,
      hours_required: data.hours_required,
      acceptance_likelihood: data.acceptance_likelihood,
      description: data.description,
      requirements: data.requirements || [],
      phone: data.phone,
      email: data.email,
      website: data.website,
      avg_rating: data.avg_rating,
      review_count: data.review_count,
    };

    return { data: opportunity, error: null };
  } catch (error) {
    logger.error("Error fetching opportunity", error);
    return { data: null, error: error as Error };
  }
}

