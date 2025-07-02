import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { watchAttendance, getGeoZones } from '../../services/attendanceService';
import './AdminLivePreview.css';

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

export default function AdminLivePreview() {
  const [currentUsers, setCurrentUsers] = useState([]);
  const [geozones, setGeozones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'in', 'out'

  useEffect(() => {
    const loadZones = async () => {
      try {
        const zones = await getGeoZones();
        setGeozones(zones);
      } catch (err) {
        console.error('Error loading zones:', err);
      }
    };
    
    loadZones();
    
    // Set up real-time listener
    const unsubscribe = watchAttendance((records) => {
      // Get latest record for each user
      const userMap = new Map();
      
      records.forEach(record => {
        if (!userMap.has(record.userId) || 
            new Date(record.timestamp) > new Date(userMap.get(record.userId).timestamp)) {
          userMap.set(record.userId, record);
        }
      });
      
      setCurrentUsers(Array.from(userMap.values()));
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  const filteredUsers = currentUsers.filter(user => {
    if (filter === 'all') return true;
    return user.action === filter;
  });

  return (
    <div className="ios-card">
      <h3 className="ios-card-title">Live Attendance Preview</h3>
      
      <div className="ios-segmented-control">
        <button 
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button 
          className={filter === 'in' ? 'active' : ''}
          onClick={() => setFilter('in')}
        >
          Checked In
        </button>
        <button 
          className={filter === 'out' ? 'active' : ''}
          onClick={() => setFilter('out')}
        >
          Checked Out
        </button>
      </div>
      
      {loading ? (
        <div className="ios-spinner-container">
          <div className="ios-spinner"></div>
        </div>
      ) : (
        <>
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
              
              {geozones.map(zone => (
                <Circle 
                  key={zone.id}
                  center={[zone.center.latitude, zone.center.longitude]} 
                  radius={zone.radius} 
                  color="#007AFF"
                  fillOpacity={0.1}
                />
              ))}
              
              {filteredUsers.map(user => (
                <Marker 
                  key={user.id}
                  position={[
                    user.location?.latitude || 28.6139, 
                    user.location?.longitude || 77.2090
                  ]}
                  icon={L.icon({
                    iconUrl: user.action === 'in' 
                      ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png'
                      : 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
                    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                  })}
                >
                  <Popup>
                    <strong>{user.userName || 'Unknown'}</strong><br />
                    Status: {user.action.toUpperCase()}<br />
                    Time: {new Date(user.timestamp).toLocaleTimeString()}
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
          
          <div className="ios-list">
            {filteredUsers.length === 0 ? (
              <div className="ios-list-item">
                No users found with current filter
              </div>
            ) : (
              filteredUsers.map(user => (
                <div key={user.id} className="ios-list-item">
                  <div className={`status-indicator ${user.action}`}></div>
                  <div className="user-info">
                    <strong>{user.userName || 'Unknown'}</strong>
                    <span>{new Date(user.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="status-badge">
                    {user.action.toUpperCase()}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}