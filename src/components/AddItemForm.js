// src/components/AddItemForm.jsx
import React, { useEffect, useState } from "react";
import { getAllSites } from "../services/siteService";
import { addInventoryItem } from "../services/inventoryService";
import Modal from "./Modal"; // Import the new Modal component
import './AddItemForm.css'; // Import the new CSS file

const AddItemForm = () => {
  const [sites, setSites] = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
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

  // Load list of available sites
  useEffect(() => {
    const fetchSites = async () => {
      try {
        const siteList = await getAllSites();
        setSites(siteList);
      } catch (err) {
        console.error("Error fetching sites:", err);
        setError("Failed to load sites for item assignment.");
      }
    };
    fetchSites();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    if (!selectedSiteId || !itemName || !quantity) {
      openModal("Required Fields", "Please fill in all required fields.");
      setLoading(false);
      return;
    }

    if (Number(quantity) <= 0) {
      openModal("Invalid Quantity", "Quantity must be a positive number.");
      setLoading(false);
      return;
    }

    try {
      await addInventoryItem(selectedSiteId, itemName, Number(quantity), unit);
      setSuccess(true);
      setItemName("");
      setQuantity("");
      setUnit("");
      openModal("Success", "Item added successfully!");
    } catch (err) {
      console.error("Error adding item:", err);
      setError(err.message || "Failed to add item.");
      openModal("Error", `Failed to add item: ${err.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-item-form-container">
      <h2 className="add-item-form-title">➕ Add New Item to Site Inventory</h2>
      <form onSubmit={handleSubmit} className="add-item-form-layout"> {/* Updated class name */}
        {error && <p className="error-message">{error}</p>}
        {success && <p className="success-message">{success}</p>} {/* Display success message */}

        {/* Select Site */}
        <div className="add-item-form-group">
          <label htmlFor="selectSite" className="add-item-form-label">
            Select Site
          </label>
          <select
            id="selectSite"
            className="form-select"
            value={selectedSiteId}
            onChange={(e) => setSelectedSiteId(e.target.value)}
            disabled={loading}
            required
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
        <div className="add-item-form-group">
          <label htmlFor="itemName" className="add-item-form-label">
            Item Name
          </label>
          <input
            type="text"
            id="itemName"
            className="form-input"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="e.g. Cement, Bricks, Steel Rods"
            disabled={loading}
            required
          />
        </div>

        {/* Quantity */}
        <div className="add-item-form-group">
          <label htmlFor="quantity" className="add-item-form-label">
            Quantity
          </label>
          <input
            type="number"
            id="quantity"
            className="form-input"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            min="1"
            disabled={loading}
          />
        </div>

        {/* Unit */}
        <div className="add-item-form-group">
          <label htmlFor="unit" className="add-item-form-label">
            Unit (optional)
          </label>
          <input
            type="text"
            id="unit"
            className="form-input"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="e.g. kg, liter, pcs"
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          className="add-item-submit-button" 
          disabled={loading}
        >
          {loading ? "Adding Item..." : "Add Item"}
        </button>
      </form>
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

export default AddItemForm;
