import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, addDoc, getDocs } from "firebase/firestore";

const AddItemForm = () => {
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState("");
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");

  // Load list of available sites
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedSite || !itemName || !quantity) {
      alert("Please fill in all required fields.");
      return;
    }

    try {
      await addDoc(collection(db, "inventory"), {
        siteId: selectedSite,
        name: itemName,
        quantity: Number(quantity),
        unit: unit || "",
      });
      alert("Item added successfully!");
      setItemName("");
      setQuantity("");
      setUnit("");
    } catch (err) {
      console.error(err);
      alert("Failed to add item.");
    }
  };

  return (
    <div className="p-4 border rounded shadow mt-4">
      <h2 className="text-xl font-bold mb-3">Add New Item to Site</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Select Site */}
        <div>
          <label className="block font-medium">Select Site</label>
          <select
            className="w-full border p-2"
            value={selectedSite}
            onChange={(e) => setSelectedSite(e.target.value)}
          >
            <option value="">Choose Site</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </div>

        {/* Item Name */}
        <div>
          <label className="block font-medium">Item Name</label>
          <input
            type="text"
            className="w-full border p-2"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            required
          />
        </div>

        {/* Quantity */}
        <div>
          <label className="block font-medium">Quantity</label>
          <input
            type="number"
            className="w-full border p-2"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            min="1"
          />
        </div>

        {/* Unit */}
        <div>
          <label className="block font-medium">Unit (optional)</label>
          <input
            type="text"
            className="w-full border p-2"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="e.g. kg, liter, pcs"
          />
        </div>

        <button
          type="submit"
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Add Item
        </button>
      </form>
    </div>
  );
};

export default AddItemForm;
