// components/ui/IOSCard.js

import React from "react";
import "../../styles/ios-theme.css";

export default function IOSCard({ children, className = "", ...rest }) {
  return (
    <div className={`ios-card ${className}`} {...rest}>
      {children}
    </div>
  );
}
