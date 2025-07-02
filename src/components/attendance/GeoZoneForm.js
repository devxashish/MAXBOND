import React, { useState, useEffect, useRef } from 'react';
import { createGeoZone } from '../../services/attendanceService';
import { getCurrentUser, isAdminUser } from '../../services/authService';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { Icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './GeoZoneForm.css';

// Fix default marker icons
delete Icon.Default.prototype._getIconUrl;
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

export default function GeoZoneForm() {
  const [name, setName] = useState('');
  const [lat, setLat] = useState(28.6139);
  const [lng, setLng] = useState(77.2090);
  const [radius, setRadius] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [map, setMap] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [adminStatusChecked, setAdminStatusChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const markerRef = useRef(null);

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        setIsAdmin(await isAdminUser());
      } catch (err) {
        setError('Failed to verify admin status');
      } finally {
        setAdminStatusChecked(true);
      }
    };

    checkAdminStatus();
    getCurrentPosition();
  }, []);

  const getCurrentPosition = () => {
    if (navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLat(position.coords.latitude);
          setLng(position.coords.longitude);
          if (map) {
            map.flyTo([position.coords.latitude, position.coords.longitude], 16);
          }
          setIsLocating(false);
        },
        (error) => {
          console.error('Geolocation error:', error);
          setIsLocating(false);
          setError('Could not get your location');
        }
      );
    } else {
      setError('Geolocation not supported');
    }
  };

  const handleMapClick = (e) => {
    setLat(e.latlng.lat);
    setLng(e.latlng.lng);
  };

  const handleMarkerDrag = (e) => {
    const position = markerRef.current.getLatLng();
    setLat(position.lat);
    setLng(position.lng);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isAdmin) {
      setError('Only admin users can create geo zones');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const admin = getCurrentUser();
      await createGeoZone(
        name, 
        { lat, lng }, 
        radius,
        admin.uid
      );
      setSuccess('Geo zone created successfully!');
      setName('');
    } catch (err) {
      setError('Error creating location: ' + err.message);
    }
    
    setLoading(false);
  };

  if (!adminStatusChecked) {
    return (
      <div className="ios-card">
        <div className="ios-spinner-container">
          <div className="ios-spinner"></div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="ios-card">
        <h3 className="ios-card-title">Add New Location Zone</h3>
        <div className="ios-alert danger">
          <i className="fas fa-exclamation-circle"></i>
          You don't have permission to manage geo zones
        </div>
      </div>
    );
  }

  return (
    <div className="ios-card">
      <h3 className="ios-card-title">Add New Location Zone</h3>
      
      {error && (
        <div className="ios-alert danger">
          <i className="fas fa-exclamation-circle"></i>
          {error}
        </div>
      )}
      
      {success && (
        <div className="ios-alert success">
          <i className="fas fa-check-circle"></i>
          {success}
        </div>
      )}
      
      <div className="map-container">
        <div className="map-controls">
          <button 
            className="ios-button small"
            onClick={getCurrentPosition}
            disabled={isLocating}
          >
            {isLocating ? (
              <span className="ios-spinner small"></span>
            ) : (
              <>
                <i className="fas fa-location-arrow"></i> My Location
              </>
            )}
          </button>
        </div>
        
        <MapContainer 
          center={[lat, lng]} 
          zoom={15} 
          style={{ height: '250px', width: '100%', borderRadius: '12px' }}
          whenCreated={setMap}
          onClick={handleMapClick}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <Marker 
            position={[lat, lng]} 
            draggable={true}
            eventHandlers={{ dragend: handleMarkerDrag }}
            ref={markerRef}
          >
            <Popup>
              <div>
                <p>Drag me to adjust location</p>
                <p className="coordinates-info">
                  {lat.toFixed(6)}, {lng.toFixed(6)}
                </p>
              </div>
            </Popup>
          </Marker>
          <Circle center={[lat, lng]} radius={radius} color="#007AFF" fillOpacity={0.1} />
        </MapContainer>
      </div>
      
      <form onSubmit={handleSubmit} className="ios-form">
        <div className="ios-form-group">
          <label>Location Name</label>
          <input
            type="text"
            placeholder="Office, Store, etc."
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        
        <div className="ios-form-row">
          <div className="ios-form-group">
            <label>Latitude</label>
            <input
              type="number"
              step="any"
              value={lat}
              onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
              required
            />
          </div>
          <div className="ios-form-group">
            <label>Longitude</label>
            <input
              type="number"
              step="any"
              value={lng}
              onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
              required
            />
          </div>
        </div>
        
        <div className="ios-form-group">
          <label>Radius: {radius} meters</label>
          <input
            type="range"
            min="50"
            max="1000"
            value={radius}
            onChange={(e) => setRadius(parseInt(e.target.value))}
          />
          <div className="ios-form-hint">Area size for attendance detection</div>
        </div>
        
        <button 
          type="submit" 
          className="ios-button primary"
          disabled={loading}
        >
          {loading ? (
            <span className="ios-spinner small"></span>
          ) : 'Add Location Zone'}
        </button>
      </form>
    </div>
  );
}