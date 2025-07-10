// src/services/usageService.js
import {
  db,
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc, // <--- Add updateDoc here!
  serverTimestamp,
  query,
  orderBy,
  getDocs,
  deleteDoc // <--- Add deleteDoc here!
} from "../firebase";
import { getInventoryItemById, updateInventoryItem } from "./inventoryService"; // Import inventory services

const USAGES_COLLECTION = "usages";

/**
 * Records the usage of an inventory item and updates its quantity.
 * @param {Object} params - The usage parameters.
 * @param {string} params.siteId - The ID of the site where the item was used.
 * @param {string} params.itemId - The ID of the item used.
 * @param {number} params.quantityUsed - The quantity of the item used.
 * @param {string} [params.userId=""] - The ID of the user who recorded the usage (optional).
 * @param {string} [params.notes=""] - Any additional notes about the usage (optional).
 * @returns {Promise<void>}
 */
export const recordItemUsage = async ({ siteId, itemId, quantityUsed, userId = "", notes = "" }) => {
  if (!siteId || !itemId || !quantityUsed || quantityUsed <= 0) {
    throw new Error("Missing or invalid usage fields (siteId, itemId, quantityUsed).");
  }

  const item = await getInventoryItemById(itemId);
  if (!item) {
    throw new Error("Item not found in inventory.");
  }
  if (item.siteId !== siteId) {
    throw new Error("Item does not belong to the selected site.");
  }
  if (item.quantity < quantityUsed) {
    throw new Error("Not enough quantity in stock to record usage.");
  }

  // Update the inventory item quantity
  await updateInventoryItem(itemId, {
    quantity: item.quantity - quantityUsed,
  });

  // Record the usage in a separate collection
  await addDoc(collection(db, USAGES_COLLECTION), {
    siteId,
    siteName: item.siteName || "Unknown Site", // Assuming siteName can be passed or looked up
    itemId,
    itemName: item.itemName,
    quantityUsed,
    unit: item.unit || "",
    userId,
    notes,
    timestamp: serverTimestamp(),
  });
};

/**
 * Retrieves all usage records, ordered by timestamp.
 * @returns {Promise<Array<Object>>} An array of usage records.
 */
export const getAllUsages = async () => {
  const q = query(collection(db, USAGES_COLLECTION), orderBy("timestamp", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

/**
 * Deletes a usage record.
 * NOTE: This only deletes the usage record itself, NOT the inventory.
 * Reversing inventory changes based on deleted usage is complex and requires careful logic.
 * @param {string} usageId The ID of the usage record to delete.
 */
export const deleteUsageRecord = async (usageId) => {
  if (!usageId) {
    throw new Error("Usage ID is required for deletion.");
  }
  const docRef = doc(db, USAGES_COLLECTION, usageId);
  await deleteDoc(docRef); // deleteDoc is used here
};

/**
 * Updates an existing usage record.
 * NOTE: This only updates the usage record itself, NOT the inventory.
 * Modifying inventory based on usage edits is complex and requires careful logic.
 * @param {string} usageId The ID of the usage record to update.
 * @param {Object} updatedData The data to update in the usage record.
 */
export const updateUsageRecord = async (usageId, updatedData) => {
  if (!usageId) {
    throw new Error("Usage ID is required for update.");
  }
  const docRef = doc(db, USAGES_COLLECTION, usageId);
  await updateDoc(docRef, updatedData); // updateDoc is used here
};
