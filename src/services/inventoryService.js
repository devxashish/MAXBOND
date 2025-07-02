import { db } from "../firebase";
import {
collection,
addDoc,
getDocs,
doc,
updateDoc,
deleteDoc,
query,
where,
serverTimestamp
} from "firebase/firestore";

const INVENTORY_COLLECTION = "inventory";

// ➕ Add inventory to a site
export const addInventoryItem = async (siteId, itemName, quantity) => {
const docRef = await addDoc(collection(db, INVENTORY_COLLECTION), {
siteId,
itemName,
quantity,
createdAt: serverTimestamp()
});
return docRef.id;
};

// 📄 Get inventory for a specific site
export const getInventoryBySite = async (siteId) => {
const q = query(collection(db, INVENTORY_COLLECTION), where("siteId", "==", siteId));
const snapshot = await getDocs(q);
return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// ✏️ Update inventory item
export const updateInventoryItem = async (itemId, updatedData) => {
const docRef = doc(db, INVENTORY_COLLECTION, itemId);
await updateDoc(docRef, updatedData);
};

// ❌ Delete inventory item
export const deleteInventoryItem = async (itemId) => {
const docRef = doc(db, INVENTORY_COLLECTION, itemId);
await deleteDoc(docRef);
};

// 📄 Get all inventory (admin view)
export const getAllInventory = async () => {
const snapshot = await getDocs(collection(db, INVENTORY_COLLECTION));
return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};