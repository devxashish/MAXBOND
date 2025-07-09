// src/services/inventoryService.js
import {
  db, // Import db object
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  getDoc,
} from "../firebase"; // Import Firestore functions from centralized firebase.js

const INVENTORY_COLLECTION = "inventory";

/**
 * Adds a new inventory item to a specific site.
 * @param {string} siteId The ID of the site the item belongs to.
 * @param {string} itemName The name of the item.
 * @param {number} quantity The quantity of the item.
 * @param {string} [unit=""] The unit of the item (e.g., "kg", "pcs").
 * @returns {Promise<string>} The ID of the newly added inventory item.
 */
export const addInventoryItem = async (siteId, itemName, quantity, unit = "") => {
  if (!siteId || !itemName || typeof quantity !== "number" || quantity <= 0) {
    throw new Error("Missing or invalid inventory item fields.");
  }
  const docRef = await addDoc(collection(db, INVENTORY_COLLECTION), {
    siteId,
    itemName,
    quantity,
    unit,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

/**
 * Retrieves inventory items for a specific site.
 * @param {string} siteId The ID of the site.
 * @returns {Promise<Array<Object>>} An array of inventory item objects.
 */
export const getInventoryBySite = async (siteId) => {
  if (!siteId) {
    return [];
  }
  const q = query(
    collection(db, INVENTORY_COLLECTION),
    where("siteId", "==", siteId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

/**
 * Retrieves a single inventory item by its ID.
 * @param {string} itemId The ID of the inventory item.
 * @returns {Promise<Object|null>} The inventory item object or null if not found.
 */
export const getInventoryItemById = async (itemId) => {
  if (!itemId) {
    return null;
  }
  const itemRef = doc(db, INVENTORY_COLLECTION, itemId);
  const itemSnap = await getDoc(itemRef);
  return itemSnap.exists() ? { id: itemSnap.id, ...itemSnap.data() } : null;
};

/**
 * Updates an existing inventory item.
 * @param {string} itemId The ID of the inventory item to update.
 * @param {Object} updatedData The data to update.
 */
export const updateInventoryItem = async (itemId, updatedData) => {
  if (!itemId) {
    throw new Error("Inventory item ID is required for update.");
  }
  const docRef = doc(db, INVENTORY_COLLECTION, itemId);
  await updateDoc(docRef, updatedData);
};

/**
 * Deletes an inventory item.
 * @param {string} itemId The ID of the inventory item to delete.
 */
export const deleteInventoryItem = async (itemId) => {
  if (!itemId) {
    throw new Error("Inventory item ID is required for deletion.");
  }
  const docRef = doc(db, INVENTORY_COLLECTION, itemId);
  await deleteDoc(docRef);
};

/**
 * Retrieves all inventory items across all sites.
 * @returns {Promise<Array<Object>>} An array of all inventory item objects.
 */
export const getAllInventory = async () => {
  const snapshot = await getDocs(collection(db, INVENTORY_COLLECTION));
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};
