import React from "react";
import jsPDF from "jspdf";
import "jspdf-autotable";

const ExportAttendancePDF = ({ data }) => {
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text("Attendance Records", 14, 15);
    const rows = data.map((item) => [
      item.date,
      item.timeText,
      item.type.toUpperCase(),
      item.locationName || "N/A",
    ]);

    doc.autoTable({
      startY: 20,
      head: [["Date", "Time", "Type", "Location"]],
      body: rows,
    });

    doc.save("attendance.pdf");
  };

  return (
    <button
      onClick={exportPDF}
      className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 mt-4 rounded-lg transition"
    >
      📤 Export Attendance to PDF
    </button>
  );
};

export default ExportAttendancePDF;
