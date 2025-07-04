import React from "react";
import * as XLSX from "xlsx";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

const ExportToExcelPage = () => {
  const exportData = async () => {
    const snapshot = await getDocs(collection(db, "attendance"));
    const data = snapshot.docs.map((doc) => doc.data());

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");

    XLSX.writeFile(wb, "attendance_export.xlsx");
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-xl">
      <h2 className="text-xl font-bold text-blue-700 mb-4">📤 Export Attendance to Excel</h2>
      <button
        onClick={exportData}
        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
      >
        Download Excel
      </button>
    </div>
  );
};

export default ExportToExcelPage;
