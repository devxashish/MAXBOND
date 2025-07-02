import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { transferItem } from "../services/transferService";

const TransferForm = () => {
  const [sites, setSites] = useState([]);
  const [sourceSite, setSourceSite] = useState(null);
  const [targetSite, setTargetSite] = useState(null);
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState("");
  const [quantity, setQuantity] = useState("");

  useEffect(() => {
    const fetchSites = async () => {
      const snapshot = await getDocs(collection(db, "sites"));
      const siteList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setSites(siteList);
    };

    fetchSites();
  }, []);

  useEffect(() => {
    const fetchItems = async () => {
      if (!sourceSite) return;
      const q = query(
        collection(db, "inventory"),
        where("siteId", "==", sourceSite)
      );
      const snapshot = await getDocs(q);
      const itemList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setItems(itemList);
    };

    fetchItems();
  }, [sourceSite]);

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!sourceSite || !targetSite || !selectedItem || !quantity) {
      alert("Please fill in all fields.");
      return;
    }

    if (sourceSite === targetSite) {
      alert("Source and target site must be different.");
      return;
    }

    // ✅ Using doc and getDoc here to fetch the selected item directly
    const itemRef = doc(db, "inventory", selectedItem);
    const itemSnap = await getDoc(itemRef);

    if (!itemSnap.exists()) {
      return alert("Selected item not found in database.");
    }

    const itemData = itemSnap.data();

    if (itemData.quantity < Number(quantity)) {
      return alert("Insufficient stock.");
    }

    await transferItem({
      sourceSiteId: sourceSite,
      targetSiteId: targetSite,
      itemId: selectedItem,
      itemName: itemData.name,
      quantity: Number(quantity),
      unit: itemData.unit || "",
    });

    alert("Transfer successful!");
    setQuantity("");
    setSelectedItem("");
  };

  return (
    <div className="p-4 border rounded shadow mt-4">
      <h2 className="text-xl font-bold mb-3">Transfer Item Between Sites</h2>
      <form onSubmit={handleTransfer} className="space-y-4">
        <div>
          <label className="block font-medium">Source Site</label>
          <select
            className="w-full border p-2"
            value={sourceSite || ""}
            onChange={(e) => setSourceSite(e.target.value)}
          >
            <option value="">Select Source Site</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-medium">Target Site</label>
          <select
            className="w-full border p-2"
            value={targetSite || ""}
            onChange={(e) => setTargetSite(e.target.value)}
          >
            <option value="">Select Target Site</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-medium">Item</label>
          <select
            className="w-full border p-2"
            value={selectedItem}
            onChange={(e) => setSelectedItem(e.target.value)}
            disabled={!sourceSite}
          >
            <option value="">Select Item</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} (Available: {item.quantity})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-medium">Quantity</label>
          <input
            type="number"
            className="w-full border p-2"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            min="1"
          />
        </div>

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Transfer
        </button>
      </form>
    </div>
  );
};

export default TransferForm;
