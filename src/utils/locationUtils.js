// ✅ Location distance checker (Haversine formula)

export const isWithinAllowedRange = (userLat, userLng, officeLat, officeLng, rangeInMeters = 200) => {
  const toRad = deg => (deg * Math.PI) / 180;

  const R = 6371e3; // Earth radius in meters
  const φ1 = toRad(userLat);
  const φ2 = toRad(officeLat);
  const Δφ = toRad(officeLat - userLat);
  const Δλ = toRad(officeLng - userLng);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c;

  return distance <= rangeInMeters;
};
