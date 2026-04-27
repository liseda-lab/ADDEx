"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "../../../../styles/ThemeContext";

interface DropdownProps {
  label?: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  inline?: boolean;
  allowDeselect?: boolean;
  resetKey?: number;
  searchable?: boolean;
  // Optional display mapping: when given, options are shown with
  // `displayFor(option)` but the underlying value passed to onChange / stored
  // in state stays the raw option. Used e.g. to show OREGANO "Protein" as
  // "Target" without changing the lookup logic.
  displayFor?: (value: string) => string;
}

export function Dropdown({
  label,
  value,
  options,
  onChange,
  inline,
  allowDeselect = true,
  resetKey,
  searchable = false,
  displayFor,
}: DropdownProps) {
  const colors = useTheme();
  const OPTION_ROW_HEIGHT = 34;
  const OVERSCAN_ROWS = 6;
  const [userDeselected, setUserDeselected] = useState(false);
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
    minWidth: number;
    maxWidth: number;
    maxHeight: number;
  } | null>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputWrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  // Set true right before blurring after a commit, so handleSearchBlur knows
  // the value is already correct and skips its stale-closure reset logic.
  const justCommittedRef = useRef(false);
  const prevOptionsRef = useRef<string[]>([]);
  const prevValueRef = useRef(value);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    setScrollTop(0);
    setHighlightedIndex(0);
  }, [query, isOpen]);

  useEffect(() => {
    setUserDeselected(false);
  }, [resetKey]);

  useEffect(() => {
    const prevOptions = prevOptionsRef.current;
    const optionsChanged =
      prevOptions.length !== options.length ||
      prevOptions.some((opt, i) => opt !== options[i]);

    const wasExternalDeselect =
      prevValueRef.current !== "" && value === "" && !optionsChanged;

    let isDeselected = userDeselected;

    if (optionsChanged) {
      setUserDeselected(false);
      isDeselected = false;
    }

    if (wasExternalDeselect) {
      setUserDeselected(true);
      isDeselected = true;
    }

    if (options.length === 1 && value === "" && !isDeselected) {
      onChange(options[0]);
    }

    prevOptionsRef.current = options;
    prevValueRef.current = value;
  }, [options, value, onChange, userDeselected]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) return options;

    return options.filter((option) =>
      option.toLowerCase().startsWith(normalizedQuery)
    );
  }, [options, query]);

  const visibleWindow = useMemo(() => {
    if (!menuPosition) {
      return {
        startIndex: 0,
        visibleOptions: filteredOptions,
      };
    }

    const visibleCount =
      Math.ceil(menuPosition.maxHeight / OPTION_ROW_HEIGHT) + OVERSCAN_ROWS;
    const startIndex = Math.max(
      0,
      Math.floor(scrollTop / OPTION_ROW_HEIGHT) - Math.floor(OVERSCAN_ROWS / 2)
    );
    const endIndex = Math.min(
      filteredOptions.length,
      startIndex + visibleCount
    );

    return {
      startIndex,
      visibleOptions: filteredOptions.slice(startIndex, endIndex),
    };
  }, [filteredOptions, menuPosition, scrollTop]);

  const menuWidth = menuPosition?.minWidth ?? 0;

  useEffect(() => {
    if (!isOpen || !inputWrapperRef.current) return;

    const updateMenuPosition = () => {
      if (!inputWrapperRef.current) return;

      const rect = inputWrapperRef.current.getBoundingClientRect();
      const viewportPadding = 8;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const preferredTop = rect.bottom + 4;
      const spaceBelow = viewportHeight - preferredTop - viewportPadding;
      const spaceAbove = rect.top - viewportPadding - 4;
      const maxHeight = Math.max(
        120,
        Math.min(220, spaceBelow >= 120 ? spaceBelow : spaceAbove)
      );
      const showAbove = spaceBelow < 120 && spaceAbove > spaceBelow;
      const naturalMenuHeight = Math.max(
        OPTION_ROW_HEIGHT,
        filteredOptions.length * OPTION_ROW_HEIGHT
      );
      const menuHeight = Math.min(maxHeight, naturalMenuHeight);

      setMenuPosition({
        top: showAbove
          ? Math.max(viewportPadding, rect.top - menuHeight - 4)
          : preferredTop,
        left: Math.min(
          rect.left,
          Math.max(viewportPadding, viewportWidth - rect.width - viewportPadding)
        ),
        minWidth: rect.width,
        maxWidth: Math.max(160, viewportWidth - rect.left - viewportPadding),
        maxHeight: menuHeight,
      });
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen, filteredOptions.length]);

  const baseFieldStyles = {
    width: "100%",
    paddingTop: 5,
    paddingRight: 22,
    paddingBottom: 5,
    paddingLeft: 8,
    borderRadius: 8,
    border: `1px solid ${colors.white}25`,
    backgroundColor: colors.darkblue,
    color: colors.white,
    fontWeight: 500,
    fontSize: "0.8rem",
    outline: "none",
  };

  const commitOption = (opt: string) => {
    setQuery(opt);
    onChange(opt);
    setIsOpen(false);
    setUserDeselected(false);
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    // Release focus so the typing caret goes away and page-level Enter
    // shortcuts can fire. Flag guards the blur handler from wiping the
    // value on its stale-closure reset path.
    justCommittedRef.current = true;
    inputRef.current?.blur();
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      if (filteredOptions.length === 0) return;
      event.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, filteredOptions.length - 1));
    } else if (event.key === "ArrowUp") {
      if (filteredOptions.length === 0) return;
      event.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (event.key === "Enter") {
      if (!isOpen || filteredOptions.length === 0) return;
      event.preventDefault();
      // Stop the native event so the same Enter doesn't also bubble to the
      // window-level shortcut that runs the search. User has to press Enter
      // a second time to submit.
      event.nativeEvent.stopImmediatePropagation();
      const target = filteredOptions[Math.min(highlightedIndex, filteredOptions.length - 1)];
      if (target) commitOption(target);
    } else if (event.key === "Escape") {
      if (!isOpen) return;
      event.preventDefault();
      setIsOpen(false);
      setQuery(value);
    } else if (event.key === "Home") {
      if (!isOpen || filteredOptions.length === 0) return;
      event.preventDefault();
      setHighlightedIndex(0);
    } else if (event.key === "End") {
      if (!isOpen || filteredOptions.length === 0) return;
      event.preventDefault();
      setHighlightedIndex(filteredOptions.length - 1);
    }
  };

  useEffect(() => {
    if (!isOpen || !menuRef.current || !menuPosition) return;
    const targetTop = highlightedIndex * OPTION_ROW_HEIGHT;
    const targetBottom = targetTop + OPTION_ROW_HEIGHT;
    const viewTop = menuRef.current.scrollTop;
    const viewBottom = viewTop + menuPosition.maxHeight;
    if (targetTop < viewTop) {
      menuRef.current.scrollTop = targetTop;
    } else if (targetBottom > viewBottom) {
      menuRef.current.scrollTop = targetBottom - menuPosition.maxHeight;
    }
  }, [highlightedIndex, isOpen, menuPosition]);

  const handleSearchBlur = () => {
    // If the blur came from commitOption, the value is already correct and
    // the closure below holds the pre-commit `query`, bail out so we don't
    // wipe the freshly-committed value.
    if (justCommittedRef.current) {
      justCommittedRef.current = false;
      setIsOpen(false);
      return;
    }
    blurTimeoutRef.current = setTimeout(() => {
      const normalizedQuery = query.trim().toLowerCase();
      const exactMatch = options.find(
        (option) => option.toLowerCase() === normalizedQuery
      );

      if (exactMatch) {
        setQuery(exactMatch);
        if (value !== exactMatch) onChange(exactMatch);
      } else if (allowDeselect && normalizedQuery === "") {
        setQuery("");
        if (value !== "") onChange("");
      } else {
        setQuery(value);
      }

      setIsOpen(false);
    }, 120);
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        marginBottom: 8,
        width: "100%",
      }}
    >
      {inline && label && (
        <span
          style={{
            minWidth: 60,
            fontSize: "0.74rem",
            fontWeight: 600,
            color: colors.white,
          }}
        >
          {label}:
        </span>
      )}
      <div style={{ flex: 1, position: "relative" as const }}>
        {searchable ? (
          <>
            <div
              ref={inputWrapperRef}
              style={{ position: "relative" as const }}
            >
              <input
                ref={inputRef}
                type="text"
                value={query}
                placeholder={allowDeselect ? "Type to search..." : ""}
                onFocus={() => setIsOpen(true)}
                onBlur={handleSearchBlur}
                onKeyDown={handleSearchKeyDown}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setQuery(nextValue);
                  setIsOpen(true);

                  if (allowDeselect && nextValue === "") {
                    onChange("");
                  }
                }}
                style={{
                  ...baseFieldStyles,
                  ...(allowDeselect && value ? { paddingRight: 26 } : {}),
                }}
              />
              {allowDeselect && value && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setQuery("");
                    onChange("");
                    setUserDeselected(true);
                    setIsOpen(false);
                    inputRef.current?.blur();
                  }}
                  title="Clear selection"
                  aria-label="Clear selection"
                  style={{
                    position: "absolute",
                    top: "50%",
                    right: 6,
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    padding: "0 4px",
                    color: colors.white,
                    cursor: "pointer",
                    fontWeight: "bold",
                    fontSize: 14,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              )}
            </div>

            {portalReady &&
              isOpen &&
              filteredOptions.length > 0 &&
              menuPosition &&
              createPortal(
                <div
                  ref={menuRef}
                  style={{
                    position: "fixed",
                    top: menuPosition.top,
                    left: menuPosition.left,
                    width: menuWidth,
                    maxHeight: menuPosition.maxHeight,
                    overflowY: "auto" as const,
                    borderRadius: 8,
                    backgroundColor: colors.darkblue,
                    border: `1px solid ${colors.white}20`,
                    boxShadow: "0 8px 20px rgba(0,0,0,0.35)",
                    opacity: 1,
                    zIndex: 2147483647,
                  }}
                  onScroll={(event) =>
                    setScrollTop(event.currentTarget.scrollTop)
                  }
                >
                  <div
                    style={{
                      height: filteredOptions.length * OPTION_ROW_HEIGHT,
                      position: "relative",
                    }}
                  >
                    {visibleWindow.visibleOptions.map((opt, index) => {
                      const absoluteIndex = visibleWindow.startIndex + index;
                      const isHighlighted = absoluteIndex === highlightedIndex;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onMouseEnter={() => setHighlightedIndex(absoluteIndex)}
                          onClick={() => commitOption(opt)}
                          style={{
                            position: "absolute",
                            top: absoluteIndex * OPTION_ROW_HEIGHT,
                            left: 0,
                            right: 0,
                            height: OPTION_ROW_HEIGHT,
                            display: "block",
                            textAlign: "left" as const,
                            padding: "8px 10px",
                            border: "none",
                            background: isHighlighted
                              ? `${colors.white}30`
                              : opt === value
                              ? `${colors.white}18`
                              : "transparent",
                            color: colors.white,
                            opacity: 1,
                            cursor: "pointer",
                            fontSize: "0.84rem",
                            whiteSpace: "nowrap" as const,
                            lineHeight: 1.35,
                            width: "100%",
                          }}
                        >
                          {displayFor ? displayFor(opt) : opt}
                        </button>
                      );
                    })}
                  </div>
                </div>,
                document.body
              )}
          </>
        ) : (
          <div style={{ position: "relative" as const }}>
            <select
              value={value}
              onChange={(e) => {
                const val = e.target.value;
                onChange(val);
                if (allowDeselect && val === "") {
                  setUserDeselected(true);
                } else {
                  setUserDeselected(false);
                }
              }}
              style={{
                ...baseFieldStyles,
                cursor: "pointer",
                appearance: "none",
                WebkitAppearance: "none",
                MozAppearance: "none",
                ...(allowDeselect && value ? { paddingRight: 26 } : {}),
              }}
            >
              {allowDeselect && <option value="">--Select--</option>}
              {options.map((opt) => (
                <option key={opt} value={opt}>
                  {displayFor ? displayFor(opt) : opt}
                </option>
              ))}
            </select>
            {allowDeselect && value && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange("");
                  setUserDeselected(true);
                }}
                title="Clear selection"
                aria-label="Clear selection"
                style={{
                  position: "absolute",
                  top: "50%",
                  right: 6,
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  padding: "0 4px",
                  color: colors.white,
                  cursor: "pointer",
                  fontWeight: "bold",
                  fontSize: 14,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
