/**
 * FileSelector component
 * 
 * Reusable dropdown for selecting JSON files.
 * Can fetch file list from an API or use a preloaded array.
 * Calls `onSelect` when a file is chosen.
 */

"use client";
import React, { useState, useEffect } from "react";
import { Dropdown } from "./Dropdown";

interface FileSelectorProps {
  onSelect: (filename: string) => void;
  files?: string[]; // Optional: pass preloaded list
  apiEndpoint?: string; // Fallback if files not provided
}

export default function FileSelector({ onSelect, files: preloadedFiles, apiEndpoint = "/api/list-files" }: FileSelectorProps) {
  const [files, setFiles] = useState<string[]>(preloadedFiles || []);
  const [selectedFile, setSelectedFile] = useState("");

  // Fetch files only if not provided via props
  useEffect(() => {
    if (preloadedFiles) return;

    const fetchFiles = async () => {
      try {
        const res = await fetch(apiEndpoint);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: string[] = await res.json();
        setFiles(json);
      } catch (err) {
        console.error("Failed to fetch files:", err);
      }
    };

    fetchFiles();
  }, [apiEndpoint, preloadedFiles]);

  return (
    <Dropdown
      label="File"
      value={selectedFile}
      options={files}
      onChange={(file) => {
        setSelectedFile(file);
        onSelect(file);
      }}
      inline
    />
  );
}
