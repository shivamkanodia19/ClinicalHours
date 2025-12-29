// Geolocation utilities
// Centralized distance calculation and location utilities

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in miles
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get user's current location
 * @param options Geolocation options
 * @returns Promise with user location or null if denied/error
 */
export function getUserLocation(
  options: PositionOptions = {
    enableHighAccuracy: false,
    timeout: 10000,
    maximumAge: 300000, // 5 minutes
  }
): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        // Silently fail - location is optional
        resolve(null);
      },
      options
    );
  });
}

/**
 * Calculate distances for an array of opportunities
 * @param opportunities Array of opportunities
 * @param userLocation User's current location
 * @returns Opportunities with distance calculated
 */
export function calculateDistances<T extends { latitude?: number | null; longitude?: number | null }>(
  opportunities: T[],
  userLocation: { lat: number; lng: number }
): (T & { distance?: number })[] {
  return opportunities.map((opp) => {
    if (!opp.latitude || !opp.longitude) {
      return { ...opp, distance: undefined };
    }

    const distance = calculateDistance(
      userLocation.lat,
      userLocation.lng,
      opp.latitude,
      opp.longitude
    );

    return { ...opp, distance };
  });
}

/**
 * Sort opportunities by distance (closest first)
 * @param opportunities Array of opportunities with distance
 * @returns Sorted array
 */
export function sortByDistance<T extends { distance?: number }>(
  opportunities: T[]
): T[] {
  return [...opportunities].sort((a, b) => {
    if (a.distance === undefined) return 1;
    if (b.distance === undefined) return -1;
    return a.distance - b.distance;
  });
}

