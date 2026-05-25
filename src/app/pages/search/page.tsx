"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import SideMenu from "../../components/pairSideMenu/PairSideMenu";
import GraphVisualizer from "../../components/visualizer/graph/GraphVisualizer";
import { ExplanationSearchState, Pair } from "../../hooks/types";
import { useTheme, useThemeContext } from "../../../../styles/ThemeContext";
import SumSideMenu from "../../components/sumSideMenu/SumSideMenu";
import Navbar from "../../components/general/Navbar";

// Curated example pairs drawn from the ADDEx paper case studies. Each one is
// known to have paths, so clicking → Search yields a result. Labels match the
// graph_labels.tsv entries exactly (verified). Dataset colors follow the
// semantic palette (purple/blue/green for Hetionet/Oregano/PrimeKG).
interface ExamplePair {
  dataset: "hetionet" | "oregano";
  task: "drug_repurposing" | "drug_target";
  taskLabel: string;
  sourceType: string;
  sourceName: string;
  targetType: string;
  targetName: string;
}
const EXAMPLE_PAIRS: ExamplePair[] = [
  {
    dataset: "hetionet",
    task: "drug_repurposing",
    taskLabel: "Drug Repurposing",
    sourceType: "Compound",
    sourceName: "Pravastatin",
    targetType: "Disease",
    targetName: "Atherosclerosis",
  },
  {
    dataset: "hetionet",
    task: "drug_target",
    taskLabel: "Drug-Target Interaction",
    sourceType: "Compound",
    sourceName: "Apomorphine",
    targetType: "Gene",
    targetName: "Drd2",
  },
  {
    dataset: "oregano",
    task: "drug_target",
    taskLabel: "Drug-Target Interaction",
    sourceType: "Compound",
    sourceName: "Apomorphine",
    targetType: "Protein",
    targetName: "Dopamine D4 receptor",
  },
];

export default function SearchPage() {
  const colors = useTheme();
  const { theme } = useThemeContext();
  const searchParams = useSearchParams();
  const hasPersona = !!searchParams.get("persona");
  const hasDataset = !!searchParams.get("dataset");
  const hasTask = !!searchParams.get("task");
  const contextReady = hasPersona && hasDataset && hasTask;

  // Error text uses the current persona's accent so the message lines up with
  // the symbol color in the left panel. Mirrors `personaAccentFor` in
  // PairSideMenu, keep the two in sync if either changes. When no persona is
  // picked yet (quick-search mode pre-selection), fall back to a saturated
  // green per theme so the line still reads as a notification.
  const personaId = searchParams.get("persona");
  const errorColor = !personaId
    ? (theme === "dark"
        ? colors.headingAccents[6]
        : theme === "light"
          ? colors.headingAccents[9]
          : colors.firstColor)
    : theme === "legacy"
      ? personaId === "mechanistic_analyst"
        ? colors.green
        : colors.firstColor
      : personaId === "mechanistic_analyst"
        ? colors.headingAccents[3]
        : personaId === "insight_driven"
          ? colors.headingAccents[0]
          : colors.headingAccents[6];
  const [selectedPair, setSelectedPair] = useState<Pair | null>(null);
  const [showSummaryMenu, setShowSummaryMenu] = useState(false);
  const [showGraphComponent, setShowGraphComponent] = useState(true);
  const [hasSearchedExplanation, setHasSearchedExplanation] = useState(false);
  const [searchState, setSearchState] = useState<ExplanationSearchState>({
    status: "idle",
  });

  const [visiblePaths, setVisiblePaths] = useState<Set<string>>(new Set());
  const [visibleLCAs, setVisibleLCAs] = useState<Set<string>>(new Set());
  const [hoveredPathId, setHoveredPathId] = useState<string | null>(null);
  const [hoveredLcaName, setHoveredLcaName] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [graphCollapsed, setGraphCollapsed] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const cancelSearchRef = useRef<(() => Promise<void>) | null>(null);

  const handleRegisterCancel = useCallback(
    (fn: (() => Promise<void>) | null) => {
      cancelSearchRef.current = fn;
    },
    []
  );

  const handleCancelSearch = async () => {
    if (!cancelSearchRef.current || cancelling) return;
    setCancelling(true);
    try {
      await cancelSearchRef.current();
    } finally {
      setCancelling(false);
    }
  };

  const handleJobStateChange = useCallback((state: ExplanationSearchState) => {
    setSearchState(state);
    if (state.status === "checking" || state.status === "queued" || state.status === "running" || state.status === "failed") {
      setHasSearchedExplanation(true);
    }

    if (state.status === "queued" || state.status === "running") {
      setSelectedPair(null);
      setShowSummaryMenu(false);
    }
  }, []);

  const handleOutputModeChange = useCallback(
    ({ visualization, verbalization }: { visualization: boolean; verbalization: boolean }) => {
      setShowGraphComponent(visualization);
      setShowSummaryMenu(hasSearchedExplanation ? verbalization : false);
      if (visualization) {
        setGraphCollapsed(false);
      } else {
        setGraphCollapsed(true);
      }
      if (!verbalization) {
        setRightCollapsed(false);
      }
    },
    [hasSearchedExplanation]
  );

  // Reset the search session when the user re-enters via a fresh Quick Search
  // link (viaQuickSkip=true) — Next.js keeps the SearchPage mounted across
  // intra-route navigations, so without this effect a previously-loaded
  // result, the right summary panel, etc. would persist into the "new" search.
  // `sessionKey` is bumped each time and forwarded as `key` to the
  // PairSideMenu so its internal state (source/target/job/poll-timer) is
  // reset on remount — mirrors the "New Search → same page" button.
  //
  // Depend on the stringified searchParams so the effect reliably fires
  // whenever the URL changes (the ReadonlyURLSearchParams reference from
  // useSearchParams isn't always swapped in time to trigger the effect).
  const searchParamsStr = searchParams.toString();
  const [sessionKey, setSessionKey] = useState(0);
  useEffect(() => {
    if (searchParams.get("viaQuickSkip") !== "true") return;
    setSelectedPair(null);
    setSearchState({ status: "idle" });
    setVisiblePaths(new Set());
    setVisibleLCAs(new Set());
    setHoveredPathId(null);
    setHoveredLcaName(null);
    setHoveredNodeId(null);
    setShowSummaryMenu(false);
    setShowGraphComponent(true);
    setHasSearchedExplanation(false);
    setLeftCollapsed(false);
    setRightCollapsed(false);
    setGraphCollapsed(false);
    setSessionKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParamsStr]);

  useEffect(() => {
    if (selectedPair) {
      setHoveredPathId(null);
      setHoveredLcaName(null);
      // Initialize only the first 3 paths as visible
      setVisiblePaths(new Set(selectedPair.paths.slice(0, 3).map((p) => p.id)));

      // Extract and initialize all LCAs as visible
      const lcaSet = new Set<string>();

      selectedPair.paths.forEach((path) => {
        if (!path.lowest_common_ancestors) return;

        Object.values(path.lowest_common_ancestors).forEach((lcaList) => {
          const arr = Array.isArray(lcaList) ? lcaList : [lcaList];
          arr.forEach((lca) => {
            if (lca) lcaSet.add(lca);
          });
        });
      });

      setVisibleLCAs(lcaSet);
    }
  }, [selectedPair]);

  // Layout invariant: never allow both graph and verbalization to be hidden.
  // If summary is closed while graph is collapsed, reopen the graph.
  useEffect(() => {
    if (!showSummaryMenu && graphCollapsed) {
      setGraphCollapsed(false);
    }
  }, [showSummaryMenu, graphCollapsed]);

  const handleSlideRight = useCallback(() => {
    // Right arrow -> verbalization-only.
    if (!showSummaryMenu) setShowSummaryMenu(true);
    setRightCollapsed(false);
    setGraphCollapsed(true);
  }, [showSummaryMenu]);

  const handleSlideLeft = useCallback(() => {
    // Left arrow sequence:
    // 1) If graph is hidden, bring it back (both visible).
    // 2) If graph is visible, toggle verbalization panel collapsed/expanded.
    // Verbalization is never fully hidden by this control.
    if (graphCollapsed) {
      setGraphCollapsed(false);
      if (!showSummaryMenu) setShowSummaryMenu(true);
      setRightCollapsed(false);
      return;
    }

    if (!showSummaryMenu) {
      setShowSummaryMenu(true);
      setRightCollapsed(false);
      return;
    }

    setRightCollapsed((prev) => !prev);
  }, [graphCollapsed, showSummaryMenu]);

  const togglePath = useCallback(
    (pathId: string) => {
      setVisiblePaths((prev) => {
        const copy = new Set(prev);
        const willBeVisible = !copy.has(pathId);
        if (willBeVisible) copy.add(pathId);
        else copy.delete(pathId);

        // When a path is newly added to the viz, auto-include its LCAs so
        // the graph shows the full context. Removing a path leaves LCAs
        // alone so other paths that share them aren't affected.
        if (willBeVisible && selectedPair) {
          const addedPath = selectedPair.paths.find((p) => p.id === pathId);
          if (addedPath?.lowest_common_ancestors) {
            const lcaNames = new Set<string>();
            Object.values(addedPath.lowest_common_ancestors).forEach(
              (lcaList) => {
                const arr = Array.isArray(lcaList) ? lcaList : [lcaList];
                arr.forEach((lca) => {
                  if (lca) lcaNames.add(lca);
                });
              }
            );
            if (lcaNames.size > 0) {
              setVisibleLCAs((prevLcas) => {
                const lcaCopy = new Set(prevLcas);
                lcaNames.forEach((name) => lcaCopy.add(name));
                return lcaCopy;
              });
            }
          }
        }

        return copy;
      });
    },
    [selectedPair]
  );

  const toggleLCA = useCallback((lcaName: string) => {
    setVisibleLCAs((prev) => {
      const copy = new Set(prev);
      if (copy.has(lcaName)) copy.delete(lcaName);
      else copy.add(lcaName);
      return copy;
    });
  }, []);

  const handlePathHover = useCallback((pathId: string | null) => {
    setHoveredPathId(pathId);
    if (pathId) {
      setHoveredLcaName(null);
      setHoveredNodeId(null);
    }
  }, []);

  const handleLcaHover = useCallback((lcaName: string | null) => {
    setHoveredLcaName(lcaName);
    if (lcaName) {
      setHoveredPathId(null);
      setHoveredNodeId(null);
    }
  }, []);

  const handleNodeHover = useCallback((nodeId: string | null) => {
    setHoveredNodeId(nodeId);
    if (nodeId) {
      setHoveredPathId(null);
      setHoveredLcaName(null);
    }
  }, []);

  const NAVBAR_HEIGHT = 60;
  const SIDEMENU_WIDTH = 270;
  const SIDEMENU_COLLAPSED_WIDTH = 60;
  const RIGHTMENU_WIDTH = 320;
  const RIGHTMENU_COLLAPSED_WIDTH = 60;

  return (
    <div
      style={{
        backgroundColor: colors.background,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Navbar />

      <div style={{ display: "flex", flex: 1 }}>
        {/* LEFT MENU */}
        <SideMenu
          key={`side-${sessionKey}`}
          onSelectFile={(_file: string) => {
            setSelectedPair(null);
            setShowSummaryMenu(false);
            setShowGraphComponent(true);
          }}
          onShowGraph={(pair: Pair, show = true) => {
            setSelectedPair(pair);
            setHasSearchedExplanation(true);
            setShowGraphComponent(show);
            setGraphCollapsed(!show);
          }}
          onSetPair={(pair: Pair) => setSelectedPair(pair)}
          onShowSummary={(show = true) => {
            setHasSearchedExplanation(true);
            setShowSummaryMenu(show);
          }}
          onOutputModeChange={handleOutputModeChange}
          onJobStateChange={handleJobStateChange}
          onRegisterCancel={handleRegisterCancel}
          collapsed={leftCollapsed}
          setCollapsed={setLeftCollapsed}
        />

        {/* RIGHT MENU */}
        {showSummaryMenu && hasSearchedExplanation && (
          <SumSideMenu
            collapsed={rightCollapsed}
            onSlideLeft={handleSlideRight}
            onSlideRight={handleSlideLeft}
            expanded={graphCollapsed}
            leftOffset={leftCollapsed ? SIDEMENU_COLLAPSED_WIDTH : SIDEMENU_WIDTH}
            pair={selectedPair}
            visiblePaths={visiblePaths}
            togglePath={togglePath}
            visibleLCAs={visibleLCAs}
            toggleLCA={toggleLCA}
            onPathHover={handlePathHover}
            onLcaHover={handleLcaHover}
            hoveredNodeId={hoveredNodeId}
            onVerbalizationGenerated={(verbalization) =>
              setSelectedPair((prev) =>
                prev ? { ...prev, verbalization } : prev
              )
            }
          />
        )}

        {/* MAIN CONTENT */}
        <main
          style={{
            flex: 1,
            marginTop: NAVBAR_HEIGHT,
            marginLeft: leftCollapsed
              ? SIDEMENU_COLLAPSED_WIDTH
              : SIDEMENU_WIDTH,
            marginRight: showSummaryMenu
              ? graphCollapsed
                ? 0
                : rightCollapsed
                ? RIGHTMENU_COLLAPSED_WIDTH
                : RIGHTMENU_WIDTH
              : 0,
            padding: "1.5rem",
            border: `1px solid ${colors.grayDark}40`,
            borderRadius: 12,
            backgroundColor: colors.background,
            overflowY: "auto",
            boxShadow: "0 4px 15px rgba(0,0,0,0.15)",
            minHeight: `calc(100vh - ${NAVBAR_HEIGHT}px)`,
            transition: "margin 0.2s ease",
          }}
        >

          {!selectedPair && (
            <div
              style={{
                minHeight: "60vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: "2rem",
              }}
            >
              {(searchState.status === "queued" ||
                searchState.status === "running") && (
                <div
                  style={{
                    maxWidth: 540,
                    width: "100%",
                    padding: "1.5rem",
                    borderRadius: 16,
                    border: `2px solid ${colors.firstColor}`,
                    backgroundColor: colors.card,
                    color: colors.white,
                    boxShadow: "0 18px 50px rgba(0,0,0,0.3)",
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      margin: "0 auto 1rem",
                      borderRadius: "50%",
                      border: `4px solid ${colors.firstColor}22`,
                      borderTopColor: colors.firstColor,
                      animation: "rex-run-spin 0.9s linear infinite",
                    }}
                  />
                  <style jsx>{`
                    @keyframes rex-run-spin {
                      from {
                        transform: rotate(0deg);
                      }
                      to {
                        transform: rotate(360deg);
                      }
                    }
                  `}</style>
                  <h2 style={{ fontSize: "1.15rem", marginBottom: "0.75rem", color: colors.white }}>
                    Running REx for this pair
                  </h2>
                  <p style={{ margin: 0, lineHeight: 1.7, color: `${colors.white}cc` }}>
                    {searchState.message ??
                      "This is the first time someone is running this pair, it may take a few minutes."}
                  </p>
                  <button
                    type="button"
                    onClick={handleCancelSearch}
                    disabled={cancelling}
                    style={{
                      marginTop: "1.25rem",
                      padding: "0.55rem 1.4rem",
                      borderRadius: 10,
                      border: "none",
                      backgroundColor: colors.buttons,
                      color: "#FFFFFF",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      cursor: cancelling ? "wait" : "pointer",
                      opacity: cancelling ? 0.7 : 1,
                    }}
                  >
                    {cancelling ? "Cancelling..." : "Cancel Search"}
                  </button>
                </div>
              )}

              {searchState.status !== "queued" &&
                searchState.status !== "running" && (
                  <div>
                    {searchState.status === "failed" ? (() => {
                      const raw =
                        searchState.message ??
                        "REx could not generate an explanation for this pair.";
                      // Split into the main error line (shown bold + accent)
                      // and any follow-up hint lines (shown plain, matching
                      // the empty-state prompt style).
                      const [primary, ...rest] = raw.split("\n");
                      const hint = rest.join(" ").trim();
                      return (
                        <div>
                          <p
                            style={{
                              color: errorColor,
                              margin: 0,
                              fontWeight: 700,
                              lineHeight: 1.6,
                            }}
                          >
                            {primary}
                          </p>
                          {hint && (
                            <p style={{ marginTop: "0.35rem", marginBottom: 0 }}>
                              {hint}
                            </p>
                          )}
                        </div>
                      );
                    })() : (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "1.5rem",
                          width: "100%",
                          maxWidth: 780,
                        }}
                      >
                        <p style={{ margin: 0, color: `${colors.white}cc` }}>
                          {contextReady
                            ? "Please select a Source and a Target."
                            : hasPersona
                              ? "Choose a dataset and task in the left panel, or try one of the examples below."
                              : "Choose an explanation mode first, then select a dataset and task in the left panel."}
                        </p>

                        <div
                          style={{
                            width: "100%",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.75rem",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "0.78rem",
                              fontWeight: 600,
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              color: `${colors.white}88`,
                              textAlign: "left",
                            }}
                          >
                            Try an example
                          </div>
                          <div
                            style={{
                              display: "grid",
                              // 3 equal columns on any reasonable width; wrap
                              // to single column only when the viewport is
                              // narrow (≤640px). Fixed columns avoid the
                              // "Oregano drops to a new row" behavior that
                              // happened when auto-fit was near its breakpoint.
                              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                              gap: "0.75rem",
                            }}
                          >
                            {EXAMPLE_PAIRS.map((ex) => {
                              const accentIdx =
                                ex.dataset === "hetionet"
                                  ? 0
                                  : ex.dataset === "oregano"
                                    ? 3
                                    : 6;
                              const datasetAccent =
                                theme === "legacy"
                                  ? colors.firstColor
                                  : colors.headingAccents[accentIdx];
                              const isSelected =
                                searchParams.get("dataset") === ex.dataset &&
                                searchParams.get("task") === ex.task &&
                                searchParams.get("sourceName") === ex.sourceName &&
                                searchParams.get("targetName") === ex.targetName;
                              // Respect the user's current persona if they've
                              // already picked one (via wizard or previous
                              // visit). Fall back to Neutral only when the
                              // user arrived without selecting a persona.
                              const personaId = searchParams.get("persona") ?? "neutral_evaluator";
                              const personaName =
                                searchParams.get("personaName") ??
                                (personaId === "mechanistic_analyst"
                                  ? "Mechanistic Analyst"
                                  : personaId === "insight_driven"
                                    ? "Insight Driven"
                                    : "Neutral");
                              const personaIcon =
                                searchParams.get("icon") ??
                                (personaId === "mechanistic_analyst"
                                  ? "Gear"
                                  : personaId === "insight_driven"
                                    ? "ShareNetwork"
                                    : "Lightbulb");
                              const href = `/pages/search?persona=${personaId}&personaName=${encodeURIComponent(personaName)}&icon=${personaIcon}&dataset=${ex.dataset}&task=${ex.task}&sourceType=${encodeURIComponent(ex.sourceType)}&sourceName=${encodeURIComponent(ex.sourceName)}&targetType=${encodeURIComponent(ex.targetType)}&targetName=${encodeURIComponent(ex.targetName)}`;
                              return (
                                <Link
                                  key={`${ex.dataset}-${ex.task}-${ex.sourceName}-${ex.targetName}`}
                                  href={href}
                                  aria-current={isSelected ? "true" : undefined}
                                  style={{
                                    textAlign: "left",
                                    textDecoration: "none",
                                    padding: "0.85rem 1rem",
                                    borderRadius: 10,
                                    background: isSelected
                                      ? `${datasetAccent}33`
                                      : colors.card,
                                    border: `1px solid ${datasetAccent}${isSelected ? "" : "55"}`,
                                    borderLeft: `${isSelected ? "5px" : "3px"} solid ${datasetAccent}`,
                                    color: colors.white,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "0.3rem",
                                    transition:
                                      "transform 0.15s ease, border-color 0.15s ease, background 0.15s ease",
                                    boxShadow: isSelected
                                      ? `0 6px 18px ${datasetAccent}40`
                                      : undefined,
                                    transform: isSelected
                                      ? "translateY(-2px)"
                                      : undefined,
                                    opacity: isSelected ? 1 : 0.85,
                                  }}
                                  onMouseEnter={(e) => {
                                    if (isSelected) return;
                                    e.currentTarget.style.transform =
                                      "translateY(-2px)";
                                    e.currentTarget.style.borderColor = `${datasetAccent}AA`;
                                    e.currentTarget.style.opacity = "1";
                                  }}
                                  onMouseLeave={(e) => {
                                    if (isSelected) return;
                                    e.currentTarget.style.transform =
                                      "translateY(0)";
                                    e.currentTarget.style.borderColor = `${datasetAccent}55`;
                                    e.currentTarget.style.opacity = "0.85";
                                  }}
                                >
                                  <div
                                    style={{
                                      fontSize: "0.72rem",
                                      fontWeight: 600,
                                      color: datasetAccent,
                                      textTransform: "uppercase",
                                      letterSpacing: "0.05em",
                                    }}
                                  >
                                    {ex.dataset} · {ex.taskLabel}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: "0.95rem",
                                      fontWeight: 600,
                                      lineHeight: 1.3,
                                    }}
                                  >
                                    {ex.sourceName} → {ex.targetName}
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
            </div>
          )}

          {selectedPair && showGraphComponent && (
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "stretch",
              }}
            >
              <div
                style={{
                  width: graphCollapsed ? 18 : "100%",
                  minWidth: graphCollapsed ? 18 : 0,
                  overflow: "hidden",
                  border: graphCollapsed ? "1px solid #d6d6d6" : "none",
                  borderRadius: graphCollapsed ? 8 : 0,
                  backgroundColor: graphCollapsed ? "#ffffff" : "transparent",
                  transition: "width 0.25s ease",
                }}
              >
                <div
                  style={{
                    visibility: graphCollapsed ? "hidden" : "visible",
                    pointerEvents: graphCollapsed ? "none" : "auto",
                    transform: graphCollapsed ? "translateX(-12px)" : "translateX(0)",
                    opacity: graphCollapsed ? 0 : 1,
                    transition: "transform 0.25s ease, opacity 0.25s ease",
                  }}
                >
                  <GraphVisualizer
                    pair={selectedPair}
                    visiblePaths={visiblePaths}
                    visibleLCAs={visibleLCAs}
                    isVisible={!graphCollapsed}
                    leftCollapsed={leftCollapsed}
                    rightCollapsed={rightCollapsed}
                    hoveredPathId={hoveredPathId}
                    hoveredLcaName={hoveredLcaName}
                    hoveredNodeId={hoveredNodeId}
                    onNodeHover={handleNodeHover}
                  />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
