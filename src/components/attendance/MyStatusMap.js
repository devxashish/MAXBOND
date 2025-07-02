import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getGeoZones } from '../../services/attendanceService';
import { getCurrentUser } from '../../services/authService';
import './MyStatusMap.css';

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

export default function MyStatusMap() {
  const [geozones, setGeozones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const zones = await getGeoZones();
        setGeozones(zones);
        
        // Get current position
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setCurrentLocation({
                lat: position.coords.latitude,
                lng: position.coords.longitude
              });
            },
            (err) => {
              console.error('Geolocation error:', err);
              setError('Could not get your current location');
            }
          );
        }
      } catch (err) {
        setError('Failed to load location data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="ios-card">
        <div className="ios-spinner"></div>
        <p>Loading map data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ios-card">
        <div className="ios-alert danger">
          <i className="fas fa-exclamation-circle"></i>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="ios-card">
      <h3 className="ios-card-title">My Location Status</h3>
      
      <div className="map-container">
        <MapContainer 
          center={currentLocation || [28.6139, 77.2090]} 
          zoom={13} 
          style={{ height: '300px', width: '100%', borderRadius: '12px' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          
          {geozones.map(zone => (
            <React.Fragment key={zone.id}>
              <Circle 
                center={[zone.center.latitude, zone.center.longitude]} 
                radius={zone.radius} 
                color="#007AFF" 
                fillOpacity={0.2}
              />
              <Marker position={[zone.center.latitude, zone.center.longitude]}>
                <Popup>
                  <strong>{zone.name}</strong><br />
                  Radius: {zone.radius}m
                </Popup>
              </Marker>
            </React.Fragment>
          ))}
          
          {currentLocation && (
            <Marker position={[currentLocation.lat, currentLocation.lng]}>
              <Popup>
                <strong>Your Current Location</strong>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
      
      <div className="ios-card-footer">
        <i className="fas fa-info-circle"></i>
        This map shows all company geo-zones and your current location
      </div>
    </div>
  );
}