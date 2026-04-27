"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshCw, Copy, Check, Download } from "lucide-react";
import { useTheme } from "../../../../styles/ThemeContext";
import { Pair } from "@/app/hooks/types";
import PathList from "../pathList/PathList";

interface SumSideMenuProps {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  pair: Pair | null;
  visiblePaths: Set<string>;
  togglePath: (pathId: string) => void;
  visibleLCAs: Set<string>;
  toggleLCA: (lcaName: string) => void;
  onPathHover: (pathId: string | null) => void;
  onLcaHover: (lcaName: string | null) => void;
  hoveredNodeId?: string | null;
  onVerbalizationGenerated?: (verbalization: string) => void;
}

export default function SumSideMenu({
  collapsed,
  setCollapsed,
  pair,
  visiblePaths,
  togglePath,
  visibleLCAs,
  toggleLCA,
  onPathHover,
  onLcaHover,
  hoveredNodeId = null,
  onVerbalizationGenerated,
}: SumSideMenuProps) {
  const colors = useTheme();
  const [activeTab, setActiveTab] = useState<"verbalization" | "paths">(
    "verbalization"
  );
  const [otherPathsOpen, setOtherPathsOpen] = useState(false);
  const [globalExplanation, setGlobalExplanation] = useState("");
  const [explanationStatus, setExplanationStatus] = useState<
    "idle" | "loading" | "ready" | "failed"
  >("idle");
  const [explanationError, setExplanationError] = useState("");
  // Remembers the last pair id we auto-fetched a verbalization for, so we
  // don't re-trigger on every path-toggle, only once per pair.
  const autoFetchedPairIdRef = useRef<string | null>(null);
  const [verbalizationFontSize, setVerbalizationFontSize] = useState(11);
  const [copied, setCopied] = useState(false);
  const searchParams = useSearchParams();

  const MIN_FONT = 10;
  const MAX_FONT = 22;
  const decreaseFont = () =>
    setVerbalizationFontSize((s) => Math.max(MIN_FONT, s - 1));
  const increaseFont = () =>
    setVerbalizationFontSize((s) => Math.min(MAX_FONT, s + 1));

  const copyVerbalization = async () => {
    try {
      await navigator.clipboard.writeText(globalExplanation);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy verbalization:", err);
    }
  };

  const downloadVerbalization = () => {
    if (!globalExplanation) return;
    const blob = new Blob([globalExplanation], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const safeName = pair
      ? `${pair.source}_${pair.target}_summary`.replace(/\s+/g, "_")
      : "summary";
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeName}.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const selectedContext = useMemo(
    () => ({
      dataset: searchParams.get("dataset") ?? "",
      task: searchParams.get("task") ?? "",
      persona: searchParams.get("persona") ?? "",
    }),
    [searchParams]
  );

  const allLcaNames = useMemo(() => {
    if (!pair) {
      return new Set<string>();
    }

    const names = new Set<string>();
    pair.paths.forEach((path) => {
      Object.values(path.lowest_common_ancestors ?? {}).forEach((entry) => {
        const values = Array.isArray(entry) ? entry : [entry];
        values.forEach((value) => {
          if (value) {
            names.add(value);
          }
        });
      });
    });
    return names;
  }, [pair]);

  const isFullPairSelection = useMemo(() => {
    if (!pair) {
      return false;
    }

    const hasAllPaths =
      visiblePaths.size === pair.paths.length &&
      pair.paths.every((path) => visiblePaths.has(path.id));
    const hasAllLcas =
      visibleLCAs.size === allLcaNames.size &&
      Array.from(allLcaNames).every((name) => visibleLCAs.has(name));

    return hasAllPaths && hasAllLcas;
  }, [allLcaNames, pair, visibleLCAs, visiblePaths]);

  const fetchGlobalExplanation = useCallback(async (forceRefresh = false) => {
    if (!pair || visiblePaths.size === 0) {
      setGlobalExplanation("");
      setExplanationStatus("idle");
      setExplanationError("");
      return;
    }

    if (!selectedContext.dataset || !selectedContext.task || !selectedContext.persona) {
      setExplanationStatus("failed");
      setExplanationError("Dataset, task, or persona is missing from the current search context.");
      return;
    }

    try {
      setExplanationStatus("loading");
      setExplanationError("");

      const response = await fetch("/api/global-explanation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dataset: selectedContext.dataset,
          task: selectedContext.task,
          persona: selectedContext.persona,
          source: pair.source,
          target: pair.target,
          visiblePathIds: Array.from(visiblePaths),
          visibleLCAs: Array.from(visibleLCAs),
          forceRefresh,
        }),
      });

      const json = (await response.json()) as { explanation?: string; error?: string };
      if (!response.ok || !json.explanation) {
        throw new Error(json.error ?? `HTTP ${response.status}`);
      }
      setGlobalExplanation(json.explanation);
      setExplanationStatus("ready");
      onVerbalizationGenerated?.(json.explanation);
    } catch (error) {
      console.error("Failed to generate global explanation:", error);
      setExplanationStatus("failed");
      setExplanationError(
        error instanceof Error
          ? error.message
          : "Failed to generate the global explanation."
      );
    }
  }, [pair, selectedContext.dataset, selectedContext.persona, selectedContext.task, visibleLCAs, visiblePaths]);

  useEffect(() => {
    const savedVerbalization = pair?.verbalization?.trim();
    if (pair && savedVerbalization) {
      setGlobalExplanation(savedVerbalization);
      setExplanationStatus("ready");
      setExplanationError("");
      return;
    }

    setGlobalExplanation("");
    setExplanationStatus("idle");
    setExplanationError("");
  }, [pair?.id, pair?.verbalization]);

  useEffect(() => {
    if (!pair) {
      setGlobalExplanation("");
      setExplanationStatus("idle");
      setExplanationError("");
      autoFetchedPairIdRef.current = null;
      return;
    }

    if (visiblePaths.size === 0) {
      // Keep saved verbalization visible during initial path-selection bootstrap.
      if (pair.verbalization?.trim()) {
        return;
      }
      setGlobalExplanation("");
      setExplanationStatus("idle");
      setExplanationError("");
      return;
    }

    if (
      globalExplanation ||
      explanationStatus === "loading" ||
      explanationStatus === "failed"
    ) {
      return;
    }

    // Auto-fetch once per pair when there are visible paths but no saved
    // verbalization. Previously this required a full-pair selection which
    // left pairs with many paths stuck on the "no saved verbalization"
    // empty state. Ref gate prevents repeat fetches on path-toggle.
    if (autoFetchedPairIdRef.current === pair.id) {
      return;
    }

    // Auto-fetch using only the default 3 visible paths. The backend is
    // responsible for persisting this first-time generation to paths.json
    // so the same pair loads instantly next visit.
    if (visiblePaths.size > 0) {
      autoFetchedPairIdRef.current = pair.id;
      void fetchGlobalExplanation(false);
    }
  }, [pair, visiblePaths.size, globalExplanation, explanationStatus, fetchGlobalExplanation, isFullPairSelection]);

  const styles = {
    aside: {
      width: collapsed ? 60 : 320,
      height: "calc(100vh - 60px)",
      padding: collapsed ? "1rem 0.5rem" : "1.15rem 0.9rem 1.2rem",
      backgroundColor: colors.card,
      borderLeft: `1px solid ${colors.white}15`,
      boxShadow: "0 8px 22px rgba(0,0,0,0.08)",
      color: colors.white,
      fontWeight: 500,
      boxSizing: "border-box" as const,
      overflowY: "auto" as const,
      position: "fixed" as const,
      top: 60,
      right: 0,
      zIndex: 40,
      transition: "width 0.2s ease",
      display: "flex",
      flexDirection: "column" as const,
    },

    toggleButton: {
      position: "absolute" as const,
      top: 10,
      left: 10,
      width: 30,
      height: 30,
      borderRadius: 8,
      border: `1px solid ${colors.white}30`,
      backgroundColor: colors.darkblue,
      color: colors.white,
      fontWeight: 600,
      fontSize: "0.95rem",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
    },

    tabsContainer: {
      display: "flex",
      marginTop: "2.5rem",
      marginBottom: "1rem",
      borderBottom: `1px solid ${colors.white}30`,
    },

    tab: (isActive: boolean) => ({
      flex: 1,
      padding: "0.55rem 0.4rem",
      textAlign: "center" as const,
      cursor: "pointer",
      backgroundColor: isActive ? colors.darkblue : "transparent",
      borderRadius: 8,
      marginRight: "0.25rem",
      transition: "background 0.15s",
      fontSize: "0.82rem",
      fontWeight: 600,
    }),

    content: {
      padding: "0.8rem",
      borderRadius: 12,
      border: `1px solid ${colors.white}30`,
      backgroundColor: colors.card,
      overflowWrap: "break-word" as const,
      wordBreak: "break-word" as const,
    },
    footerAction: {
      display: "flex",
      justifyContent: "flex-end",
      alignItems: "center",
      marginTop: "auto",
      paddingTop: "1rem",
    },
    refreshButton: {
      padding: "0.45rem 0.8rem",
      borderRadius: 8,
      border: `1px solid ${colors.white}30`,
      backgroundColor: colors.darkblue,
      color: colors.white,
      cursor: "pointer",
      fontWeight: 600,
      fontSize: 12,
      display: "inline-flex",
      alignItems: "center",
      gap: "0.45rem",
    },
    helperText: {
      margin: 0,
      color: `${colors.white}bb`,
      fontSize: 12,
      lineHeight: 1.5,
    },
  };

  return (
    <aside style={styles.aside}>
      <button
        style={styles.toggleButton}
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? "<" : ">"}
      </button>

      {!collapsed && (
        <>
          <div style={styles.tabsContainer}>
            <div
              style={styles.tab(activeTab === "verbalization")}
              onClick={() => setActiveTab("verbalization")}
            >
              Verbalization
            </div>
            <div
              style={styles.tab(activeTab === "paths")}
              onClick={() => setActiveTab("paths")}
            >
              Path Selection
            </div>
          </div>

          {activeTab === "verbalization" && pair && (
            <div style={styles.content}>
              {explanationStatus === "failed" && (
                <p style={{ ...styles.helperText, color: "#ffb3b3", marginBottom: "0.75rem" }}>
                  {explanationError || "Failed to generate the global explanation."}
                </p>
              )}

              {explanationStatus === "loading" && !globalExplanation && (
                <p style={styles.helperText}>
                  Generating an integrated explanation from the visible graph paths...
                </p>
              )}

              {globalExplanation && (
                <>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      justifyContent: "flex-end",
                      alignItems: "center",
                      marginBottom: "0.6rem",
                    }}
                  >
                    <button
                      type="button"
                      onClick={decreaseFont}
                      disabled={verbalizationFontSize <= MIN_FONT}
                      title="Decrease font size"
                      aria-label="Decrease font size"
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        border: `1px solid ${colors.white}30`,
                        backgroundColor: "transparent",
                        color: colors.white,
                        fontWeight: 700,
                        fontSize: 12,
                        cursor:
                          verbalizationFontSize <= MIN_FONT ? "not-allowed" : "pointer",
                        opacity: verbalizationFontSize <= MIN_FONT ? 0.45 : 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      A−
                    </button>
                    <button
                      type="button"
                      onClick={increaseFont}
                      disabled={verbalizationFontSize >= MAX_FONT}
                      title="Increase font size"
                      aria-label="Increase font size"
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        border: `1px solid ${colors.white}30`,
                        backgroundColor: "transparent",
                        color: colors.white,
                        fontWeight: 700,
                        fontSize: 14,
                        cursor:
                          verbalizationFontSize >= MAX_FONT ? "not-allowed" : "pointer",
                        opacity: verbalizationFontSize >= MAX_FONT ? 0.45 : 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      A+
                    </button>
                    <button
                      type="button"
                      onClick={copyVerbalization}
                      title={copied ? "Copied" : "Copy summary"}
                      aria-label="Copy summary"
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        border: `1px solid ${colors.white}30`,
                        backgroundColor: "transparent",
                        color: copied ? colors.green : colors.white,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={downloadVerbalization}
                      title="Download summary as .txt"
                      aria-label="Download summary as text file"
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        border: `1px solid ${colors.white}30`,
                        backgroundColor: "transparent",
                        color: colors.white,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Download size={14} />
                    </button>
                  </div>
                  <p
                    style={{
                      textAlign: "justify",
                      lineHeight: 1.55,
                      margin: 0,
                      width: "100%",
                      overflowWrap: "break-word",
                      wordBreak: "break-word",
                      whiteSpace: "pre-wrap",
                      fontSize: verbalizationFontSize,
                    }}
                  >
                    {globalExplanation}
                  </p>
                </>
              )}

              {!globalExplanation && explanationStatus !== "loading" && explanationStatus !== "failed" && (
                <p style={styles.helperText}>
                  {visiblePaths.size > 0
                    ? "Preparing a verbalization for the visible paths…"
                    : "Enable at least one path to generate a verbalization."}
                </p>
              )}
            </div>
          )}

          {activeTab === "paths" && pair && (
            <>
              {/* Discreet disclosure to discover paths that aren't in the
                  visualization. Lives at the top so the "N available"
                  counter is visible the moment users open the tab. Closed
                  by default; opens inline above the active paths. */}
              {(() => {
                const hiddenCount = pair.paths.filter(
                  (p) => !visiblePaths.has(p.id)
                ).length;
                if (hiddenCount === 0) return null;
                return (
                  <div
                    style={{
                      margin: "0 0.5rem 0.5rem",
                      borderRadius: 8,
                      border: `1px solid ${colors.white}45`,
                      // Transparent so the path cards inside layer over the
                      // SumSideMenu's card surface the same way the default
                      // path cards do; otherwise the cards inside read darker.
                      background: "transparent",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setOtherPathsOpen((v) => !v)}
                      aria-expanded={otherPathsOpen}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.5rem",
                        padding: "0.55rem 0.75rem",
                        border: "none",
                        background: "transparent",
                        color: colors.white,
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        borderRadius: 8,
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.4rem",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-block",
                            transform: otherPathsOpen
                              ? "rotate(90deg)"
                              : "rotate(0deg)",
                            transition: "transform 0.15s ease",
                            fontSize: "0.7rem",
                          }}
                          aria-hidden="true"
                        >
                          ▶
                        </span>
                        Other paths
                      </span>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          color: `${colors.white}99`,
                          fontWeight: 500,
                        }}
                      >
                        {hiddenCount} available
                      </span>
                    </button>

                    {otherPathsOpen && (
                      <div
                        style={{
                          padding: "0 0.5rem 0.6rem",
                          borderTop: `1px solid ${colors.white}15`,
                        }}
                      >
                        <PathList
                          dataset={selectedContext.dataset}
                          pair={pair}
                          visiblePaths={visiblePaths}
                          togglePath={togglePath}
                          visibleLCAs={visibleLCAs}
                          toggleLCA={toggleLCA}
                          onPathHover={onPathHover}
                          onLcaHover={onLcaHover}
                          hoveredNodeId={hoveredNodeId}
                          filter="hidden"
                        />
                      </div>
                    )}
                  </div>
                );
              })()}

              <PathList
                dataset={selectedContext.dataset}
                pair={pair}
                visiblePaths={visiblePaths}
                togglePath={togglePath}
                visibleLCAs={visibleLCAs}
                toggleLCA={toggleLCA}
                onPathHover={onPathHover}
                onLcaHover={onLcaHover}
                hoveredNodeId={hoveredNodeId}
                filter="visible"
              />
            </>
          )}

          {activeTab === "verbalization" && pair && (
            <div style={styles.footerAction}>
              <div
                style={{ position: "relative", display: "inline-block" }}
                onMouseEnter={(e) => {
                  const tip = e.currentTarget.querySelector(
                    ".sum-menu-tooltip"
                  ) as HTMLElement | null;
                  if (tip) tip.style.opacity = "1";
                }}
                onMouseLeave={(e) => {
                  const tip = e.currentTarget.querySelector(
                    ".sum-menu-tooltip"
                  ) as HTMLElement | null;
                  if (tip) tip.style.opacity = "0";
                }}
              >
                <button
                  type="button"
                  onClick={() => void fetchGlobalExplanation(true)}
                  disabled={explanationStatus === "loading" || visiblePaths.size === 0}
                  aria-label="Refresh verbalization to match visible paths"
                  style={{
                    ...styles.refreshButton,
                    opacity: explanationStatus === "loading" || visiblePaths.size === 0 ? 0.75 : 1,
                    cursor:
                      explanationStatus === "loading"
                        ? "wait"
                        : visiblePaths.size === 0
                          ? "not-allowed"
                          : "pointer",
                  }}
                >
                  <RefreshCw
                    size={14}
                    style={{
                      animation:
                        explanationStatus === "loading"
                          ? "sum-menu-spin 0.9s linear infinite"
                          : "none",
                    }}
                  />
                  {explanationStatus === "loading"
                    ? "Refreshing..."
                    : "New Verbalization"}
                </button>
                <span
                  className="sum-menu-tooltip"
                  style={{
                    position: "absolute",
                    bottom: "110%",
                    left: "50%",
                    transform: "translateX(-50%)",
                    backgroundColor: "#333",
                    color: "#fff",
                    padding: "3px 8px",
                    borderRadius: 4,
                    fontSize: 11,
                    whiteSpace: "nowrap",
                    zIndex: 200,
                    pointerEvents: "none",
                    opacity: 0,
                    transition: "opacity 0.15s",
                  }}
                >
                  Refresh to match the visible paths
                </span>
              </div>
            </div>
          )}
        </>
      )}
      <style jsx>{`
        @keyframes sum-menu-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </aside>
  );
}
