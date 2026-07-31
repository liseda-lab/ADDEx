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
  // When true (default), a list that collapses to exactly one option auto-
  // commits it — correct for a forced single-choice select. It is WRONG for a
  // searchable combobox whose options are dynamically filtered: a filter that
  // happens to leave one result would silently select it (e.g. the
  // "only pre-computed" filter leaving a single cached target). Such callers
  // pass false so the choice stays explicit.
  autoSelectSingle?: boolean;
  // Optional display mapping: when given, options are shown with
  // `displayFor(option)` but the underlying value passed to onChange / stored
  // in state stays the raw option. Used e.g. to show OREGANO "Protein" as
  // "Target" without changing the lookup logic.
  displayFor?: (value: string) => string;
  // When provided, options in this set are rendered as a separate, dimmed group
  // below a `mutedGroupLabel` divider (instead of interleaved). Used by the
  // "only pre-computed" filter to list no-paths hypotheses apart from the ones
  // that actually have an explanation. Muted options stay selectable.
  mutedOptions?: Set<string>;
  mutedGroupLabel?: string;
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
  autoSelectSingle = true,
  displayFor,
  mutedOptions,
  mutedGroupLabel,
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

    if (autoSelectSingle && options.length === 1 && value === "" && !isDeselected) {
      onChange(options[0]);
    }

    prevOptionsRef.current = options;
    prevValueRef.current = value;
  }, [options, value, onChange, userDeselected, autoSelectSingle]);

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

  const baseFilteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) return options;

    return options.filter((option) =>
      option.toLowerCase().startsWith(normalizedQuery)
    );
  }, [options, query]);

  // Grouping: when `mutedOptions` is supplied, split the filtered list into a
  // primary group and a muted group shown under `mutedGroupLabel`. The flat
  // `filteredOptions` below keeps primary-then-muted order (divider excluded)
  // so keyboard nav and selection stay correct.
  const grouped = Boolean(mutedOptions && mutedOptions.size > 0);

  const { normalOptions, mutedFilteredOptions } = useMemo(() => {
    if (!grouped) {
      return {
        normalOptions: baseFilteredOptions,
        mutedFilteredOptions: [] as string[],
      };
    }
    const normal: string[] = [];
    const muted: string[] = [];
    for (const option of baseFilteredOptions) {
      (mutedOptions!.has(option) ? muted : normal).push(option);
    }
    return { normalOptions: normal, mutedFilteredOptions: muted };
  }, [grouped, baseFilteredOptions, mutedOptions]);

  const filteredOptions = useMemo(
    () =>
      grouped
        ? [...normalOptions, ...mutedFilteredOptions]
        : baseFilteredOptions,
    [grouped, normalOptions, mutedFilteredOptions, baseFilteredOptions]
  );

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

    const updateMenuPosition = (event?: Event) => {
      if (!inputWrapperRef.current) return;

      // The scroll listener is registered in capture phase, so it also fires
      // when the user scrolls *inside* the menu. Repositioning on the menu's own
      // scroll recomputed menuPosition every frame, which re-ran the virtual
      // window and reflowed the list mid-scroll (the "jumping scrollbar"). Only
      // reposition for scrolls that could actually move the input, i.e. those
      // that did not originate inside the menu.
      if (
        event &&
        menuRef.current &&
        event.target instanceof Node &&
        menuRef.current.contains(event.target)
      ) {
        return;
      }

      const rect = inputWrapperRef.current.getBoundingClientRect();
      const viewportPadding = 12;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const preferredTop = rect.bottom + 4;
      const spaceBelow = viewportHeight - preferredTop - viewportPadding;
      const spaceAbove = rect.top - viewportPadding - 4;
      // Flip the menu above the input when there isn't comfortable room below
      // and there's more room above, so a long list (e.g. the grouped
      // pre-computed list low in the panel) isn't clipped against the bottom
      // of the viewport.
      const showAbove = spaceBelow < 240 && spaceAbove > spaceBelow;
      const available = showAbove ? spaceAbove : spaceBelow;
      const maxHeight = Math.max(140, Math.min(280, available));
      const dividerAllowance =
        grouped && mutedFilteredOptions.length > 0 ? 28 : 0;
      const naturalMenuHeight = Math.max(
        OPTION_ROW_HEIGHT,
        filteredOptions.length * OPTION_ROW_HEIGHT + dividerAllowance
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
      {/* Persistent custom scrollbar for the option menu. The native overlay
          scrollbar (macOS) auto-hides until you scroll, so users could not tell
          a long list was scrollable. The menu background is always dark
          (darkblue), so a light translucent thumb reads on any theme. */}
      <style>{`
        .addex-menu-scroll::-webkit-scrollbar { width: 10px; }
        .addex-menu-scroll::-webkit-scrollbar-track {
          background: transparent;
          margin: 4px 0;
        }
        .addex-menu-scroll::-webkit-scrollbar-thumb {
          background-color: rgba(255,255,255,0.32);
          border-radius: 6px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        .addex-menu-scroll::-webkit-scrollbar-thumb:hover {
          background-color: rgba(255,255,255,0.5);
          background-clip: padding-box;
        }
      `}</style>
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
                    // Guard the blur handler from restoring the just-cleared
                    // value via its stale-closure reset (same reason commitOption
                    // sets this) — otherwise the first click appears to do nothing.
                    justCommittedRef.current = true;
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
                  className="addex-menu-scroll"
                  style={{
                    // Firefox persistent-scrollbar equivalents (WebKit uses the
                    // ::-webkit-scrollbar rules above); gutter reserves the
                    // track so options do not shift when it appears.
                    scrollbarWidth: "thin" as const,
                    scrollbarColor: "rgba(255,255,255,0.32) transparent",
                    scrollbarGutter: "stable" as const,
                    position: "fixed",
                    top: menuPosition.top,
                    left: menuPosition.left,
                    // Menu width matches the trigger input. Long entity
                    // names are truncated with ellipsis on each option;
                    // the option button has a `title` attribute so the
                    // full name appears as a native browser tooltip on hover.
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
                  {grouped ? (
                    // Grouped render (small filtered list): a "no valid paths"
                    // divider between the primary options and the dimmed muted
                    // ones. Not virtualized — the pre-computed set for one
                    // endpoint is bounded, so a flow layout keeps the divider
                    // trivial to place.
                    <div>
                      {filteredOptions.map((opt, absoluteIndex) => {
                        const isMuted = Boolean(mutedOptions?.has(opt));
                        const isHighlighted = absoluteIndex === highlightedIndex;
                        return (
                          <React.Fragment key={opt}>
                            {isMuted &&
                              absoluteIndex === normalOptions.length && (
                                <div
                                  style={{
                                    padding: "5px 10px",
                                    fontSize: "0.72rem",
                                    fontWeight: 600,
                                    color: `${colors.white}80`,
                                    backgroundColor: `${colors.white}0d`,
                                    borderTop: `0.5px solid ${colors.white}20`,
                                    borderBottom: `0.5px solid ${colors.white}20`,
                                  }}
                                >
                                  {mutedGroupLabel ?? "No valid paths found"}
                                </div>
                              )}
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onMouseEnter={() =>
                                setHighlightedIndex(absoluteIndex)
                              }
                              onClick={() => commitOption(opt)}
                              style={{
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
                                color: isMuted
                                  ? `${colors.white}85`
                                  : colors.white,
                                cursor: "pointer",
                                fontSize: "0.84rem",
                                whiteSpace: "nowrap" as const,
                                overflow: "hidden" as const,
                                textOverflow: "ellipsis" as const,
                                lineHeight: 1.35,
                                width: "100%",
                              }}
                            >
                              {displayFor ? displayFor(opt) : opt}
                            </button>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  ) : (
                    <div
                      style={{
                        height: filteredOptions.length * OPTION_ROW_HEIGHT,
                        position: "relative",
                      }}
                    >
                      {visibleWindow.visibleOptions.map((opt, index) => {
                        const absoluteIndex = visibleWindow.startIndex + index;
                        const isHighlighted =
                          absoluteIndex === highlightedIndex;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onMouseEnter={() =>
                              setHighlightedIndex(absoluteIndex)
                            }
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
                              // Truncate ultra-long names with ellipsis instead
                              // of letting them spill out of the capped menu.
                              overflow: "hidden" as const,
                              textOverflow: "ellipsis" as const,
                              lineHeight: 1.35,
                              width: "100%",
                            }}
                          >
                            {displayFor ? displayFor(opt) : opt}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>,
                document.body
              )}

            {/* Instant tooltip showing the full text of the highlighted
                option. Driven by highlightedIndex, so it works for BOTH
                mouse hover (onMouseEnter sets it) and keyboard arrow-key
                navigation. Replaces the native `title` tooltip, which has
                a ~500ms-1s OS-controlled delay we can't override. */}
            {portalReady &&
              isOpen &&
              menuPosition &&
              highlightedIndex >= 0 &&
              filteredOptions[highlightedIndex] !== undefined &&
              createPortal(
                (() => {
                  const opt = filteredOptions[highlightedIndex];
                  const text = displayFor ? displayFor(opt) : opt;
                  const rowTop =
                    menuPosition.top + highlightedIndex * OPTION_ROW_HEIGHT - scrollTop;
                  const tipLeft = menuPosition.left + menuWidth + 6;
                  const viewportRightLimit =
                    window.innerWidth - 8 - tipLeft;
                  return (
                    <div
                      style={{
                        position: "fixed",
                        top: Math.max(8, Math.min(rowTop, window.innerHeight - 60)),
                        left: tipLeft,
                        maxWidth: Math.max(180, Math.min(380, viewportRightLimit)),
                        padding: "6px 10px",
                        backgroundColor: colors.darkblue,
                        color: colors.white,
                        border: `1px solid ${colors.white}40`,
                        borderRadius: 6,
                        fontSize: "0.82rem",
                        lineHeight: 1.35,
                        whiteSpace: "normal" as const,
                        wordBreak: "break-word" as const,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                        zIndex: 2147483647,
                        pointerEvents: "none" as const,
                      }}
                    >
                      {text}
                    </div>
                  );
                })(),
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
