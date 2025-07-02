import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";

const TransferHistory = () => {
  const [transfers, setTransfers] = useState([]);

  useEffect(() => {
    const q = query(collection(db, "transfers"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const history = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTransfers(history);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-3">Transfer History</h2>
      {transfers.length === 0 ? (
        <p>No transfer records found.</p>
      ) : (
        <table className="w-full border">
          <thead className="bg-gray-200">
            <tr>
              <th className="p-2 border">Date</th>
              <th className="p-2 border">Item</th>
              <th className="p-2 border">Qty</th>
              <th className="p-2 border">From</th>
              <th className="p-2 border">To</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((t) => (
              <tr key={t.id} className="text-center">
                <td className="p-2 border">
                  {new Date(t.timestamp?.toDate?.()).toLocaleString()}
                </td>
                <td className="p-2 border">{t.itemName}</td>
                <td className="p-2 border">
                  {t.quantity} {t.unit || ""}
                </td>
                <td className="p-2 border">{t.sourceSiteName}</td>
                <td className="p-2 border">{t.targetSiteName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default TransferHistory;
