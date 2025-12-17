// Reverse geocoding utility using OpenStreetMap Nominatim API
// Free, no API key required

export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'BiometricAttendanceSystem/1.0'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Geocoding failed');
    }

    const data = await response.json();
    
    // Extract meaningful location from response
    const address = data.address || {};
    
    // Priority: building > amenity > road > suburb > city
    const location = 
      address.building ||
      address.amenity ||
      address.road ||
      address.suburb ||
      address.city ||
      address.town ||
      address.village ||
      'Unknown Location';
    
    // Add city/state for context if available
    const context = address.city || address.state || '';
    
    return context ? `${location}, ${context}` : location;
    
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    // Return coordinates as fallback
    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  }
}
