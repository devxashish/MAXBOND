import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore"; // Import doc and getDoc for single doc fetch
import { db } from "../firebase";
import styles from "./SingleLocationMap.module.css"; // Import CSS Module

// Leaflet imports
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const SingleLocationMap = () => {
  const { attendanceId } = useParams(); // Get attendanceId from URL
  const [locationData, setLocationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSingleLocation = async () => {
      setLoading(true);
      setError(null);
      try {
        const attendanceDocRef = doc(db, "attendance", attendanceId);
        const docSnap = await getDoc(attendanceDocRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
            setLocationData(data);
          } else {
            setError("Invalid coordinates for this attendance entry.");
          }
        } else {
          setError("Attendance record not found.");
        }
      } catch (err) {
        console.error("Error fetching single location:", err);
        setError("Failed to load location data. Please ensure you are logged in and have read permissions for the 'attendance' collection. Try again.");
      } finally {
        setLoading(false);
      }
    };

    if (attendanceId) {
      fetchSingleLocation();
    }
  }, [attendanceId]);

  if (loading) {
    return (
      <div className={styles.mapPageContainer}>
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <p>Loading single location...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.mapPageContainer}>
        <div className={styles.errorState}>
          <p className={styles.errorMessageTitle}>Error!</p>
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className={styles.retryButton}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!locationData) { // This case should ideally be caught by error, but as a safeguard
    return (
      <div className={styles.mapPageContainer}>
        <div className={styles.noLocationState}>
          <p className={styles.noLocationTitle}>Location Data Not Available!</p>
          <p>The selected attendance record has no valid location details.</p>
        </div>
      </div>
    );
  }

  const position = [locationData.latitude, locationData.longitude];

  return (
    <div className={styles.mapPageContainer}>
      <div className={styles.mapContentWrapper}>
        <h2 className={styles.mapTitle}>
          <span role="img" aria-label="pin">📍</span>
          <span>Specific Location Detail</span>
          <span role="img" aria-label="pin">📍</span>
        </h2>

        <div className={styles.locationDetailsSummary}>
          <p className={styles.detailSummaryText}>
            Location Name: <span className={styles.detailSummaryCount}>{locationData.locationName || "N/A"}</span>
          </p>
          <p className={styles.detailSummaryText}>
            Time: <span className={styles.detailSummaryCount}>{locationData.timeText || "--"}</span>
          </p>
        </div>

        <div className={styles.mapContainer}>
          <MapContainer
            center={position}
            zoom={16} // Zoom in closely for a single location
            scrollWheelZoom={true}
            style={{ height: "100%", width: "100%" }}
            className={styles.leafletMap}
          >
            <TileLayer
              attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={position}>
              <Popup>
                <div className={styles.popupContent}>
                  <strong className={styles.popupLocationName}>
                    {locationData.locationName || "Unknown Location"}
                  </strong>{" "}
                  <br />
                  <span className={styles.popupTime}>Time: {locationData.timeText || "--"}</span>{" "}
                  <br />
                  <span className={styles.popupCoords}>
                    Lat: {locationData.latitude.toFixed(4)}, Lng:{" "}
                    {locationData.longitude.toFixed(4)}
                  </span>
                </div>
              </Popup>
            </Marker>
          </MapContainer>
        </div>
        <p className={styles.attributionNote}>
          **Note:** This map uses OpenStreetMap data, which is open-source and free to use with
          attribution.
        </p>
      </div>
    </div>
  );
};

export default SingleLocationMap;