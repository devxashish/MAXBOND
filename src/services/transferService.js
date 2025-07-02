// ✅ Transfer Service for Site-wise Stock Management
import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  setDoc // ✅ ADD THIS LINE
} from "firebase/firestore";

import { db } from "../firebase";

// ✅ Transfer item from one site to another
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

  const fromInventoryRef = doc(db, "sites", fromSiteId, "inventory", itemId);
  const toInventoryRef = doc(db, "sites", toSiteId, "inventory", itemId);

  const fromSnap = await getDoc(fromInventoryRef);
  if (!fromSnap.exists()) throw new Error("Source item not found.");

  const fromData = fromSnap.data();
  if (fromData.quantity < quantity)
    throw new Error("Not enough quantity to transfer.");

  // Update source quantity
  await updateDoc(fromInventoryRef, {
    quantity: fromData.quantity - quantity,
  });

  // Update or create destination quantity
  const toSnap = await getDoc(toInventoryRef);
  if (toSnap.exists()) {
    const toData = toSnap.data();
    await updateDoc(toInventoryRef, {
      quantity: toData.quantity + quantity,
    });
  } else {
    await setDoc(toInventoryRef, {
      itemName: fromData.itemName,
      quantity: quantity,
      unit: fromData.unit || "",
    });
  }

  // Record the transfer
  await addDoc(collection(db, "transfers"), {
    fromSiteId,
    toSiteId,
    itemId,
    itemName: fromData.itemName,
    quantity,
    unit: fromData.unit || "",
    userId,
    timestamp: serverTimestamp(),
  });
};

// ✅ Get all transfers
export const getAllTransfers = async () => {
  const q = query(collection(db, "transfers"), orderBy("timestamp", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// ✅ Get transfers by site
export const getTransfersBySite = async (siteId) => {
  const q = query(
    collection(db, "transfers"),
    where("fromSiteId", "==", siteId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};
