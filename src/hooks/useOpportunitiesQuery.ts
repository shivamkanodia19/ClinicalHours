import { useQuery } from "@tanstack/react-query";
import { fetchOpportunities } from "@/services/opportunities";
import { Opportunity } from "@/types";

interface UseOpportunitiesQueryOptions {
  filterType?: string;
  searchTerm?: string;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}

/**
 * React Query hook for fetching opportunities with caching and automatic refetching
 */
export function useOpportunitiesQuery(options: UseOpportunitiesQueryOptions = {}) {
  const { filterType, searchTerm, limit = 20, offset = 0, enabled = true } = options;

  return useQuery({
    queryKey: ["opportunities", filterType, searchTerm, limit, offset],
    queryFn: async () => {
      const result = await fetchOpportunities({
        filterType,
        searchTerm,
        limit,
        offset,
      });
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });
}

