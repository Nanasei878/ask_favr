import fetch from 'node-fetch';

interface MapboxReverseGeocodeResponse {
  features: Array<{
    place_name: string;
    context: Array<{
      id: string;
      text: string;
    }>;
  }>;
}

export async function getCountryFromCoordinates(latitude: number, longitude: number): Promise<string | null> {
  const mapboxToken = process.env.VITE_MAPBOX_TOKEN;
  if (!mapboxToken) {
    console.warn('VITE_MAPBOX_TOKEN not available for reverse geocoding');
    return null;
  }

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${mapboxToken}&types=country`;
    
    const response = await fetch(url);
    const data = await response.json() as MapboxReverseGeocodeResponse;
    
    if (data.features && data.features.length > 0) {
      const country = data.features[0].text || data.features[0].place_name;
      return country;
    }
    
    return null;
  } catch (error) {
    console.error('Error reverse geocoding country:', error);
    return null;
  }
}

export async function getCityAndCountryFromCoordinates(latitude: number, longitude: number): Promise<{ city: string | null; country: string | null }> {
  const mapboxToken = process.env.VITE_MAPBOX_TOKEN;
  if (!mapboxToken) {
    console.warn('VITE_MAPBOX_TOKEN not available for reverse geocoding');
    return { city: null, country: null };
  }

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${mapboxToken}&types=place,country`;
    
    const response = await fetch(url);
    const data = await response.json() as MapboxReverseGeocodeResponse;
    
    let city: string | null = null;
    let country: string | null = null;
    
    if (data.features && data.features.length > 0) {
      for (const feature of data.features) {
        if (feature.context) {
          for (const context of feature.context) {
            if (context.id.startsWith('country')) {
              country = context.text;
            }
            if (context.id.startsWith('place')) {
              city = context.text;
            }
          }
        }
        
        // If it's a country feature directly
        if (feature.place_name && !country) {
          const parts = feature.place_name.split(', ');
          country = parts[parts.length - 1];
        }
      }
    }
    
    return { city, country };
  } catch (error) {
    console.error('Error reverse geocoding location:', error);
    return { city: null, country: null };
  }
}