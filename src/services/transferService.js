// src/services/transferService.js
import {
  db, // Import db object
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  deleteDoc, // <--- Add deleteDoc here!
} from "../firebase"; // Import Firestore functions from centralized firebase.js
import { getSiteById } from "./siteService"; // Import to get site names
import { getInventoryItemById } from "./inventoryService"; // Import to get item details

/**
 * Transfers an item from one site's inventory to another.
 * @param {Object} params - The transfer parameters.
 * @param {string} params.fromSiteId - The ID of the source site.
 * @param {string} params.toSiteId - The ID of the target site.
 * @param {string} params.itemId - The ID of the item being transferred.
 * @param {number} params.quantity - The quantity to transfer.
 * @param {string} params.userId - The ID of the user performing the transfer.
 * @returns {Promise<void>}
 */
export const transferItem = async ({
  fromSiteId,
  toSiteId,
  itemId,
  quantity,
  userId,
}) => {
  if (!fromSiteId || !toSiteId || !itemId || !quantity || !userId) {
    throw new Error("Missing required transfer fields.");
  }
  if (fromSiteId === toSiteId) {
    throw new Error("Source and target site must be different.");
  }
  if (quantity <= 0) {
    throw new Error("Quantity must be greater than zero.");
  }

  const fromInventoryRef = doc(db, "inventory", itemId); // Item is in global inventory collection
  const fromSnap = await getDoc(fromInventoryRef);

  if (!fromSnap.exists()) {
    throw new Error("Source item not found in inventory.");
  }

  const fromData = fromSnap.data();

  // Validate that the item truly belongs to the fromSite
  if (fromData.siteId !== fromSiteId) {
    throw new Error("Item does not belong to the selected source site.");
  }

  if (fromData.quantity < quantity) {
    throw new Error("Not enough quantity to transfer at the source site.");
  }

  // Decrease from source site's inventory
  await updateDoc(fromInventoryRef, {
    quantity: fromData.quantity - quantity,
  });

  // Check if the item already exists in the target site's inventory
  const targetItemQuery = query(
    collection(db, "inventory"),
    where("siteId", "==", toSiteId),
    where("itemName", "==", fromData.itemName) // Assuming itemName is unique per site for transfer purposes or you handle duplicates
  );
  const targetSnapshot = await getDocs(targetItemQuery);

  if (!targetSnapshot.empty) {
    // Item exists in target site, update quantity
    const targetDoc = targetSnapshot.docs[0];
    await updateDoc(doc(db, "inventory", targetDoc.id), {
      quantity: targetDoc.data().quantity + quantity,
    });
  } else {
    // Item does not exist in target site, create new entry
    await addDoc(collection(db, "inventory"), {
      siteId: toSiteId,
      itemName: fromData.itemName,
      quantity,
      unit: fromData.unit || "",
      createdAt: serverTimestamp(),
    });
  }

  // Log the transfer
  const fromSite = await getSiteById(fromSiteId);
  const toSite = await getSiteById(toSiteId);

  await addDoc(collection(db, "transfers"), {
    fromSiteId,
    fromSiteName: fromSite ? fromSite.name : "Unknown Site",
    toSiteId,
    toSiteName: toSite ? toSite.name : "Unknown Site",
    itemId: itemId, // Keeping item ID for traceability
    itemName: fromData.itemName,
    quantity,
    unit: fromData.unit || "",
    userId, // Assuming userId is passed, otherwise use a default or actual user context
    timestamp: serverTimestamp(),
  });
};

/**
 * Retrieves all transfer records, ordered by timestamp.
 * @returns {Promise<Array<Object>>} An array of transfer records.
 */
export const getAllTransfers = async () => {
  const q = query(collection(db, "transfers"), orderBy("timestamp", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

/**
 * Updates an existing transfer record.
 * NOTE: This only updates the transfer record itself, NOT the inventory.
 * Modifying inventory based on transfer edits is complex and requires careful
 * consideration of previous and new quantities/sites.
 * @param {string} transferId The ID of the transfer record to update.
 * @param {Object} updatedData The data to update in the transfer record.
 */
export const updateTransferRecord = async (transferId, updatedData) => {
  if (!transferId) {
    throw new Error("Transfer ID is required for update.");
  }
  const docRef = doc(db, "transfers", transferId);
  await updateDoc(docRef, updatedData);
};

/**
 * Deletes a transfer record.
 * NOTE: This only deletes the transfer record itself, NOT the inventory.
 * Deleting a transfer record does not reverse its effect on inventory.
 * @param {string} transferId The ID of the transfer record to delete.
 */
export const deleteTransferRecord = async (transferId) => {
  if (!transferId) {
    throw new Error("Transfer ID is required for deletion.");
  }
  const docRef = doc(db, "transfers", transferId);
  await deleteDoc(docRef);
};
