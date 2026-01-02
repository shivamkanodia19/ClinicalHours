// City search using OpenStreetMap Nominatim API (free, no API key required)
// Rate limit: 1 request per second

interface CityResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
  };
}

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second

export async function searchCities(query: string, limit: number = 10): Promise<string[]> {
  if (!query || query.length < 2) {
    return [];
  }

  // Rate limiting: ensure at least 1 second between requests
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();

  try {
    // Search for cities in the US
    const url = `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(query)}&` +
      `countrycodes=us&` +
      `format=json&` +
      `limit=${limit}&` +
      `addressdetails=1&` +
      `featuretype=city,town,village`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ClinicalHours App' // Required by Nominatim
      }
    });

    if (!response.ok) {
      return [];
    }

    const data: CityResult[] = await response.json();
    
    // Extract city names with state, removing duplicates
    const cities = new Set<string>();
    data.forEach(item => {
      const cityName = item.address?.city || item.address?.town || item.address?.village;
      const state = item.address?.state;
      if (cityName) {
        const cityWithState = state ? `${cityName}, ${state}` : cityName;
        cities.add(cityWithState);
      }
    });

    return Array.from(cities).slice(0, limit);
  } catch (error) {
    console.error('Error searching cities:', error);
    return [];
  }
}

