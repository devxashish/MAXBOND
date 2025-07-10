// src/components/StockSummaryPage.jsx
import React, { useEffect, useState } from "react";
import { getAllInventory, updateInventoryItem, deleteInventoryItem } from "../services/inventoryService";
import { getAllSites } from "../services/siteService";
import { getAllUsages, deleteUsageRecord } from "../services/usageService"; // Import usage service
import { exportToPdf, exportToExcel } from "../utils/exportUtils";
import Modal from "./Modal";
import EditInventoryItemModal from "./EditInventoryItemModal";
import '../styles/StockSummaryPage.css'; // Import the CSS file
import { Timestamp } from "../firebase"; // Import Timestamp for date handling

const StockSummaryPage = () => {
  const [inventory, setInventory] = useState([]);
  const [usages, setUsages] = useState([]); // New state for usages
  const [sites, setSites] = useState({}); // Map siteId to siteName
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [allInventory, allSitesList, allUsages] = await Promise.all([ // Fetch usages too
        getAllInventory(),
        getAllSites(),
        getAllUsages(), // Fetch all usages
      ]);

      const sitesMap = allSitesList.reduce((acc, site) => {
        acc[site.id] = site.name;
        return acc;
      }, {});
      setSites(sitesMap);
      setAllSites(allSitesList);

      setInventory(allInventory);
      setUsages(allUsages); // Set usages state
    } catch (err) {
      console.error("Error fetching stock summary:", err);
      setError("Failed to load stock summary.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredInventory = inventory.filter(item => {
    const itemDate = item.createdAt?.toDate ? new Date(item.createdAt.toDate()) : null;
    if (!itemDate) return false;

    let passesFilter = true;
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0); // Start of the day
      if (itemDate < start) passesFilter = false;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // End of the day
      if (itemDate > end) passesFilter = false;
    }
    return passesFilter;
  });

  const filteredUsages = usages.filter(usage => {
    const usageDate = usage.timestamp?.toDate ? new Date(usage.timestamp.toDate()) : null;
    if (!usageDate) return false;

    let passesFilter = true;
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (usageDate < start) passesFilter = false;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (usageDate > end) passesFilter = false;
    }
    return passesFilter;
  });


  // Group items by itemName for display and calculate total used
  const groupedInventory = filteredInventory.reduce((acc, item) => {
    if (!acc[item.itemName]) {
      acc[item.itemName] = {
        totalQuantity: 0,
        totalUsed: 0, // Initialize total used
        items: [], // Individual inventory entries for this item name
      };
    }
    acc[item.itemName].totalQuantity += item.quantity;
    acc[item.itemName].items.push(item);
    return acc;
  }, {});

  // Populate totalUsed and usageRecords for each grouped item
  Object.keys(groupedInventory).forEach(itemName => {
    const itemUsages = filteredUsages.filter(usage => usage.itemName === itemName);
    const totalUsedForThisItem = itemUsages.reduce((sum, usage) => sum + usage.quantityUsed, 0);
    groupedInventory[itemName].totalUsed = totalUsedForThisItem;
    groupedInventory[itemName].usageRecords = itemUsages.sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds); // Sort usage by date
  });


  const handleExportPdf = () => {
    if (filteredInventory.length === 0 && filteredUsages.length === 0) {
      openModal("No Data", "No stock or usage records to export.");
      return;
    }

    const headers = ["Item Name", "Total Stock", "Total Used", "Site", "Quantity (Site)", "Added Date", "Usage Date", "Used Qty", "Usage Notes"];
    const exportRows = [];

    Object.keys(groupedInventory).forEach(itemName => {
      const group = groupedInventory[itemName];
      // Add a summary row for the item
      exportRows.push({
        "Item Name": itemName,
        "Total Stock": `${group.totalQuantity} ${group.items[0]?.unit || ""}`,
        "Total Used": `${group.totalUsed} ${group.items[0]?.unit || ""}`,
        "Site": "", // Empty for summary row
        "Quantity (Site)": "",
        "Added Date": "",
        "Usage Date": "",
        "Used Qty": "",
        "Usage Notes": ""
      });

      // Add individual inventory items
      group.items.forEach(item => {
        exportRows.push({
          "Item Name": "", // Empty for detail row
          "Total Stock": "",
          "Total Used": "",
          "Site": sites[item.siteId] || "Unknown Site",
          "Quantity (Site)": `${item.quantity} ${item.unit || ""}`,
          "Added Date": item.createdAt?.toDate ? new Date(item.createdAt.toDate()).toLocaleString() : "N/A",
          "Usage Date": "",
          "Used Qty": "",
          "Usage Notes": ""
        });
      });

      // Add individual usage records
      group.usageRecords.forEach(usage => {
        exportRows.push({
          "Item Name": "", // Empty for detail row
          "Total Stock": "",
          "Total Used": "",
          "Site": sites[usage.siteId] || "Unknown Site",
          "Quantity (Site)": "",
          "Added Date": "",
          "Usage Date": usage.timestamp?.toDate ? new Date(usage.timestamp.toDate()).toLocaleString() : "N/A",
          "Used Qty": `${usage.quantityUsed} ${usage.unit || ""}`,
          "Usage Notes": usage.notes || "N/A"
        });
      });
    });

    exportToPdf(exportRows, headers, "stock_summary", "Stock Summary & Usage Report");
    openModal("Export Successful", "Stock summary successfully exported as PDF.");
  };

  const handleExportExcel = () => {
    if (filteredInventory.length === 0 && filteredUsages.length === 0) {
      openModal("No Data", "No stock or usage records to export.");
      return;
    }

    const exportData = [];
    Object.keys(groupedInventory).forEach(itemName => {
      const group = groupedInventory[itemName];
      exportData.push({
        "Item Name": itemName,
        "Total Stock": `${group.totalQuantity} ${group.items[0]?.unit || ""}`,
        "Total Used": `${group.totalUsed} ${group.items[0]?.unit || ""}`,
        "Detail Type": "Summary",
        "Site": "",
        "Quantity/Used Qty": "",
        "Unit": "",
        "Date": "",
        "Notes": ""
      });

      group.items.forEach(item => {
        exportData.push({
          "Item Name": "",
          "Total Stock": "",
          "Total Used": "",
          "Detail Type": "Stock",
          "Site": sites[item.siteId] || "Unknown Site",
          "Quantity/Used Qty": item.quantity,
          "Unit": item.unit || "N/A",
          "Date": item.createdAt?.toDate ? new Date(item.createdAt.toDate()).toLocaleString() : "N/A",
          "Notes": ""
        });
      });

      group.usageRecords.forEach(usage => {
        exportData.push({
          "Item Name": "",
          "Total Stock": "",
          "Total Used": "",
          "Detail Type": "Usage",
          "Site": sites[usage.siteId] || "Unknown Site",
          "Quantity/Used Qty": usage.quantityUsed,
          "Unit": usage.unit || "N/A",
          "Date": usage.timestamp?.toDate ? new Date(usage.timestamp.toDate()).toLocaleString() : "N/A",
          "Notes": usage.notes || "N/A"
        });
      });
    });

    exportToExcel(exportData, "stock_summary");
    openModal("Export Successful", "Stock summary successfully exported as Excel.");
  };


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
        siteId: updatedItem.siteId,
        createdAt: updatedItem.createdAt,
      });
      openModal("Success", "Item updated successfully!");
      fetchData(); // Re-fetch data to reflect changes and re-apply filters
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
          fetchData(); // Re-fetch data to update the list
        } catch (err) {
          console.error("Error deleting item:", err);
          openModal("Error", `Failed to delete item: ${err.message || "Unknown error"}`);
        }
      },
      true // Show cancel button
    );
  };

  const handleDeleteUsageRecord = async (usageId, itemName) => {
    openModal(
      "Confirm Deletion",
      `Are you sure you want to delete the usage record for ${itemName}? This will NOT reverse inventory changes.`,
      async () => {
        try {
          await deleteUsageRecord(usageId);
          openModal("Success", "Usage record deleted successfully!");
          fetchData(); // Re-fetch data to update the list
        } catch (err) {
          console.error("Error deleting usage record:", err);
          openModal("Error", `Failed to delete usage record: ${err.message || "Unknown error"}`);
        }
      },
      true // Show cancel button
    );
  };


  return (
    <div className="stock-summary-container">
      <h2 className="stock-summary-title">📊 Full Stock Summary</h2>

      <div className="filter-export-section">
        <div className="filter-group">
          <label htmlFor="startDate" className="filter-label">Start Date:</label>
          <input
            type="date"
            id="startDate"
            className="form-input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label htmlFor="endDate" className="filter-label">End Date:</label>
          <input
            type="date"
            id="endDate"
            className="form-input"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div className="export-buttons">
          <button
            onClick={handleExportPdf}
            className="export-button pdf"
            disabled={filteredInventory.length === 0 && filteredUsages.length === 0 || loading}
          >
            Export to PDF
          </button>
          <button
            onClick={handleExportExcel}
            className="export-button excel"
            disabled={filteredInventory.length === 0 && filteredUsages.length === 0 || loading}
          >
            Export to Excel
          </button>
        </div>
      </div>

      {loading && <p className="stock-summary-message">Loading stock summary...</p>}
      {error && <p className="stock-summary-message text-red">{error}</p>}

      {!loading && !error && filteredInventory.length === 0 && filteredUsages.length === 0 ? (
        <p className="stock-summary-message">No stock or usage records found for the selected period.</p>
      ) : (
        !loading && (
          <div className="item-groups-container">
            {Object.keys(groupedInventory).map((itemName) => (
              <div key={itemName} className="item-group-card">
                <div className="group-header">
                  <h3 className="group-item-name">{itemName}</h3>
                  <div className="group-total-quantity-wrapper">
                    <span className="group-total-quantity">
                      Total Stock: {groupedInventory[itemName].totalQuantity} {groupedInventory[itemName].items[0]?.unit || ""}
                    </span>
                    <span className="group-total-used">
                      Total Used: {groupedInventory[itemName].totalUsed} {groupedInventory[itemName].items[0]?.unit || ""}
                    </span>
                  </div>
                </div>
                <ul className="group-details-list">
                  {groupedInventory[itemName].items.map((item) => (
                    <li key={item.id} className="group-item-detail">
                      <span className="detail-text">
                        Stock: {item.quantity} {item.unit || ""} @ {sites[item.siteId] || "Unknown Site"} ({item.createdAt?.toDate ? new Date(item.createdAt.toDate()).toLocaleDateString() : "N/A"})
                      </span>
                      <div className="detail-actions">
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
                      </div>
                    </li>
                  ))}
                  {groupedInventory[itemName].usageRecords && groupedInventory[itemName].usageRecords.length > 0 && (
                    <ul className="usage-details-sublist">
                      {groupedInventory[itemName].usageRecords.map(usage => (
                        <li key={usage.id} className="usage-detail-item">
                          <span className="usage-detail-text">
                            Used: {usage.quantityUsed} {usage.unit || ""} @ {sites[usage.siteId] || "Unknown Site"} ({usage.timestamp?.toDate ? new Date(usage.timestamp.toDate()).toLocaleDateString() : "N/A"})
                            {usage.notes && ` - ${usage.notes}`}
                          </span>
                          <div className="usage-detail-actions">
                            {/* No direct edit for usage here to maintain inventory integrity, but delete is allowed */}
                            <button
                              onClick={() => handleDeleteUsageRecord(usage.id, usage.itemName)}
                              className="action-button delete"
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </ul>
              </div>
            ))}
          </div>
        )
      )}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={modalContent.title}
        message={modalContent.message}
        onConfirm={modalContent.onConfirm}
        showCancelButton={modalContent.showCancelButton}
      />
      {selectedItemForEdit && (
        <EditInventoryItemModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          item={selectedItemForEdit}
          onSave={handleSaveEditedItem}
          sites={allSites} // Pass all sites for the dropdown
        />
      )}
    </div>
  );
};

export default StockSummaryPage;
