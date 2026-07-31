"use client";

import { useEffect, useRef, useState } from "react";
import { CaretDown, MagnifyingGlass, X } from "phosphor-react";
import { useTheme } from "../../../../styles/ThemeContext";
import EntityAvailability from "./EntityAvailability";

interface Props {
  label?: string;
  compact?: boolean;
  // Render as a small round icon-only button (used as a corner button on the
  // search page, where a full-width labelled button overlaps the graph toolbar).
  iconOnly?: boolean;
  // Render the checker as a dropdown anchored under the trigger instead of a
  // centered modal. Used in the search page's top-right corner, where a modal
  // reads like a step in the flow rather than the reference tool it is.
  dropdown?: boolean;
  // With iconOnly, show the label permanently beside the round icon (instead of
  // only on hover). Used where the bare icon is not self-explanatory.
  withLabel?: boolean;
}

// Small trigger that opens the entity-availability checker in a modal. Used on
// the search page so users can check dataset coverage without leaving the flow.
export default function EntityAvailabilityLauncher({
  label = "Which dataset has my entity?",
  compact = false,
  iconOnly = false,
  dropdown = false,
  withLabel = false,
}: Props) {
  const colors = useTheme();
  const [open, setOpen] = useState(false);
  // "Pinned" means the panel was opened deliberately (clicked, or the user has
  // focused something inside it). Pinned panels ignore mouse-leave, so drifting
  // off the panel never discards what someone is typing.
  const [pinned, setPinned] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const closeNow = () => {
    cancelClose();
    setOpen(false);
    setPinned(false);
  };

  useEffect(() => cancelClose, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeNow();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Dropdown mode has no overlay to catch clicks, so close on any outside press.
  useEffect(() => {
    if (!open || !dropdown) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) closeNow();
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open, dropdown]);

  // Hover opens the panel; leaving closes it only if it was never pinned. The
  // delay covers the gap between the trigger and the panel, so moving the
  // pointer down into the results does not dismiss it mid-travel.
  const hoverHandlers = dropdown
    ? {
        onMouseEnter: () => {
          cancelClose();
          setOpen(true);
        },
        onMouseLeave: () => {
          if (pinned) return;
          cancelClose();
          closeTimerRef.current = setTimeout(() => setOpen(false), 250);
        },
        // Typing in the lookup pins it: focus means intent.
        onFocusCapture: () => {
          cancelClose();
          setOpen(true);
          setPinned(true);
        },
      }
    : {};

  // An icon-only dropdown trigger grows into a labelled pill while it is open,
  // so the collapsed state stays out of the way but the hovered state still
  // says what it is. Skipped when the label is already shown permanently
  // (withLabel), where there is nothing to reveal.
  const expanded = dropdown && iconOnly && open && !withLabel;
  // Round icon + permanent label beside it.
  const inlineLabel = iconOnly && withLabel;

  return (
    <div
      ref={wrapperRef}
      {...hoverHandlers}
      style={
        dropdown
          ? { position: "relative", display: "inline-block" }
          : { display: "contents" }
      }
    >
      <button
        type="button"
        onClick={() => {
          if (!dropdown) {
            setOpen((v) => !v);
            return;
          }
          // Hover may have opened it already; the first click pins it open, a
          // second click dismisses.
          if (open && pinned) {
            closeNow();
          } else {
            cancelClose();
            setOpen(true);
            setPinned(true);
          }
        }}
        // No native tooltip in dropdown mode: hovering already opens the panel,
        // so a title would just render a duplicate label on top of it.
        title={iconOnly && !dropdown ? label : undefined}
        aria-label={iconOnly ? label : undefined}
        aria-expanded={dropdown ? open : undefined}
        aria-haspopup={dropdown ? "dialog" : undefined}
        style={
          inlineLabel
            ? {
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
                color: colors.white,
                fontSize: compact ? "0.8rem" : "0.85rem",
                fontWeight: 600,
                whiteSpace: "nowrap",
                lineHeight: 1.2,
              }
            : iconOnly
            ? {
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: expanded ? 8 : 0,
                // Collapsed: a 40px circle. Expanded: a pill sized to its label.
                width: expanded ? "auto" : 40,
                height: 40,
                padding: expanded ? "0 0.95rem" : 0,
                borderRadius: expanded ? 20 : "50%",
                border: `1px solid ${colors.white}30`,
                background: colors.card,
                color: colors.white,
                cursor: "pointer",
                boxShadow: "0 2px 10px rgba(0,0,0,0.22)",
                fontSize: "0.82rem",
                fontWeight: 600,
                lineHeight: 1,
                whiteSpace: "nowrap",
                overflow: "hidden",
                transition:
                  "padding 0.15s ease, border-radius 0.15s ease, gap 0.15s ease",
              }
            : {
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: compact ? "0.35rem 0.65rem" : "0.5rem 0.9rem",
                borderRadius: 8,
                border: "none",
                background: colors.buttons,
                color: "#FFFFFF",
                fontSize: compact ? "0.76rem" : "0.82rem",
                fontWeight: 600,
                cursor: "pointer",
                lineHeight: 1.3,
                whiteSpace: "nowrap",
                boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
              }
        }
      >
        {inlineLabel ? (
          <>
            <span
              aria-hidden="true"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 38,
                height: 38,
                flexShrink: 0,
                borderRadius: "50%",
                border: `1px solid ${colors.white}30`,
                background: colors.card,
                color: colors.white,
                boxShadow: "0 2px 10px rgba(0,0,0,0.22)",
              }}
            >
              <MagnifyingGlass size={18} weight="bold" />
            </span>
            <span>{label}</span>
            {dropdown ? (
              <CaretDown
                size={12}
                weight="bold"
                aria-hidden="true"
                style={{
                  transform: open ? "rotate(180deg)" : "none",
                  transition: "transform 0.15s ease",
                }}
              />
            ) : null}
          </>
        ) : (
          <>
            <MagnifyingGlass
              size={iconOnly ? 18 : 14}
              weight="bold"
              aria-hidden="true"
            />
            {iconOnly && !expanded ? null : label}
            {dropdown && !iconOnly ? (
              <CaretDown
                size={12}
                weight="bold"
                aria-hidden="true"
                style={{
                  transform: open ? "rotate(180deg)" : "none",
                  transition: "transform 0.15s ease",
                }}
              />
            ) : null}
          </>
        )}
      </button>

      {open && dropdown && (
        <div
          role="dialog"
          aria-label="Which dataset has my entity?"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            zIndex: 3000,
            width: 380,
            maxWidth: "min(380px, calc(100vw - 2rem))",
            background: colors.card,
            border: `1px solid ${colors.white}22`,
            borderRadius: 12,
            padding: "0.9rem 1rem 1rem",
            boxShadow: "0 16px 44px rgba(0,0,0,0.4)",
            maxHeight: "70vh",
            overflowY: "auto",
            textAlign: "left",
          }}
          // Keep the pointer inside the wrapper's hover region while the panel
          // is open, so travelling from the trigger into the panel is safe.
          onMouseEnter={cancelClose}
        >
          <EntityAvailability bare onNavigate={() => setOpen(false)} />
        </div>
      )}

      {open && !dropdown && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Which dataset has my entity?"
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 3000,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "6vh 1rem 1rem",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 560,
              background: colors.card,
              border: `1px solid ${colors.white}22`,
              borderRadius: 14,
              padding: "1rem 1.15rem 1.2rem",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              maxHeight: "84vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.5rem",
                marginBottom: "0.8rem",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  color: colors.white,
                  fontSize: "1rem",
                  fontWeight: 700,
                }}
              >
                Which dataset has my entity?
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{
                  background: "transparent",
                  border: "none",
                  color: colors.white,
                  cursor: "pointer",
                  padding: 4,
                  display: "inline-flex",
                }}
              >
                <X size={18} weight="bold" aria-hidden="true" />
              </button>
            </div>
            <EntityAvailability bare onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
