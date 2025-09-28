import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface LocationState {
  granted: boolean;
  latitude?: number;
  longitude?: number;
  error?: string;
}

export function useLocationNotifications() {
  const [locationState, setLocationState] = useState<LocationState>({
    granted: false
  });

  useEffect(() => {
    // Check if geolocation is supported
    if (!navigator.geolocation) {
      setLocationState({
        granted: false,
        error: 'Geolocation is not supported by this browser'
      });
      return;
    }

    // Request location permission and get coordinates
    const requestLocation = () => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          setLocationState({
            granted: true,
            latitude,
            longitude
          });

          // Send location to server for notifications
          try {
            await apiRequest('POST', '/api/user/location', {
              latitude,
              longitude
            });
          } catch (error) {
            console.error('Failed to update location for notifications:', error);
          }
        },
        (error) => {
          let errorMessage = 'Location access denied';
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied. Enable location to get nearby favor notifications.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out';
              break;
          }
          
          setLocationState({
            granted: false,
            error: errorMessage
          });
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    };

    // Request location immediately
    requestLocation();

    // Update location every 10 minutes for active users
    const locationInterval = setInterval(requestLocation, 10 * 60 * 1000);

    return () => {
      clearInterval(locationInterval);
    };
  }, []);

  const requestLocationPermission = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          setLocationState({
            granted: true,
            latitude,
            longitude
          });

          try {
            await apiRequest('POST', '/api/user/location', {
              latitude,
              longitude
            });
          } catch (error) {
            console.error('Failed to update location:', error);
          }
        },
        (error) => {
          setLocationState({
            granted: false,
            error: 'Location access denied'
          });
        }
      );
    }
  };

  return {
    ...locationState,
    requestLocationPermission
  };
}