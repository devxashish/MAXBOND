import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './AdminGeofenceForm.css';

// Fix marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

export default function AdminGeofenceForm({ editingZone, onCreate, onUpdate, onCancel }) {
  const [name, setName] = useState('');
  const [lat, setLat] = useState(28.6139);
  const [lng, setLng] = useState(77.2090);
  const [radius, setRadius] = useState(100);
  const [isActive, setIsActive] = useState(true);
  const [map, setMap] = useState(null);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    if (editingZone) {
      setName(editingZone.name);
      setLat(editingZone.center.latitude);
      setLng(editingZone.center.longitude);
      setRadius(editingZone.radius);
      setIsActive(editingZone.isActive);
      if (map) {
        map.flyTo([editingZone.center.latitude, editingZone.center.longitude], 16);
      }
    }
  }, [editingZone, map]);

  const handleMapClick = (e) => {
    setLat(e.latlng.lat);
    setLng(e.latlng.lng);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const zoneData = {
      name,
      center: { lat, lng },
      radius,
      isActive
    };

    const result = editingZone 
      ? await onUpdate(editingZone.id, zoneData)
      : await onCreate(zoneData);

    if (result.success) {
      setName('');
      setLat(28.6139);
      setLng(77.2090);
      setRadius(100);
      setIsActive(true);
    }
  };

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
        }
      );
    }
  };

  return (
    <div className="ios-card">
      <h3 className="ios-card-title">
        {editingZone ? 'Edit Geofence' : 'Create New Geofence'}
      </h3>

      <div className="map-container">
        <div className="map-controls">
          <button 
            className="ios-button small"
            onClick={getCurrentPosition}
            disabled={isLocating}
            type="button"
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
          <Marker position={[lat, lng]} />
          <Circle center={[lat, lng]} radius={radius} color="#007AFF" fillOpacity={0.1} />
        </MapContainer>
      </div>

      <form onSubmit={handleSubmit} className="ios-form">
        <div className="ios-form-group">
          <label>Geofence Name</label>
          <input
            type="text"
            placeholder="Office, Site, etc."
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
        </div>

        <div className="ios-form-group">
          <label className="ios-switch">
            Active
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span className="ios-slider"></span>
          </label>
        </div>

        <div className="ios-button-group">
          <button 
            type="submit" 
            className="ios-button primary"
          >
            {editingZone ? 'Update Geofence' : 'Create Geofence'}
          </button>
          {editingZone && (
            <button 
              type="button"
              className="ios-button"
              onClick={onCancel}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}