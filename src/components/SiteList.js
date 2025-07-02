import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";

const SiteList = ({ onSelectSite }) => {
  const [sites, setSites] = useState([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "sites"), (snapshot) => {
      const siteData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setSites(siteData);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-2">Sites</h2>
      <ul className="space-y-2">
        {sites.map((site) => (
          <li
            key={site.id}
            className="border p-3 rounded shadow hover:bg-gray-100 cursor-pointer"
            onClick={() => onSelectSite(site)}
          >
            <div className="font-bold">{site.name}</div>
            <div className="text-sm text-gray-600">{site.location}</div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SiteList; // ✅ MUST BE DEFAULT EXPORT
