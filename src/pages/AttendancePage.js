import React from "react";
import AttendanceMarker from "../components/AttendanceMarker";

const AttendancePage = () => {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <AttendanceMarker />
    </div>
  );
};

export default AttendancePage;
