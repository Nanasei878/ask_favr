// Location privacy utilities for Favr platform

export interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
}

export interface PrivacyAwareLocation {
  displayLatitude: number;
  displayLongitude: number;
  displayAddress: string;
  exactLatitude?: number;
  exactLongitude?: number;
  exactAddress?: string;
}

/**
 * Generates a random offset within 300m radius for location privacy
 * @param lat Original latitude
 * @param lng Original longitude
 * @returns Offset coordinates approximately 300m away
 */
export function generateLocationOffset(lat: number, lng: number): { lat: number; lng: number } {
  // 300m in degrees (approximately)
  // 1 degree latitude ≈ 111km, so 300m ≈ 0.0027 degrees
  // 1 degree longitude varies by latitude, but at Luxembourg's latitude (49.6°): 
  // 1 degree longitude ≈ 71km, so 300m ≈ 0.0042 degrees
  
  const offsetLat = 0.0027;
  const offsetLng = 0.0042;
  
  // Generate random angle (0-360 degrees)
  const angle = Math.random() * 2 * Math.PI;
  
  // Generate random distance (50-300m to ensure it's not too close)
  const distance = 50 + Math.random() * 250; // 50-300m
  const distanceRatio = distance / 300; // Normalize to our max offset
  
  // Calculate offset
  const latOffset = Math.cos(angle) * offsetLat * distanceRatio;
  const lngOffset = Math.sin(angle) * offsetLng * distanceRatio;
  
  return {
    lat: lat + latOffset,
    lng: lng + lngOffset
  };
}

/**
 * Extracts neighborhood/area from full address for privacy
 * @param fullAddress Complete address string
 * @returns Approximate area description
 */
export function getPrivateAddress(fullAddress: string): string {
  const addressLower = fullAddress.toLowerCase();
  
  // Check for Sweden addresses first
  if (addressLower.includes('sweden') || addressLower.includes('sverige')) {
    // Extract Swedish postal code (5 digits like 12345)
    const swedenPostalMatch = fullAddress.match(/\b(\d{3}\s?\d{2})\b/);
    if (swedenPostalMatch) {
      // Get city name - usually comes after postal code
      const afterPostal = fullAddress.split(swedenPostalMatch[0])[1];
      if (afterPostal) {
        const cityMatch = afterPostal.match(/\s*([^,\n]+)/);
        if (cityMatch) {
          return cityMatch[1].trim();
        }
      }
    }
    
    // Fallback: look for common Swedish city names
    const swedishCities = [
      'Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Linköping', 'Västerås', 
      'Örebro', 'Norrköping', 'Helsingborg', 'Jönköping', 'Umeå', 'Lund',
      'Borås', 'Sundsvall', 'Gävle', 'Trollhättan', 'Eskilstuna', 'Karlstad'
    ];
    
    for (let city of swedishCities) {
      if (addressLower.includes(city.toLowerCase())) {
        return city;
      }
    }
    
    return "Sweden";
  }
  
  // Luxembourg neighborhoods with postal code mapping
  const luxembourgAreasByPostal: Record<string, string> = {
    '1932': 'Bonnevoie',
    '1933': 'Bonnevoie',
    '1934': 'Bonnevoie',
    '1148': 'Kirchberg', 
    '1149': 'Kirchberg',
    '1150': 'Kirchberg',
    '1882': 'Hollerich',
    '1347': 'Cessange',
    '1246': 'Merl',
    '1215': 'Belair',
    '1470': 'Limpertsberg',
    '1259': 'Rollingergrund',
    '1221': 'Beggen',
    '1425': 'Dommeldange',
    '1450': 'Eich',
  };
  
  // Extract Luxembourg postal code from address (like 1932 Luxembourg)
  const postalMatch = fullAddress.match(/\b(\d{4})\s+Luxembourg/i);
  if (postalMatch) {
    const postal = postalMatch[1];
    if (luxembourgAreasByPostal[postal]) {
      return luxembourgAreasByPostal[postal];
    }
  }
  
  // Check for Luxembourg neighborhood names in address
  const luxembourgAreas = [
    'Bonnevoie', 'Kirchberg', 'Hollerich', 'Cessange', 'Merl', 'Belair', 
    'Limpertsberg', 'Rollingergrund', 'Beggen', 'Dommeldange', 'Eich',
    'Muhlenbach', 'Neudorf', 'Pfaffenthal', 'Weimershof', 'Cents',
    'Hamm', 'Pulvermuhl', 'Clausen', 'Grund', 'Gasperich'
  ];
  
  for (let area of luxembourgAreas) {
    if (addressLower.includes(area.toLowerCase())) {
      return area;
    }
  }
  
  // Check for other countries and extract city names
  if (addressLower.includes('france') || addressLower.includes('paris')) {
    return extractCityFromAddress(fullAddress, 'France');
  }
  if (addressLower.includes('germany') || addressLower.includes('deutschland')) {
    return extractCityFromAddress(fullAddress, 'Germany');
  }
  if (addressLower.includes('belgium') || addressLower.includes('belgique')) {
    return extractCityFromAddress(fullAddress, 'Belgium');
  }
  
  // Default: try to extract city from address format
  return extractCityFromAddress(fullAddress, 'Unknown location');
}

function extractCityFromAddress(address: string, fallback: string): string {
  // Try to extract city name from address - usually the last part before country
  const parts = address.split(',').map(p => p.trim());
  if (parts.length >= 2) {
    // Take the second-to-last part as it's usually the city
    const cityCandidate = parts[parts.length - 2];
    if (cityCandidate && cityCandidate.length > 2) {
      return cityCandidate;
    }
  }
  return fallback;
}

/**
 * Creates privacy-aware location data for favor display
 * @param location Original location data
 * @param isOwner Whether the viewer is the favor poster
 * @returns Location data with appropriate privacy level
 */
export function createPrivacyAwareLocation(
  location: LocationData, 
  isOwner: boolean
): PrivacyAwareLocation {
  if (isOwner) {
    // Show exact location to the owner
    return {
      displayLatitude: location.latitude,
      displayLongitude: location.longitude,
      displayAddress: location.address,
      exactLatitude: location.latitude,
      exactLongitude: location.longitude,
      exactAddress: location.address
    };
  } else {
    // Show approximate location to public viewers
    const offset = generateLocationOffset(location.latitude, location.longitude);
    return {
      displayLatitude: offset.lat,
      displayLongitude: offset.lng,
      displayAddress: getPrivateAddress(location.address),
      exactLatitude: location.latitude,
      exactLongitude: location.longitude,
      exactAddress: location.address
    };
  }
}