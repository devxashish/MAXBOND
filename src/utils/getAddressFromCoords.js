export const getAddressFromCoords = async (lat, lng) => {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data && data.display_name) {
      return data.display_name;
    } else {
      return "Unknown Location";
    }
  } catch (error) {
    console.error("Reverse geocoding failed:", error);
    return "Unknown Location";
  }
};
