import React, { useEffect, useState } from "react";
import { getSiteInventory } from "./StockService";

const InventoryList = ({ siteId }) => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const fetchInventory = async () => {
      if (!siteId) return;
      const data = await getSiteInventory(siteId);
      setItems(data);
    };
    fetchInventory();
  }, [siteId]);

  return (
    <div className="inventory-list">
      <h3>Inventory for Site: {siteId}</h3>
      <ul>
        {items.map(item => (
          <li key={item.id}>
            {item.name} — {item.quantity}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default InventoryList;
