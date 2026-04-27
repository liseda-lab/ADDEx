/**
 * NodeSelector component
 * 
 * Simple wrapper around Dropdown for selecting nodes.
 * Passes label, value, and options to the Dropdown component.
 * Used for selecting source or target node IDs in the app.
 */


import React from "react";
import { Dropdown } from "./Dropdown";

interface NodeSelectorProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

export default function NodeSelector({ label, value, options, onChange }: NodeSelectorProps) {
  return (
    <Dropdown
      label={label}
      value={value}
      options={options}
      onChange={onChange}
      inline={true}
    />
  );
}
