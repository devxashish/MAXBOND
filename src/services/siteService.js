// src/services/siteService.js
import {
  db, // Import db object
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "../firebase"; // Import Firestore functions from centralized firebase.js

const SITES_COLLECTION = "sites";

/**
 * Adds a new site to the database.
 * @param {string} name The name of the site.
 * @param {string} [location=""] The location of the site (optional).
 * @returns {Promise<string>} The ID of the newly added site.
 */
export const addSite = async (name, location = "") => {
  if (!name) {
    throw new Error("Site name cannot be empty.");
  }
  const docRef = await addDoc(collection(db, SITES_COLLECTION), {
    name,
    location, // Include location when adding a site
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

/**
 * Retrieves all sites from the database.
 * @returns {Promise<Array<Object>>} An array of site objects.
 */
export const getAllSites = async () => {
  const snapshot = await getDocs(collection(db, SITES_COLLECTION));
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

/**
 * Retrieves a single site by its ID.
 * @param {string} siteId The ID of the site.
 * @returns {Promise<Object|null>} The site object or null if not found.
 */
export const getSiteById = async (siteId) => {
  if (!siteId) {
    return null;
  }
  const siteRef = doc(db, SITES_COLLECTION, siteId);
  const siteSnap = await getDoc(siteRef);
  return siteSnap.exists() ? { id: siteSnap.id, ...siteSnap.data() } : null;
};

/**
 * Updates an existing site.
 * @param {string} siteId The ID of the site to update.
 * @param {Object} updatedData The data to update.
 */
export const updateSite = async (siteId, updatedData) => {
  if (!siteId) {
    throw new Error("Site ID is required for update.");
  }
  const docRef = doc(db, SITES_COLLECTION, siteId);
  await updateDoc(docRef, updatedData);
};

/**
 * Deletes a site from the database.
 * @param {string} siteId The ID of the site to delete.
 */
export const deleteSite = async (siteId) => {
  if (!siteId) {
    throw new Error("Site ID is required for deletion.");
  }
  const docRef = doc(db, SITES_COLLECTION, siteId);
  await deleteDoc(docRef);
};
