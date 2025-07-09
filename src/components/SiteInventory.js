// src/components/SiteInventory.jsx
import React, { useEffect, useState } from "react";
import { getInventoryBySite, updateInventoryItem, deleteInventoryItem } from "../services/inventoryService";
import { getAllSites } from "../services/siteService"; // To pass site list to edit modal
import { db, collection, query, where, onSnapshot } from "../firebase"; // Import from centralized firebase.js
import EditInventoryItemModal from "./EditInventoryItemModal"; // Import the new modal
import Modal from "./Modal"; // Import the custom Modal component
import '../styles/SiteInventory.css'; // Import the new CSS file

const SiteInventory = ({ site }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedItemForEdit, setSelectedItemForEdit] = useState(null);
  const [allSites, setAllSites] = useState([]); // To pass to the edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({ title: "", message: "", onConfirm: null, showCancelButton: false });

  const openModal = (title, message, onConfirm = null, showCancelButton = false) => {
    setModalContent({ title, message, onConfirm, showCancelButton });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalContent({ title: "", message: "", onConfirm: null, showCancelButton: false });
  };

  useEffect(() => {
    const fetchSites = async () => {
      try {
        const sitesList = await getAllSites();
        setAllSites(sitesList);
      } catch (err) {
        console.error("Error fetching all sites:", err);
      }
    };
    fetchSites();
  }, []);


  useEffect(() => {
    if (!site) {
      setItems([]);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, "inventory"), // Querying the global inventory collection
      where("siteId", "==", site.id)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const itemData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setItems(itemData);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching inventory:", err);
        setError("Failed to load inventory for this site.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [site]);

  const handleEditClick = (item) => {
    setSelectedItemForEdit(item);
    setIsEditModalOpen(true);
  };

  const handleSaveEditedItem = async (updatedItem) => {
    try {
      await updateInventoryItem(updatedItem.id, {
        itemName: updatedItem.itemName,
        quantity: updatedItem.quantity,
        unit: updatedItem.unit,
        siteId: updatedItem.siteId, // Allow changing site of the item
      });
      openModal("Success", "Item updated successfully!");
    } catch (err) {
      console.error("Error updating item:", err);
      openModal("Error", `Failed to update item: ${err.message || "Unknown error"}`);
    } finally {
      setIsEditModalOpen(false);
      setSelectedItemForEdit(null);
    }
  };

  const handleDeleteItem = async (itemId, itemName) => {
    openModal(
      "Confirm Deletion",
      `Are you sure you want to delete ${itemName}? This action cannot be undone.`,
      async () => {
        try {
          await deleteInventoryItem(itemId);
          openModal("Success", "Item deleted successfully!");
        } catch (err) {
          console.error("Error deleting item:", err);
          openModal("Error", `Failed to delete item: ${err.message || "Unknown error"}`);
        }
      },
      true // Show cancel button
    );
  };

  if (!site) {
    return (
      <div className="site-inventory-message">
        <p>⬅️ Select a site from the left to view its inventory.</p>
      </div>
    );
  }

  return (
    <div className="site-inventory-container">
      <h2 className="site-inventory-title">📦 Inventory for {site.name}</h2>

      {loading && <p className="loading-message">Loading inventory...</p>}
      {error && <p className="error-message">{error}</p>}

      {!loading && !error && items.length === 0 ? (
        <p className="no-items-message">No items found for this site.</p>
      ) : (
        !loading && (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Quantity</th>
                  <th>Unit</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.itemName}</td>
                    <td>{item.quantity}</td>
                    <td>{item.unit || "N/A"}</td>
                    <td className="inventory-actions-cell">
                      <button
                        onClick={() => handleEditClick(item)}
                        className="action-button edit"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id, item.itemName)}
                        className="action-button delete"
                      >
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {selectedItemForEdit && (
        <EditInventoryItemModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          item={selectedItemForEdit}
          onSave={handleSaveEditedItem}
          sites={allSites} // Pass all sites for the dropdown
        />
      )}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={modalContent.title}
        message={modalContent.message}
        onConfirm={modalContent.onConfirm}
        showCancelButton={modalContent.showCancelButton}
      />
    </div>
  );
};

export default SiteInventory;
