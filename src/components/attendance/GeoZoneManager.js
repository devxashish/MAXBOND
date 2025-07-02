import React, { useState, useEffect } from 'react';
import { getGeoZones, updateGeoZone, deleteGeoZone } from '../../services/attendanceService';
import { MapContainer, TileLayer, Circle, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './GeoZoneManager.css';

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

export default function GeoZoneManager() {
  const [geozones, setGeozones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingZone, setEditingZone] = useState(null);
  const [radius, setRadius] = useState(100);
  const [name, setName] = useState('');

  useEffect(() => {
    const loadZones = async () => {
      try {
        const zones = await getGeoZones();
        setGeozones(zones);
      } catch (error) {
        console.error('Error loading geozones:', error);
      }
      setLoading(false);
    };
    
    loadZones();
  }, []);

  const handleUpdate = async () => {
    if (!editingZone) return;
    
    try {
      await updateGeoZone(editingZone.id, { name, radius });
      setGeozones(prev => prev.map(z => 
        z.id === editingZone.id ? { ...z, name, radius } : z
      ));
      setEditingZone(null);
    } catch (error) {
      console.error('Update failed:', error);
    }
  };

  const handleDelete = async (zoneId) => {
    if (window.confirm('Are you sure you want to delete this zone?')) {
      try {
        await deleteGeoZone(zoneId);
        setGeozones(prev => prev.filter(z => z.id !== zoneId));
      } catch (error) {
        console.error('Delete failed:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="ios-card">
        <div className="ios-spinner-container">
          <div className="ios-spinner"></div>
        </div>
      </div>
    );
  }

  // Filter out zones with invalid coordinates
  const validZones = geozones.filter(zone => 
    zone.center && 
    typeof zone.center.latitude === 'number' && 
    typeof zone.center.longitude === 'number'
  );

  return (
    <div className="ios-card">
      <h3 className="ios-card-title">Manage Location Zones</h3>
      
      <div className="map-container">
        <MapContainer 
          center={[28.6139, 77.2090]} 
          zoom={12} 
          style={{ height: '300px', width: '100%', borderRadius: '12px' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          
          {validZones.map(zone => (
            <React.Fragment key={zone.id}>
              <Circle 
                center={[zone.center.latitude, zone.center.longitude]} 
                radius={zone.radius} 
                color={editingZone?.id === zone.id ? '#FF3B30' : '#007AFF'} 
                fillOpacity={0.1}
              />
              <Marker position={[zone.center.latitude, zone.center.longitude]}>
                <Popup>
                  <strong>{zone.name}</strong><br />
                  Radius: {zone.radius}m
                  <div className="ios-button-group">
                    <button 
                      className="ios-button small"
                      onClick={() => {
                        setEditingZone(zone);
                        setName(zone.name);
                        setRadius(zone.radius);
                      }}
                    >
                      Edit
                    </button>
                    <button 
                      className="ios-button small danger"
                      onClick={() => handleDelete(zone.id)}
                    >
                      Delete
                    </button>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          ))}
        </MapContainer>
      </div>
      
      {editingZone && (
        <div className="ios-card editing-form">
          <h4>Edit Zone: {editingZone.name}</h4>
          <div className="ios-form-group">
            <label>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="ios-form-group">
            <label>Radius: {radius} meters</label>
            <input
              type="range"
              min="10"
              max="1000"
              value={radius}
              onChange={(e) => setRadius(parseInt(e.target.value))}
            />
          </div>
          <div className="ios-button-group">
            <button 
              className="ios-button primary"
              onClick={handleUpdate}
            >
              Save Changes
            </button>
            <button 
              className="ios-button"
              onClick={() => setEditingZone(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {geozones.length === 0 && (
        <div className="ios-alert info">
          <i className="fas fa-info-circle"></i>
          No geozones found. Create one using the form.
        </div>
      )}
    </div>
  );
}