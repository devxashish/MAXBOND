import { db } from "./firebase"; // use correct firebase path
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  Timestamp
} from "firebase/firestore";

// Get all sites
export const getSites = async () => {
  const snapshot = await getDocs(collection(db, "sites"));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Get inventory for a specific site
export const getSiteInventory = async (siteId) => {
  const snapshot = await getDocs(collection(db, `sites/${siteId}/inventory`));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Transfer item from one site to another
export const transferItem = async (fromSiteId, toSiteId, itemName, quantity) => {
  const fromRef = doc(db, `sites/${fromSiteId}/inventory/${itemName}`);
  const toRef = doc(db, `sites/${toSiteId}/inventory/${itemName}`);

  const fromSnap = await getDoc(fromRef);
  const toSnap = await getDoc(toRef);

  if (!fromSnap.exists() || fromSnap.data().quantity < quantity) {
    throw new Error("Not enough stock in source site.");
  }

  // Decrease from source
  await updateDoc(fromRef, {
    quantity: fromSnap.data().quantity - quantity,
  });

  // Increase to destination
  if (toSnap.exists()) {
    await updateDoc(toRef, {
      quantity: toSnap.data().quantity + quantity,
    });
  } else {
    await setDoc(toRef, {
      name: itemName,
      quantity,
    });
  }

  // Log movement (optional)
  await addDoc(collection(db, "stockMovements"), {
    itemName,
    quantity,
    from: fromSiteId,
    to: toSiteId,
    timestamp: Timestamp.now(),
  });
};
