import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Loader2, Map, List, MapPin, RotateCcw, Settings2, ChevronUp } from 'lucide-react';
import { logger } from '@/lib/logger';
import { Opportunity } from '@/types';

interface SavedOpportunity {
  opportunity_id: string;
  opportunities: Opportunity;
}

type ViewMode = 'all' | 'saved';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN || '';
const RADIUS_OPTIONS = [1, 5, 10, 25, 50, 100, 200]; // miles
const DEFAULT_RADIUS_INDEX = 4; // 50 miles

// Type colors for clustering
const TYPE_COLORS: Record<string, string> = {
  hospital: '#EF4444',
  clinic: '#3B82F6',
  hospice: '#8B5CF6',
  emt: '#F59E0B',
};



// Convert opportunities to GeoJSON
// Memoize this function to avoid recreating on every call
const opportunitiesToGeoJSON = (opportunities: Opportunity[]): GeoJSON.FeatureCollection => {
  return {
    type: 'FeatureCollection',
    features: opportunities
      .filter(opp => opp.latitude && opp.longitude)
      .map(opp => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [opp.longitude!, opp.latitude!],
        },
        properties: {
          id: opp.id,
          name: opp.name,
          type: opp.type,
          location: opp.location,
          acceptance_likelihood: opp.acceptance_likelihood,
          hours_required: opp.hours_required,
          website: opp.website || '',
          email: opp.email || '',
          phone: opp.phone || '',
        },
      })),
  };
};

const OpportunityMap = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const customPinMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const isPinModeRef = useRef(false);
  
  const { user, isReady } = useAuth();
  const [mapLoading, setMapLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [savedOpportunities, setSavedOpportunities] = useState<SavedOpportunity[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [customPin, setCustomPin] = useState<{ lat: number; lng: number } | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isPinMode, setIsPinMode] = useState(false);
  const [radiusMiles, setRadiusMiles] = useState(RADIUS_OPTIONS[DEFAULT_RADIUS_INDEX]);
  const [mapReady, setMapReady] = useState(false);

  // Combined loading state
  const loading = mapLoading || dataLoading;

  // The active center is either custom pin or user location
  const activeCenter = customPin || userLocation;

  // Keep isPinModeRef in sync with state so map click handlers can access current value
  useEffect(() => {
    isPinModeRef.current = isPinMode;
  }, [isPinMode]);

  // Fetch opportunities with server-side distance filtering
  // When user has a location, only fetch opportunities within radius (much faster)
  // When no location, fetch all opportunities (with reasonable limit for initial view)
  const fetchOpportunitiesForMap = useCallback(async () => {
    setDataLoading(true);
    try {
      // If we have an active center (user location or custom pin), use server-side distance filtering
      if (activeCenter) {
        // Use RPC with distance filter - paginate to avoid Supabase's default row limit
        const allData: Opportunity[] = [];
        const batchSize = 1000;
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase.rpc('get_opportunities_by_distance', {
            user_lat: activeCenter.lat,
            user_lon: activeCenter.lng,
            max_distance_miles: radiusMiles,
            page_limit: batchSize,
            page_offset: offset,
          });

          if (error) throw error;

          if (data && data.length > 0) {
            const mappedBatch: Opportunity[] = data.map((opp: {
              id: string;
              name: string;
              type: string;
              location: string;
              address?: string;
              latitude?: number;
              longitude?: number;
              hours_required: string;
              acceptance_likelihood: string;
              description?: string;
              requirements?: string[];
              phone?: string;
              email?: string;
              website?: string;
              avg_rating?: number;
              review_count?: number;
              distance_miles?: number;
            }) => ({
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
              distance: opp.distance_miles,
            }));

            allData.push(...mappedBatch);
            offset += batchSize;
            hasMore = data.length === batchSize;
          } else {
            hasMore = false;
          }
        }

        logger.debug('Map: Loaded', allData.length, 'opportunities within', radiusMiles, 'miles (server-side filtered)');
        setOpportunities(allData);
      } else {
        // No location - load all opportunities (with batching for large datasets)
        const allData: Opportunity[] = [];
        let from = 0;
        const batchSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from('opportunities')
            .select('*')
            .not('latitude', 'is', null)
            .not('longitude', 'is', null)
            .range(from, from + batchSize - 1);

          if (error) throw error;

          if (data && data.length > 0) {
            allData.push(...data);
            from += batchSize;
            hasMore = data.length === batchSize;
          } else {
            hasMore = false;
          }
        }

        logger.debug('Map: Loaded all', allData.length, 'opportunities (no location filter)');
        setOpportunities(allData);
      }
    } catch (err: unknown) {
      logger.error('Error fetching opportunities', err);
      setMapError('Failed to load opportunities. Please refresh the page.');
    } finally {
      setDataLoading(false);
    }
  }, [activeCenter, radiusMiles]);

  // Fetch opportunities when location or radius changes
  useEffect(() => {
    fetchOpportunitiesForMap();
  }, [fetchOpportunitiesForMap]);

  // Fetch saved opportunities if user is logged in and auth is ready
  useEffect(() => {
    const fetchSavedOpportunities = async () => {
      if (!user || !isReady) {
        setSavedOpportunities([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('saved_opportunities')
          .select(`
            opportunity_id,
            opportunities (*)
          `)
          .eq('user_id', user.id);

        if (error) throw error;
        
        const validData: SavedOpportunity[] = [];
        (data || []).forEach((item: { opportunity_id: string; opportunities: Opportunity | Opportunity[] }) => {
          if (item.opportunities && !Array.isArray(item.opportunities)) {
            validData.push({
              opportunity_id: item.opportunity_id,
              opportunities: item.opportunities as Opportunity,
            });
          }
        });
        setSavedOpportunities(validData);
      } catch (err: unknown) {
        logger.error('Error fetching saved opportunities', err);
      }
    };

    fetchSavedOpportunities();
  }, [user, isReady]);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          logger.debug('Map: User location detected', loc);
          setUserLocation(loc);
        },
        (error) => {
          logger.error('Map: Error getting location', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000,
        }
      );
    }
  }, []);

  // Get the opportunities to display based on view mode
  // When viewing 'all', opportunities are already filtered server-side by distance
  // When viewing 'saved', we show all saved opportunities (they may be outside radius)
  const filteredOpportunities = useMemo(() => {
    if (viewMode === 'saved') {
      return savedOpportunities
        .map(s => s.opportunities)
        .filter((opp): opp is Opportunity => Boolean(opp && opp.latitude && opp.longitude));
    }
    // 'all' mode - opportunities are already server-side filtered by distance when activeCenter exists
    return opportunities.filter(opp => opp.latitude && opp.longitude);
  }, [viewMode, opportunities, savedOpportunities]);

  // Initialize map with clustering layers
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    if (!MAPBOX_TOKEN) {
      setMapError('Mapbox token not configured');
      setMapLoading(false);
      return;
    }

    try {
      mapboxgl.accessToken = MAPBOX_TOKEN;
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [-98.5795, 39.8283],
        zoom: 3.5,
        pitch: 0,
      });

      map.current.addControl(
        new mapboxgl.NavigationControl({
          visualizePitch: true,
        }),
        'top-right'
      );

      map.current.on('load', () => {
        if (!map.current) return;
        
        // Add source with clustering enabled
        map.current.addSource('opportunities', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 50,
        });

        // Cluster circles layer
        map.current.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'opportunities',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': [
              'step',
              ['get', 'point_count'],
              '#51bbd6',
              100,
              '#f1f075',
              500,
              '#f28cb1',
            ],
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              20,
              100,
              30,
              500,
              40,
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });

        // Cluster count label layer
        map.current.addLayer({
          id: 'cluster-count',
          type: 'symbol',
          source: 'opportunities',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': ['get', 'point_count_abbreviated'],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 13,
          },
          paint: {
            'text-color': '#000000',
          },
        });

        // Individual unclustered point layer - color by type
        map.current.addLayer({
          id: 'unclustered-point',
          type: 'circle',
          source: 'opportunities',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': [
              'match',
              ['get', 'type'],
              'hospital', TYPE_COLORS.hospital,
              'clinic', TYPE_COLORS.clinic,
              'hospice', TYPE_COLORS.hospice,
              'emt', TYPE_COLORS.emt,
              '#6B7280', // default gray
            ],
            'circle-radius': 8,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.9,
          },
        });

        // Click on cluster to zoom in
        map.current.on('click', 'clusters', (e) => {
          if (!map.current) return;
          const features = map.current.queryRenderedFeatures(e.point, {
            layers: ['clusters'],
          });
          if (!features.length) return;
          
          const clusterId = features[0].properties?.cluster_id;
          const source = map.current.getSource('opportunities') as mapboxgl.GeoJSONSource;
          
          source.getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err || !map.current) return;
            const geometry = features[0].geometry;
            if (geometry.type !== 'Point') return;
            
            map.current.easeTo({
              center: geometry.coordinates as [number, number],
              zoom: zoom ?? 10,
            });
          });
        });

        // Click on unclustered point to show popup
        map.current.on('click', 'unclustered-point', (e) => {
          if (!map.current || !e.features?.length) return;
          
          const feature = e.features[0];
          const geometry = feature.geometry;
          if (geometry.type !== 'Point') return;
          
          const coordinates = geometry.coordinates.slice() as [number, number];
          const props = feature.properties;
          
          // Ensure popup opens at clicked location even when map is zoomed out
          while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
            coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
          }

          // Close existing popup
          if (popupRef.current) {
            popupRef.current.remove();
          }

          popupRef.current = new mapboxgl.Popup({
            closeButton: true,
            closeOnClick: true,
            maxWidth: '400px',
            anchor: 'bottom',
          })
            .setLngLat(coordinates)
            .setHTML(`
              <div style="padding: 12px 16px; font-family: system-ui, sans-serif; min-width: 300px;">
                <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: #1f2937; line-height: 1.3; word-wrap: break-word;">${props?.name || 'Unknown'}</h3>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.4;">
                    <strong style="color: #374151;">Type:</strong> ${props?.type === 'emt' ? 'EMT' : (props?.type ? props.type.charAt(0).toUpperCase() + props.type.slice(1) : 'N/A')}
                  </p>
                  <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.4; word-wrap: break-word;">
                    <strong style="color: #374151;">Location:</strong> ${props?.location || 'N/A'}
                  </p>
                  <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.4;">
                    <strong style="color: #374151;">Hours:</strong> ${props?.hours_required || 'N/A'}
                  </p>
                  <p style="margin: 0; font-size: 13px; color: #6b7280; text-transform: capitalize; line-height: 1.4;">
                    <strong style="color: #374151;">Acceptance:</strong> ${props?.acceptance_likelihood || 'N/A'}
                  </p>
                  ${props?.website ? `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;"><a href="${props.website}" target="_blank" rel="noopener" style="font-size: 13px; color: #3b82f6; text-decoration: underline; font-weight: 500;">Visit Website →</a></div>` : ''}
                </div>
              </div>
            `)
            .addTo(map.current);
        });

        // Change cursor on hover for clusters
        map.current.on('mouseenter', 'clusters', () => {
          if (map.current) map.current.getCanvas().style.cursor = 'pointer';
        });
        map.current.on('mouseleave', 'clusters', () => {
          if (map.current && !isPinModeRef.current) map.current.getCanvas().style.cursor = '';
        });

        // Change cursor on hover for unclustered points
        map.current.on('mouseenter', 'unclustered-point', () => {
          if (map.current) map.current.getCanvas().style.cursor = 'pointer';
        });
        map.current.on('mouseleave', 'unclustered-point', () => {
          if (map.current && !isPinModeRef.current) map.current.getCanvas().style.cursor = '';
        });

        setMapReady(true);
        setMapLoading(false);
      });

      map.current.on('error', (e) => {
        logger.error('Map error', e);
        setMapError('Error loading map');
        setMapLoading(false);
      });

      // Handle map click for custom pin (only when not clicking on features)
      map.current.on('click', (e) => {
        if (!isPinModeRef.current || !map.current) return;
        
        // Check if clicked on a cluster or point
        const features = map.current.queryRenderedFeatures(e.point, {
          layers: ['clusters', 'unclustered-point'],
        });
        
        if (features.length > 0) return; // Don't place pin if clicking on a feature
        
        setCustomPin({
          lat: e.lngLat.lat,
          lng: e.lngLat.lng,
        });
        setIsPinMode(false);
      });
    } catch (err: any) {
      logger.error('Map initialization error', err);
      setMapError('Failed to initialize map');
      setMapLoading(false);
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update cursor when in pin mode
  useEffect(() => {
    if (!map.current) return;
    map.current.getCanvas().style.cursor = isPinMode ? 'crosshair' : '';
  }, [isPinMode]);

  // Memoize GeoJSON to avoid recreating on every render
  const geojsonData = useMemo(() => {
    return opportunitiesToGeoJSON(filteredOpportunities);
  }, [filteredOpportunities]);

  // Update GeoJSON source when data or filters change
  // Use memoized filtered opportunities to prevent unnecessary updates
  useEffect(() => {
    if (!map.current || !mapReady) return;

    const source = map.current.getSource('opportunities') as mapboxgl.GeoJSONSource;
    if (!source) return;
    
    logger.debug('Map: Updating source with', filteredOpportunities.length, 'filtered opportunities');
    source.setData(geojsonData);

    // Fit bounds to data if there are points (only on initial load)
    if (filteredOpportunities.length > 0 && !activeCenter && map.current.getZoom() < 3) {
      const bounds = new mapboxgl.LngLatBounds();
      filteredOpportunities.forEach((opp) => {
        if (opp.latitude && opp.longitude) {
          bounds.extend([opp.longitude, opp.latitude]);
        }
      });
      if (bounds.isEmpty() === false) {
        map.current.fitBounds(bounds, { padding: 80, maxZoom: 6 });
      }
    }
  }, [geojsonData, filteredOpportunities, mapReady, activeCenter]);

  // Add user location marker
  useEffect(() => {
    if (!map.current || !userLocation || !mapReady) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
    }

    const el = document.createElement('div');
    el.style.cssText = `
      width: 20px;
      height: 20px;
      background: #3B82F6;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.3), 0 2px 8px rgba(0,0,0,0.3);
    `;

    const popup = new mapboxgl.Popup({ offset: 25, maxWidth: '250px' }).setHTML(`
      <div style="padding: 10px 12px; font-family: system-ui, sans-serif;">
        <h3 style="margin: 0; font-size: 15px; font-weight: 600; color: #1f2937;">📍 Your Location</h3>
      </div>
    `);

    userMarkerRef.current = new mapboxgl.Marker(el)
      .setLngLat([userLocation.lng, userLocation.lat])
      .setPopup(popup)
      .addTo(map.current);
  }, [userLocation, mapReady]);

  // Add custom pin marker
  useEffect(() => {
    if (!map.current || !mapReady) return;

    if (customPinMarkerRef.current) {
      customPinMarkerRef.current.remove();
      customPinMarkerRef.current = null;
    }

    if (!customPin) return;

    const el = document.createElement('div');
    el.style.cssText = `
      width: 32px;
      height: 32px;
      background: #EF4444;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 0 0 8px rgba(239, 68, 68, 0.3), 0 2px 8px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    `;
    el.textContent = '📌';

    const popup = new mapboxgl.Popup({ offset: 25, maxWidth: '280px' }).setHTML(`
      <div style="padding: 10px 12px; font-family: system-ui, sans-serif;">
        <h3 style="margin: 0 0 6px 0; font-size: 15px; font-weight: 600; color: #1f2937;">📌 Custom Location</h3>
        <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.4;">Showing opportunities within ${radiusMiles} miles</p>
      </div>
    `);

    customPinMarkerRef.current = new mapboxgl.Marker(el)
      .setLngLat([customPin.lng, customPin.lat])
      .setPopup(popup)
      .addTo(map.current);
  }, [customPin, mapReady, radiusMiles]);

  const handleResetToMyLocation = () => {
    setCustomPin(null);
    setIsPinMode(false);
    if (map.current && userLocation) {
      map.current.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 7,
        duration: 1000,
      });
    }
  };

  const displayCount = filteredOpportunities.length;

  // State for mobile legend visibility
  const [showMobileLegend, setShowMobileLegend] = useState(false);

  if (mapError) {
    return (
      <div className="w-full h-[450px] sm:h-[600px] rounded-xl bg-card border border-border flex items-center justify-center">
        <div className="text-center">
          <Map className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">{mapError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[450px] sm:h-[600px] rounded-xl overflow-hidden border border-border">
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Mobile Controls - Bottom Sheet */}
      <div className="sm:hidden absolute bottom-4 left-4 right-4 z-10">
        <Sheet>
          <SheetTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full bg-background/95 backdrop-blur-sm h-11 font-semibold"
            >
              <Settings2 className="h-4 w-4 mr-2" />
              Map Controls
              <Badge variant="secondary" className="ml-2">
                {displayCount} {activeCenter ? `in ${radiusMiles}mi` : ''}
              </Badge>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[70vh] rounded-t-xl">
            <SheetHeader>
              <SheetTitle>Map Controls</SheetTitle>
            </SheetHeader>
            <div className="space-y-6 py-4">
              {/* View Mode Toggle */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">View Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={viewMode === 'all' ? 'default' : 'outline'}
                    onClick={() => setViewMode('all')}
                    className="h-11"
                  >
                    <Map className="h-4 w-4 mr-2" />
                    All
                  </Button>
                  <Button
                    variant={viewMode === 'saved' ? 'default' : 'outline'}
                    onClick={() => setViewMode('saved')}
                    disabled={!user}
                    className="h-11"
                  >
                    <List className="h-4 w-4 mr-2" />
                    My Saved
                  </Button>
                </div>
              </div>

              {/* Pin Controls */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Location Pin</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={isPinMode ? 'default' : 'outline'}
                    onClick={() => setIsPinMode(!isPinMode)}
                    className="h-11"
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    {isPinMode ? 'Tap Map...' : 'Drop Pin'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleResetToMyLocation}
                    disabled={!customPin}
                    className="h-11"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                </div>
              </div>

              {/* Radius Slider */}
              {activeCenter && (
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">
                    Search Radius: {radiusMiles} mile{radiusMiles !== 1 ? 's' : ''}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max={RADIUS_OPTIONS.length - 1}
                    step="1"
                    value={RADIUS_OPTIONS.indexOf(radiusMiles)}
                    onChange={(e) => setRadiusMiles(RADIUS_OPTIONS[Number(e.target.value)])}
                    className="w-full h-3 bg-muted rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1 mi</span>
                    <span>200 mi</span>
                  </div>
                </div>
              )}

              {/* Legend */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Legend</label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#EF4444] border border-white"></span>
                    <span>Hospital</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#3B82F6] border border-white"></span>
                    <span>Clinic</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#8B5CF6] border border-white"></span>
                    <span>Hospice</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#F59E0B] border border-white"></span>
                    <span>EMT</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#3B82F6] border border-white shadow-[0_0_0_2px_rgba(59,130,246,0.3)]"></span>
                    <span>You</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#EF4444] border border-white text-[6px] flex items-center justify-center">📌</span>
                    <span>Pin</span>
                  </div>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Controls - Hidden on mobile */}
      {/* Mode toggle */}
      <div className="hidden sm:flex absolute top-4 left-4 z-10 flex-wrap gap-2">
        <Button
          variant={viewMode === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('all')}
          className="bg-background/90 backdrop-blur-sm !text-[#EF4444] font-semibold"
        >
          <Map className="h-4 w-4 mr-2" />
          All Opportunities
        </Button>
        <Button
          variant={viewMode === 'saved' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('saved')}
          disabled={!user}
          className="bg-background/90 backdrop-blur-sm !text-[#EF4444] font-semibold"
        >
          <List className="h-4 w-4 mr-2" />
          My Saved
        </Button>
      </div>

      {/* Pin controls - Desktop only */}
      <div className="hidden sm:flex absolute top-16 left-4 z-10 flex-wrap gap-2">
        <Button
          variant={isPinMode ? 'default' : 'outline'}
          size="sm"
          onClick={() => setIsPinMode(!isPinMode)}
          className="bg-background/90 backdrop-blur-sm !text-[#EF4444] font-semibold"
        >
          <MapPin className="h-4 w-4 mr-2" />
          {isPinMode ? 'Click map to place pin...' : 'Drop Pin'}
        </Button>
        {customPin && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetToMyLocation}
            className="bg-background/90 backdrop-blur-sm !text-[#EF4444] font-semibold"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to My Location
          </Button>
        )}
      </div>

      {/* Stats badge - Desktop only */}
      <div className="hidden sm:block absolute top-4 right-16 z-10">
        <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm text-foreground">
          {displayCount} {activeCenter ? `within ${radiusMiles} mi` : 'total'}
        </Badge>
      </div>

      {/* Radius control - Desktop only */}
      {activeCenter && (
        <div className="hidden sm:block absolute top-28 left-4 z-10 bg-background/90 backdrop-blur-sm rounded-lg p-3 border border-border">
          <label className="text-xs font-medium text-foreground mb-2 block">
            Radius: {radiusMiles} mile{radiusMiles !== 1 ? 's' : ''}
          </label>
          <input
            type="range"
            min="0"
            max={RADIUS_OPTIONS.length - 1}
            step="1"
            value={RADIUS_OPTIONS.indexOf(radiusMiles)}
            onChange={(e) => setRadiusMiles(RADIUS_OPTIONS[Number(e.target.value)])}
            className="w-32 h-2 bg-muted rounded-lg appearance-none cursor-pointer"
          />
        </div>
      )}

      {/* Location prompt - Desktop only */}
      {!activeCenter && !loading && opportunities.length > 0 && (
        <div className="hidden sm:block absolute top-28 left-4 z-10 bg-primary/90 backdrop-blur-sm rounded-lg p-3 border border-primary max-w-xs">
          <p className="text-sm text-primary-foreground font-medium">
            📍 Showing all {displayCount} opportunities. Enable location or drop a pin to filter by distance.
          </p>
        </div>
      )}

      {/* Legend - Desktop only (mobile has it in the bottom sheet) */}
      <div className="hidden sm:block absolute bottom-4 left-4 z-10 bg-background/90 backdrop-blur-sm rounded-lg p-3 border border-border">
        <p className="text-xs font-medium text-foreground mb-2">Legend</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-[#EF4444] border-2 border-white"></span>
            <span className="text-muted-foreground">Hospital</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-[#3B82F6] border-2 border-white"></span>
            <span className="text-muted-foreground">Clinic</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-[#8B5CF6] border-2 border-white"></span>
            <span className="text-muted-foreground">Hospice</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-[#F59E0B] border-2 border-white"></span>
            <span className="text-muted-foreground">EMT</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#3B82F6] border-2 border-white shadow-[0_0_0_4px_rgba(59,130,246,0.3)]"></span>
            <span className="text-muted-foreground">You</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-[#EF4444] border-2 border-white flex items-center justify-center text-[8px]">📌</span>
            <span className="text-muted-foreground">Custom Pin</span>
          </div>
        </div>
      </div>

      {/* No saved message */}
      {viewMode === 'saved' && savedOpportunities.length === 0 && !loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="bg-background/90 backdrop-blur-sm rounded-lg p-6 text-center border border-border">
            <List className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">
              {user ? "You haven't saved any opportunities yet" : "Log in to see your saved opportunities"}
            </p>
          </div>
        </div>
      )}

      {/* Map container */}
      <div ref={mapContainer} className="absolute inset-0" />
    </div>
  );
};

export default OpportunityMap;
