// components/ui/IOSButton.js

import React from "react";
import "../../styles/ios-theme.css";

export default function IOSButton({
  children,
  onClick,
  className = "",
  type = "button",
  disabled = false
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`ios-button ${disabled ? "ios-button-disabled" : ""} ${className}`}
    >
      {children}
    </button>
  );
}
