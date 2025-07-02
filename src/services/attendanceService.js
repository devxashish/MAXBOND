import { 
  db,
  isInsideGeofence, 
  initTracker, 
  setTrackingEnabled,
  startTracking as firebaseStartTracking,
  stopTracking as firebaseStopTracking,
  getCurrentStatus,
  logAttendanceEvent as firebaseLogAttendanceEvent,
  getCurrentPosition
} from '../firebase';

import { toast } from 'react-toastify';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot, 
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
  getDoc,
  limit,
  GeoPoint
} from 'firebase/firestore';

// Get all attendance records
export const getAllAttendance = async () => {
  const snapshot = await getDocs(collection(db, 'attendance'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Get user attendance with local sorting
export const getUserAttendance = async (userId) => {
  const q = query(
    collection(db, 'attendance'), 
    where('userId', '==', userId),
    orderBy('timestamp', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Real-time attendance watcher
export const watchAttendance = (callback) => {
  const q = query(collection(db, 'attendance'), orderBy('timestamp', 'desc'));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  });
};

// Check and log geofence-based attendance
export const checkGeofenceAttendance = async (userId, location) => {
  try {
    if (typeof location?.lat !== 'number' || typeof location?.lng !== 'number') {
      console.error('Invalid location data:', location);
      return;
    }

    const geozones = await getGeoZones();
    const lastEvent = await getLastAttendanceEvent(userId);
    
    for (const zone of geozones) {
      if (!zone.center || 
          typeof zone.center.latitude !== 'number' || 
          typeof zone.center.longitude !== 'number') {
        console.error('Invalid geozone center:', zone);
        continue;
      }

      const inside = isInsideGeofence(
        location.lat, 
        location.lng, 
        {
          center: new GeoPoint(zone.center.latitude, zone.center.longitude),
          radius: zone.radius
        }
      );
      
      const lastTimestamp = lastEvent?.timestamp?.toDate 
        ? lastEvent.timestamp.toDate() 
        : lastEvent?.timestamp;
      
      const timeDiff = lastTimestamp ? Date.now() - lastTimestamp.getTime() : Infinity;
      const isRecent = timeDiff < 30000; // 30 seconds cooldown
      
      if (inside) {
        if ((!lastEvent || lastEvent.action === 'out') && !isRecent) {
          return logAttendanceEvent(
            userId,
            'in',
            zone.id,
            zone.name,
            'auto',
            { lat: location.lat, lng: location.lng }
          );
        }
      } else {
        if (lastEvent?.action === 'in' && !isRecent) {
          return logAttendanceEvent(
            userId,
            'out',
            null,
            null,
            'auto',
            { lat: location.lat, lng: location.lng }
          );
        }
      }
    }
  } catch (error) {
    console.error('Geofence check failed:', error);
    throw error;
  }
};

// Get last attendance event for a user
const getLastAttendanceEvent = async (userId) => {
  const q = query(
    collection(db, 'attendance'),
    where('userId', '==', userId),
    orderBy('timestamp', 'desc'),
    limit(1)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs[0]?.data() || null;
};

// Manual attendance with validation
export const manualAttendanceOverride = async (userId, action, geozone, location, currentStatus) => {
  if (!geozone) {
    toast.error("No geozone defined.");
    return;
  }

  if (typeof location?.lat !== 'number' || typeof location?.lng !== 'number') {
    toast.error("Invalid current location");
    return;
  }

  if (!geozone.center || 
      typeof geozone.center.latitude !== 'number' || 
      typeof geozone.center.longitude !== 'number') {
    toast.error("Geozone has invalid coordinates");
    return;
  }

  const inside = isInsideGeofence(
    location.lat, 
    location.lng, 
    {
      center: new GeoPoint(geozone.center.latitude, geozone.center.longitude),
      radius: geozone.radius
    }
  );

  if (action === 'in') {
    if (!inside) {
      toast.error("You are not in the company-designated area.");
      return;
    }
  }

  if (action === 'out') {
    if (inside || currentStatus?.status !== 'in') {
      toast.error("You are already out or still inside the zone.");
      return;
    }
  }
  
  return logAttendanceEvent(
    userId,
    action,
    action === 'in' ? geozone.id : null,
    action === 'in' ? geozone.name : null,
    'manual',
    location
  );
};

// Create new geozone
export const createGeoZone = async (name, center, radius, adminId) => {
  try {
    if (typeof center?.lat !== 'number' || typeof center?.lng !== 'number') {
      throw new Error("Invalid center coordinates");
    }
    
    const docRef = await addDoc(collection(db, 'geoZones'), {
      name,
      center: new GeoPoint(center.lat, center.lng),
      radius,
      createdBy: adminId,
      createdAt: new Date(),
      isActive: true
    });
    
    return { 
      id: docRef.id, 
      name, 
      center: { lat: center.lat, lng: center.lng }, 
      radius 
    };
  } catch (error) {
    console.error("Error creating geo zone:", error);
    throw error;
  }
};

// Update geozone
export const updateGeoZone = async (zoneId, updates) => {
  if (updates.center) {
    if (typeof updates.center?.lat !== 'number' || typeof updates.center?.lng !== 'number') {
      throw new Error("Invalid center coordinates");
    }
    updates.center = new GeoPoint(updates.center.lat, updates.center.lng);
  }
  
  await updateDoc(doc(db, 'geoZones', zoneId), updates);
  return { id: zoneId, ...updates };
};

// Delete geozone (soft delete)
export const deleteGeoZone = async (zoneId) => {
  await updateDoc(doc(db, 'geoZones', zoneId), {
    isActive: false,
    deletedAt: new Date()
  });
};

// Get active geozones
export const getGeoZones = async (includeInactive = false) => {
  let q = query(collection(db, 'geoZones'));
  
  if (!includeInactive) {
    q = query(q, where('isActive', '==', true));
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    
    const center = data.center 
      ? { 
          latitude: data.center.latitude, 
          longitude: data.center.longitude 
        }
      : null;
    
    return { 
      id: doc.id, 
      ...data,
      center,
      radius: data.radius || 100
    };
  });
};

// Check if tracking is currently active
export const isTrackingActive = () => {
  return localStorage.getItem('trackingEnabled') === 'true';
};

// Initialize and start tracking
export const initAttendanceTracking = async (userId) => {
  await initTracker();
  setTrackingEnabled(true);
  localStorage.setItem('trackingEnabled', 'true');
  
  return firebaseStartTracking(async (position) => {
    try {
      if (!position?.coords || 
          typeof position.coords.latitude !== 'number' || 
          typeof position.coords.longitude !== 'number') {
        console.warn('Invalid position data:', position);
        return;
      }
      
      await checkGeofenceAttendance(userId, {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      });
    } catch (error) {
      console.error('Auto-attendance error:', error);
    }
  }, 30000);
};

// Custom log attendance event
export const logAttendanceEvent = async (userId, action, geozoneId, geozoneName, method, location) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userName = userDoc.data()?.name || 'Unknown';

    const eventData = {
      userId,
      userName,
      action,
      method,
      timestamp: new Date(),
      status: action === 'in' ? 'in' : 'out',
    };

    if (geozoneId && geozoneName) {
      eventData.geozoneId = geozoneId;
      eventData.geozoneName = geozoneName;
    }

    if (location) {
      eventData.location = new GeoPoint(location.lat, location.lng);
    }

    return await firebaseLogAttendanceEvent(eventData);
  } catch (error) {
    console.error("Error logging attendance:", error);
    throw error;
  }
};

// Wrapper for start/stop tracking
export const startTracking = (userId, geozones) => {
  return initAttendanceTracking(userId, geozones);
};

export const stopTracking = () => {
  firebaseStopTracking();
  localStorage.setItem('trackingEnabled', 'false');
};