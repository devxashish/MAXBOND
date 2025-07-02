import { db } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from "firebase/firestore";

const SITES_COLLECTION = "sites";

// ➕ Add a new site
export const addSite = async (name) => {
  const docRef = await addDoc(collection(db, SITES_COLLECTION), {
    name,
    createdAt: serverTimestamp()
  });
  return docRef.id;
};

// 📄 Get all sites
export const getAllSites = async () => {
  const snapshot = await getDocs(collection(db, SITES_COLLECTION));
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// ✏️ Update site
export const updateSite = async (siteId, updatedData) => {
  const docRef = doc(db, SITES_COLLECTION, siteId);
  await updateDoc(docRef, updatedData);
};

// ❌ Delete site
export const deleteSite = async (siteId) => {
  const docRef = doc(db, SITES_COLLECTION, siteId);
  await deleteDoc(docRef);
};
