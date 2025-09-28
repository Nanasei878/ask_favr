import { useState, useEffect } from "react";

declare global {
  interface Window {
    mapboxgl: any;
  }
}

export function useMapbox() {
  const [mapboxgl, setMapboxgl] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if MapBox is already loaded
    if (window.mapboxgl) {
      window.mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoiZmF2ci1hcHAiLCJhIjoiY2x0ZXh0dWFxMGdyZzJqbnVrOTRzeXVwNSJ9.example';
      setMapboxgl(window.mapboxgl);
      setLoading(false);
      return;
    }

    // Load MapBox GL JS
    const script = document.createElement('script');
    script.src = 'https://api.mapbox.gl.js/mapbox-gl-js/v2.15.0/mapbox-gl.js';
    script.onload = () => {
      if (window.mapboxgl) {
        window.mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoiZmF2ci1hcHAiLCJhIjoiY2x0ZXh0dWFxMGdyZzJqbnVrOTRzeXVwNSJ9.example';
        setMapboxgl(window.mapboxgl);
      }
      setLoading(false);
    };
    script.onerror = () => {
      setError("Failed to load MapBox GL JS");
      setLoading(false);
    };

    // Load MapBox CSS
    const link = document.createElement('link');
    link.href = 'https://api.mapbox.gl.js/mapbox-gl-js/v2.15.0/mapbox-gl.css';
    link.rel = 'stylesheet';

    document.head.appendChild(script);
    document.head.appendChild(link);

    return () => {
      // Cleanup if needed
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
    };
  }, []);

  return { mapboxgl, loading, error };
}
