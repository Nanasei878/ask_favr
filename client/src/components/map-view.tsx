import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
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
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [isLoadingMap, setIsLoadingMap] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const markersRef = useRef<any[]>([]);

  // Category colors for the colored dots
  const categoryColors: Record<string, string> = {
    'Handyman': '#f59e0b', // amber
    'Ride': '#3b82f6',     // blue  
    'Pet Care': '#10b981', // emerald
    'Others': '#6b7280',   // gray
    'Delivery': '#a855f7', // purple
    'Moving': '#eab308'    // yellow
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
      console.log('Initializing map...');
      setIsLoadingMap(true);
      setMapError(null);

      await loadMapboxGL();

      if (!import.meta.env.VITE_MAPBOX_TOKEN) {
        throw new Error('Mapbox token is required');
      }

      window.mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

      const map = new window.mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [6.1296, 49.6116], // Luxembourg coordinates
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

  // Add markers to the map as small colored dots
  const addMarkersToMap = useCallback(() => {
    if (!mapRef.current || !favors.length) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    favors.forEach(favor => {
      const color = categoryColors[favor.category] || '#6b7280';
      
      // Create a small colored dot marker
      const markerElement = document.createElement('div');
      markerElement.className = 'favor-marker';
      markerElement.style.cssText = `
        width: 12px;
        height: 12px;
        background-color: ${color};
        border: 2px solid white;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      `;

      markerElement.addEventListener('click', () => {
        onFavorClick(favor);
      });

      const marker = new window.mapboxgl.Marker(markerElement)
        .setLngLat([parseFloat(favor.longitude), parseFloat(favor.latitude)])
        .addTo(mapRef.current);

      markersRef.current.push(marker);
    });
  }, [favors, onFavorClick]);

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