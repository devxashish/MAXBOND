// components/ui/IOSSwitch.js

import React from "react";
import "../../styles/ios-theme.css";

export default function IOSSwitch({ checked, onChange }) {
  return (
    <label className="ios-switch">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="slider" />
    </label>
  );
}
