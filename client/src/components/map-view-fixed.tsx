import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { createPrivacyAwareLocation } from "@shared/locationUtils";
import { useAuth } from "@/hooks/use-auth";
import { calculateFavorExpiration } from "@/lib/favorExpiration";
import type { Favor } from "@shared/schema";

declare global {
  interface Window {
    mapboxgl: any;
  }
}

interface MapViewProps {
  favors: Favor[];
  onFavorClick: (favor: Favor) => void;
}

export default function MapView({ favors, onFavorClick }: MapViewProps) {
  const { user } = useAuth();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [isLoadingMap, setIsLoadingMap] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const markersRef = useRef<any[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  // Category colors for the colored dots
  const categoryColors: Record<string, string> = {
    'Handyman': '#f59e0b', // amber
    'Ride': '#3b82f6',     // blue  
    'Pet Care': '#10b981', // emerald
    'Others': '#6b7280',   // gray
    'Delivery': '#a855f7', // purple
    'Moving': '#eab308'    // yellow
  };

  const getUserLocation = (): Promise<[number, number]> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { longitude, latitude } = position.coords;
          resolve([longitude, latitude]);
        },
        (error) => {
          console.warn('Geolocation error:', error);
          // Fallback to Luxembourg coordinates
          resolve([6.1296, 49.6116]);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    });
  };

  const loadMapboxGL = () => {
    return new Promise<void>((resolve, reject) => {
      if (window.mapboxgl) {
        resolve();
        return;
      }

      // Load CSS
      const link = document.createElement('link');
      link.href = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css';
      link.rel = 'stylesheet';
      document.head.appendChild(link);

      // Load JS
      const script = document.createElement('script');
      script.src = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Mapbox GL JS'));
      document.head.appendChild(script);
    });
  };

  const clearMarkers = () => {
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
  };

  const initializeMap = async () => {
    if (!mapContainerRef.current) return;

    try {
      setIsLoadingMap(true);
      setMapError(null);

      await loadMapboxGL();

      if (!import.meta.env.VITE_MAPBOX_TOKEN) {
        throw new Error('Mapbox token is required');
      }

      window.mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

      // Get user's current location or fallback to Luxembourg
      const location = await getUserLocation();
      setUserLocation(location);

      const map = new window.mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: location,
        zoom: 12,
        attributionControl: false
      });

      map.on('load', () => {
        console.log('Map loaded successfully');
        setMapLoaded(true);
        setIsLoadingMap(false);
      });

      map.on('error', (e: any) => {
        console.error('Map error:', e);
        setMapError('Failed to load map');
        setIsLoadingMap(false);
      });

      mapRef.current = map;
    } catch (error) {
      console.error('Failed to initialize map:', error);
      setMapError(error instanceof Error ? error.message : 'Failed to load map');
      setIsLoadingMap(false);
    }
  };

  const handleRetryMap = () => {
    setMapError(null);
    setIsLoadingMap(true);
    setTimeout(() => initializeMap(), 100);
  };

  // Add Airbnb-style favor previews to the map
  const addMarkersToMap = useCallback(() => {
    if (!mapRef.current || !favors.length) return;

    // Clear existing markers
    clearMarkers();

    favors.forEach(favor => {
      // Determine if current user is the owner of this favor
      const isOwner = user?.id?.toString() === favor.posterId?.toString();
      
      // Calculate expiration info
      const expirationInfo = calculateFavorExpiration(
        typeof favor.createdAt === 'string' ? favor.createdAt : favor.createdAt?.toISOString() || new Date().toISOString(),
        favor.timeframe
      );
      
      // Get privacy-aware location
      const locationData = {
        latitude: parseFloat(favor.latitude),
        longitude: parseFloat(favor.longitude),
        address: favor.address
      };
      
      const privacyLocation = createPrivacyAwareLocation(locationData, isOwner);
      
      // Create Airbnb-style favor preview card
      const markerElement = document.createElement('div');
      markerElement.className = 'favor-preview-card';
      markerElement.style.cssText = `
        width: 140px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        cursor: pointer;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        transform: translateY(-50%);
        border: 1px solid rgba(0,0,0,0.08);
        font-size: 12px;
      `;

      const imageUrl = favor.imageUrl || '/api/placeholder/180/120';
      
      markerElement.innerHTML = `
        <div style="position: relative;">
          <img src="${imageUrl}" alt="${favor.title}" 
               style="width: 100%; height: 60px; object-fit: cover; border-radius: 8px 8px 0 0;" 
               onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTQwIiBoZWlnaHQ9IjYwIiB2aWV3Qm94PSIwIDAgMTQwIDYwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cmVjdCB3aWR0aD0iMTQwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik03MCAzMEM3NC45NzA2IDMwIDc5IDM0LjAyOTQgNzkgMzlDNzkgNDMuOTcwNiA3NC45NzA2IDQ4IDcwIDQ4Qzc4LjMwNzggNDggNjYuNTg2OSA0Ny4zNDU0IDY1LjI1IDQ2LjIzNTRWNDVINzBWNDJINjJWMzBINjVWMzIuNTE0QzY2LjU4NjkgMzEuNDA0NiA2OC4zMDc4IDMwIDcwIDMwWiIgZmlsbD0iIzlDQTRBRiIvPgo8L3N2Zz4K'" />
          <div style="position: absolute; top: 4px; right: 4px; background: white; border-radius: 3px; padding: 1px 4px; font-size: 9px; font-weight: 600; color: #059669;">
            €${favor.price}
          </div>
        </div>
        <div style="padding: 6px;">
          <div style="font-size: 11px; font-weight: 600; color: #1f2937; margin-bottom: 1px; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${favor.title}
          </div>
          <div style="font-size: 9px; color: #6b7280; line-height: 1.2; height: 20px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
            ${favor.description}
          </div>
          <div style="font-size: 8px; color: ${expirationInfo.isExpired ? '#f87171' : '#9ca3af'}; margin-top: 2px; ${expirationInfo.isExpired ? 'text-decoration: line-through;' : ''}">
            ${expirationInfo.isExpired ? 'Expired' : favor.timeframe}
          </div>
        </div>
      `;

      markerElement.addEventListener('click', () => {
        onFavorClick(favor);
      });

      // Use privacy-aware coordinates for marker placement
      const marker = new window.mapboxgl.Marker(markerElement)
        .setLngLat([privacyLocation.displayLongitude, privacyLocation.displayLatitude])
        .addTo(mapRef.current);

      markersRef.current.push(marker);
    });
  }, [favors, onFavorClick, user]);

  useEffect(() => {
    setTimeout(() => initializeMap(), 100);
  }, []);

  // Update markers when favors change
  useEffect(() => {
    if (mapLoaded) {
      addMarkersToMap();
    }
  }, [favors, mapLoaded, addMarkersToMap]);

  return (
    <div className="w-full h-full bg-slate-900 relative">
      {isLoadingMap && (
        <div className="absolute inset-0 bg-slate-900 flex items-center justify-center z-10">
          <div className="text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
            <p className="text-slate-300">Loading map...</p>
          </div>
        </div>
      )}
      
      {mapError && (
        <div className="absolute inset-0 bg-slate-900 flex items-center justify-center z-10">
          <div className="text-center space-y-4">
            <p className="text-red-400">{mapError}</p>
            <Button onClick={handleRetryMap} variant="outline" size="sm">
              Retry Map
            </Button>
          </div>
        </div>
      )}
      
      <div 
        ref={mapContainerRef} 
        className="w-full h-full"
        style={{ visibility: isLoadingMap || mapError ? 'hidden' : 'visible' }}
      />
    </div>
  );
}