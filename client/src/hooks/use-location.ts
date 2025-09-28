import { useState, useEffect } from "react";

interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
}

export function useLocation() {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      setLoading(false);
      return;
    }

    // Check if we're in a secure context (required for production)
    const isSecureContext = window.isSecureContext || window.location.protocol === 'https:';
    const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    
    if (isProduction && !isSecureContext) {
      console.warn("Geolocation requires HTTPS in production");
      setLocation({
        latitude: 49.6116,
        longitude: 6.1319,
        address: "Luxembourg City, Luxembourg"
      });
      setError("Location requires secure connection. Using Luxembourg center as default.");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          // Use reverse geocoding to get actual full address for poster
          const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
          
          if (!mapboxToken) {
            console.warn("MapBox token not found, using coordinates");
            setLocation({
              latitude,
              longitude,
              address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
            });
            setLoading(false);
            return;
          }
          
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${mapboxToken}&types=address,poi,place&limit=1`
          );
          
          if (response.ok) {
            const data = await response.json();
            let address = "Current location";
            
            if (data.features?.[0]) {
              const place = data.features[0];
              // For poster: show full address with street number
              address = place.place_name || "Current location";
            }
            
            setLocation({
              latitude,
              longitude,
              address
            });
          } else {
            // Fallback to coordinate display if reverse geocoding fails
            setLocation({
              latitude,
              longitude,
              address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
            });
          }
        } catch (error) {
          console.warn("Reverse geocoding failed:", error);
          setLocation({
            latitude,
            longitude,
            address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
          });
        }
        
        setLoading(false);
      },
      (error) => {
        let errorMessage = "Unknown location error";
        
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location access denied by user";
            console.warn("Geolocation error: User denied location permission");
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information unavailable";
            console.warn("Geolocation error: Position unavailable");
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out";
            console.warn("Geolocation error: Request timed out");
            break;
          default:
            errorMessage = error.message || "Location service failed";
            console.warn("Geolocation error:", error.code, error.message);
            break;
        }
        
        // Fallback to Luxembourg center for European users
        setLocation({
          latitude: 49.6116,
          longitude: 6.1319,
          address: "Luxembourg City, Luxembourg"
        });
        setError(errorMessage + ". Using Luxembourg center as default.");
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000, // Increased timeout for production
        maximumAge: 300000 // 5 minutes
      }
    );
  }, []);

  return { location, error, loading };
}
