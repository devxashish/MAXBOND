import React from "react";
import * as XLSX from "xlsx";
import "../../styles/AttendanceTable.css";

const AttendanceTable = ({ data }) => {
  const exportToExcel = () => {
    const sheetData = data.map(row => ({
      Name: row.userName || row.uid,
      Date: row.date,
      Time: row.timeText || "",
      Latitude: row.latitude,
      Longitude: row.longitude,
      Location: row.locationName || "Unknown"
    }));

    const worksheet = XLSX.utils.json_to_sheet(sheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");

    XLSX.writeFile(workbook, "AttendanceReport.xlsx");
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-auto">
      <div className="p-4 flex justify-end">
        <button
          onClick={exportToExcel}
          className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition"
        >
          📥 Export to Excel
        </button>
      </div>
      <table className="min-w-full table-auto text-sm text-left">
        <thead className="bg-gray-200 text-gray-700">
          <tr>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Date</th>
            <th className="px-4 py-2">Time</th>
            <th className="px-4 py-2">Location</th>
          </tr>
        </thead>
        <tbody>
          {data.map((rec, index) => (
            <tr key={index} className="border-b hover:bg-gray-50">
              <td className="px-4 py-2">{rec.userName || rec.uid}</td>
              <td className="px-4 py-2">{rec.date}</td>
              <td className="px-4 py-2">{rec.timeText || "--"}</td>
              <td className="px-4 py-2">{rec.locationName || "Unknown"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AttendanceTable;
