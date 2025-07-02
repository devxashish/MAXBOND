import React, { useState, useEffect } from 'react';
import { getGeoZones, createGeoZone, updateGeoZone, deleteGeoZone } from '../../services/attendanceService';
import { isAdminUser } from '../../services/authService';
import AdminGeofenceForm from './AdminGeofenceForm';
import AdminGeofenceList from './AdminGeofenceList';
import './AdminGeofencePage.css';

export default function AdminGeofencePage() {
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
      const newZone = await createGeoZone(zoneData);
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
    <div className="admin-geofence-page">
      <h2 className="ios-page-title">Geofence Management</h2>
      
      <div className="geofence-management-container">
        <div className="geofence-form-section">
          <AdminGeofenceForm 
            editingZone={editingZone}
            onCreate={handleCreate}
            onUpdate={handleUpdate}
            onCancel={() => setEditingZone(null)}
          />
        </div>
        
        <div className="geofence-list-section">
          <AdminGeofenceList 
            geozones={geozones}
            onEdit={setEditingZone}
            onDelete={handleDelete}
          />
        </div>
      </div>
    </div>
  );
}