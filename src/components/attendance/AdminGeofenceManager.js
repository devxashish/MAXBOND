import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getGeoZones, createGeoZone, updateGeoZone, deleteGeoZone } from '../../services/attendanceService';
import { isAdminUser, getCurrentUser } from '../../services/authService';
import './AdminGeofenceManager.css';

// Fix marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

export default function AdminGeofenceManager() {
  const [geozones, setGeozones] = useState([]);
  const [editingZone, setEditingZone] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminAndLoadZones = async () => {
      try {
        setIsAdmin(await isAdminUser());
        const zones = await getGeoZones(true); // Include inactive zones
        setGeozones(zones);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAdminAndLoadZones();
  }, []);

  const handleCreate = async (zoneData) => {
    try {
      const admin = getCurrentUser();
      const newZone = await createGeoZone(
        zoneData.name,
        zoneData.center,
        zoneData.radius,
        admin.uid
      );
      setGeozones([...geozones, newZone]);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const handleUpdate = async (zoneId, updates) => {
    try {
      const updatedZone = await updateGeoZone(zoneId, updates);
      setGeozones(geozones.map(z => z.id === zoneId ? updatedZone : z));
      setEditingZone(null);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const handleDelete = async (zoneId) => {
    if (window.confirm('Are you sure you want to delete this geofence?')) {
      try {
        await deleteGeoZone(zoneId);
        setGeozones(geozones.filter(z => z.id !== zoneId));
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  };

  if (loading) {
    return (
      <div className="ios-card">
        <div className="ios-spinner"></div>
        <p>Loading geofence data...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="ios-card">
        <div className="ios-alert danger">
          <i className="fas fa-exclamation-circle"></i>
          Admin access required
        </div>
      </div>
    );
  }

  return (
    <div className="geofence-manager">
      <div className="ios-card">
        <h2 className="ios-card-title">Geofence Management</h2>
        
        <div className="geofence-editor">
          <div className="geofence-form-container">
            <h3>{editingZone ? 'Edit Geofence' : 'Create New Geofence'}</h3>
            <GeofenceForm 
              editingZone={editingZone}
              onCreate={handleCreate}
              onUpdate={handleUpdate}
              onCancel={() => setEditingZone(null)}
              geozones={geozones}
            />
          </div>
          
          <div className="geofence-list-container">
            <h3>Existing Geofences ({geozones.length})</h3>
            <GeofenceList 
              geozones={geozones}
              onEdit={setEditingZone}
              onDelete={handleDelete}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function GeofenceForm({ editingZone, onCreate, onUpdate, onCancel, geozones }) {
  const [name, setName] = useState('');
  const [lat, setLat] = useState(28.6139);
  const [lng, setLng] = useState(77.2090);
  const [radius, setRadius] = useState(100);
  const [isActive, setIsActive] = useState(true);
  const [map, setMap] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const markerRef = useRef(null);

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

  const handleMarkerDrag = (e) => {
    const position = markerRef.current.getLatLng();
    setLat(position.lat);
    setLng(position.lng);
  };

  const getCurrentPosition = () => {
    if (navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setLat(latitude);
          setLng(longitude);
          setCurrentLocation({ lat: latitude, lng: longitude });
          if (map) {
            map.flyTo([latitude, longitude], 16);
          }
          setIsLocating(false);
        },
        (error) => {
          console.error('Geolocation error:', error);
          setIsLocating(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      alert('Geolocation is not supported by your browser');
    }
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

  return (
    <>
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
            <Marker 
              position={[lat, lng]} 
              draggable={true}
              eventHandlers={{ dragend: handleMarkerDrag }}
              ref={markerRef}
            >
              <Popup>
                Drag marker to adjust location
              </Popup>
            </Marker>
            <Circle center={[lat, lng]} radius={radius} color="#007AFF" fillOpacity={0.1} />
            
            {geozones.map(zone => (
              <Circle 
                key={zone.id}
                center={[zone.center.latitude, zone.center.longitude]} 
                radius={zone.radius} 
                color={zone.isActive ? '#34C759' : '#FF9500'}
                fillOpacity={0.1}
              />
            ))}
          </MapContainer>
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
      
      {currentLocation && (
        <div className="ios-alert info">
          <i className="fas fa-info-circle"></i>
          Your current location: {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
        </div>
      )}
    </>
  );
}

function GeofenceList({ geozones, onEdit, onDelete }) {
  return (
    <div className="geofence-list">
      {geozones.length === 0 ? (
        <div className="ios-alert info">
          <i className="fas fa-info-circle"></i>
          No geofences found. Create your first geofence.
        </div>
      ) : (
        <table className="ios-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Location</th>
              <th>Radius</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {geozones.map(zone => (
              <tr key={zone.id}>
                <td>{zone.name}</td>
                <td>
                  {zone.center.latitude.toFixed(6)}, {zone.center.longitude.toFixed(6)}
                </td>
                <td>{zone.radius}m</td>
                <td>
                  <span className={`ios-badge ${zone.isActive ? 'active' : 'inactive'}`}>
                    {zone.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <button 
                    className="ios-button small"
                    onClick={() => onEdit(zone)}
                  >
                    <i className="fas fa-edit"></i>
                  </button>
                  <button 
                    className="ios-button small danger"
                    onClick={() => onDelete(zone.id)}
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}