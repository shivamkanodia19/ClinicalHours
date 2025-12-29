import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { Opportunity, UserLocation } from "@/types";
import { fetchOpportunities } from "@/services/opportunities";
import { calculateDistances, sortByDistance } from "@/lib/geolocation";

interface UseOpportunitiesOptions {
  userLocation: UserLocation | null;
  filterType: string;
  searchTerm: string;
  pageSize?: number;
}

interface UseOpportunitiesResult {
  opportunities: Opportunity[];
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  totalCount: number;
}

// Distance calculation moved to src/lib/geolocation.ts

export function useOpportunities({
  userLocation,
  filterType,
  searchTerm,
  pageSize = 20,
}: UseOpportunitiesOptions): UseOpportunitiesResult {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [allOpportunities, setAllOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const { toast } = useToast();

  // Reset when filters change
  useEffect(() => {
    setPage(0);
    setHasMore(true);
  }, [filterType, searchTerm, userLocation?.lat, userLocation?.lng]);

  // Fetch ALL opportunities once, then sort and paginate client-side
  const fetchAllOpportunities = useCallback(async () => {
    setLoading(true);
    try {
      // Use service layer for API call
      const { data, error } = await fetchOpportunities({
        filterType: filterType === "all" ? undefined : filterType,
        searchTerm: searchTerm?.trim() || undefined,
      });

      if (error) throw error;

      let processedData: Opportunity[] = data;

      // Calculate distance and sort if user location available
      if (userLocation) {
        processedData = calculateDistances(processedData, userLocation);
        processedData = sortByDistance(processedData);
      }

      setAllOpportunities(processedData);
      setTotalCount(processedData.length);
    } catch (error) {
      logger.error("Error fetching opportunities", error);
      toast({
        title: "Error",
        description: "Failed to load opportunities. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [filterType, searchTerm, userLocation, toast]);

  // Fetch all opportunities when filters change
  useEffect(() => {
    fetchAllOpportunities();
  }, [fetchAllOpportunities]);

  // Paginate from already-sorted data
  useEffect(() => {
    const endIndex = (page + 1) * pageSize;
    const paginatedData = allOpportunities.slice(0, endIndex);
    setOpportunities(paginatedData);
    setHasMore(endIndex < allOpportunities.length);
  }, [allOpportunities, page, pageSize]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      setPage((prev) => prev + 1);
    }
  }, [loading, hasMore]);

  return {
    opportunities,
    loading,
    hasMore,
    loadMore,
    totalCount,
  };
}
