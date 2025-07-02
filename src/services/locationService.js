import { getCurrentPosition } from '../firebase';

// Background location tracking service
export const startBackgroundTracking = async (userId, callback) => {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    // Register background sync
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register('background-attendance');
    } catch (err) {
      console.error('Background sync registration failed:', err);
    }
  }

  // Fallback to regular tracking if background sync not available
  return setInterval(async () => {
    try {
      const position = await getCurrentPosition();
      callback({
        lat: position.coords.latitude,
        lng: position.coords.longitude
      });
    } catch (err) {
      console.error('Background location error:', err);
    }
  }, 30000); // 30 seconds
};

export const stopBackgroundTracking = (intervalId) => {
  clearInterval(intervalId);
};

// Get distance between two coordinates in meters
export const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
};

// Check if location is valid
export const isValidLocation = (location) => {
  return location && 
         typeof location.lat === 'number' && 
         typeof location.lng === 'number' &&
         location.lat >= -90 && location.lat <= 90 &&
         location.lng >= -180 && location.lng <= 180;
};