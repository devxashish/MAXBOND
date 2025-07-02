// src/pages/SiteStockPage.js
import React, { useState } from 'react';
import SiteList from '../components/SiteList';
import InventoryList from '../components/InventoryList';
import TransferForm from '../components/TransferForm';

export default function SiteStockPage() {
  const [selectedSite, setSelectedSite] = useState(null);

  return (
    <div className="container py-4">
      <h2 className="mb-4">🏗️ Site Inventory Manager</h2>
      <div className="row">
        <div className="col-md-4">
          <SiteList onSiteSelect={setSelectedSite} />
          <TransferForm />
        </div>
        <div className="col-md-8">
          {selectedSite ? (
            <InventoryList siteId={selectedSite} />
          ) : (
            <div className="alert alert-info">Select a site to view inventory.</div>
          )}
        </div>
      </div>
    </div>
  );
}
