// src/components/TransferForm.jsx
import React, { useState, useEffect } from "react";
import { getAllSites } from "../services/siteService";
import { getInventoryBySite } from "../services/inventoryService";
import { transferItem } from "../services/transferService";
import Modal from "./Modal"; // Import the new Modal component
import '../styles/TransferForm.css'; // Import the new CSS file

const TransferForm = () => {
  const [sites, setSites] = useState([]);
  const [sourceSiteId, setSourceSiteId] = useState("");
  const [targetSiteId, setTargetSiteId] = useState("");
  const [sourceSiteItems, setSourceSiteItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [quantity, setQuantity] = useState("");
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

  useEffect(() => {
    const fetchSites = async () => {
      try {
        const siteList = await getAllSites();
        setSites(siteList);
      } catch (err) {
        console.error("Error fetching sites:", err);
        setError("Failed to load sites.");
      }
    };
    fetchSites();
  }, []);

  useEffect(() => {
    const fetchItems = async () => {
      if (!sourceSiteId) {
        setSourceSiteItems([]);
        setSelectedItemId(""); // Clear selected item if source site changes
        return;
      }
      try {
        const itemList = await getInventoryBySite(sourceSiteId);
        setSourceSiteItems(itemList);
      } catch (err) {
        console.error("Error fetching inventory items:", err);
        setError("Failed to load items for source site.");
      }
    };
    fetchItems();
  }, [sourceSiteId]);

  const handleTransfer = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    if (!sourceSiteId || !targetSiteId || !selectedItemId || !quantity) {
      openModal("Required Fields", "Please fill in all fields.");
      setLoading(false);
      return;
    }

    // You might want to get the actual userId from your authentication context
    const currentUserId = "adminUser123"; // Placeholder User ID

    try {
      await transferItem({
        fromSiteId: sourceSiteId,
        toSiteId: targetSiteId,
        itemId: selectedItemId,
        quantity: Number(quantity),
        userId: currentUserId,
      });
      setSuccess(true);
      setQuantity("");
      setSelectedItemId(""); // Clear selected item after successful transfer
      // Optionally re-fetch items for the source site to update available quantity
      const updatedItemList = await getInventoryBySite(sourceSiteId);
      setSourceSiteItems(updatedItemList);
      openModal("Success", "Transfer successful!");
    } catch (err) {
      console.error("Transfer failed:", err);
      setError(err.message);
      openModal("Error", `Transfer failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="transfer-form-container">
      <h2 className="transfer-form-title">Transfer Item Between Sites</h2>
      <form onSubmit={handleTransfer} className="transfer-form-layout">
        {error && <p className="error-message">{error}</p>}
        {success && <p className="success-message">Transfer successful!</p>}

        <div className="transfer-form-group">
          <label htmlFor="sourceSite" className="transfer-form-label">
            Source Site
          </label>
          <select
            id="sourceSite"
            className="form-select"
            value={sourceSiteId}
            onChange={(e) => setSourceSiteId(e.target.value)}
            disabled={loading}
            required
          >
            <option value="">Select Source Site</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </div>

        <div className="transfer-form-group">
          <label htmlFor="targetSite" className="transfer-form-label">
            Target Site
          </label>
          <select
            id="targetSite"
            className="form-select"
            value={targetSiteId}
            onChange={(e) => setTargetSiteId(e.target.value)}
            disabled={loading}
            required
          >
            <option value="">Select Target Site</option>
            {sites
              .filter((site) => site.id !== sourceSiteId) // Prevent selecting same site
              .map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
          </select>
        </div>

        <div className="transfer-form-group">
          <label htmlFor="selectedItem" className="transfer-form-label">
            Item to Transfer
          </label>
          <select
            id="selectedItem"
            className="form-select"
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            disabled={!sourceSiteId || loading}
            required
          >
            <option value="">Select Item</option>
            {sourceSiteItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.itemName} (Available: {item.quantity} {item.unit || ""})
              </option>
            ))}
          </select>
        </div>

        <div className="transfer-form-group">
          <label htmlFor="quantity" className="transfer-form-label">
            Quantity
          </label>
          <input
            type="number"
            id="quantity"
            className="form-input"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            min="1"
            disabled={!selectedItemId || loading}
            required
          />
        </div>

        <button
          type="submit"
          className="transfer-submit-button"
          disabled={loading}
        >
          {loading ? "Transferring..." : "Transfer Stock"}
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

export default TransferForm;
