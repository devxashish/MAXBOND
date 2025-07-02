import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

const SiteInventory = ({ site }) => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!site) return;

    const q = query(
      collection(db, "inventory"),
      where("siteId", "==", site.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const itemData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setItems(itemData);
    });

    return () => unsubscribe();
  }, [site]);

  if (!site) return <div className="p-4">Select a site to view inventory</div>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-2">
        Inventory for {site.name}
      </h2>
      {items.length === 0 ? (
        <p>No items found for this site.</p>
      ) : (
        <table className="w-full border">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-2 border">Item</th>
              <th className="p-2 border">Quantity</th>
              <th className="p-2 border">Unit</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="text-center">
                <td className="p-2 border">{item.name}</td>
                <td className="p-2 border">{item.quantity}</td>
                <td className="p-2 border">{item.unit || "N/A"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default SiteInventory;
