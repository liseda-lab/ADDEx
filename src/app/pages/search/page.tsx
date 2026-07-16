"use client";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import SideMenu from "../../components/pairSideMenu/PairSideMenu";
import GraphVisualizer from "../../components/visualizer/graph/GraphVisualizer";
import { ExplanationSearchState, Pair } from "../../hooks/types";
import { useTheme, useThemeContext } from "../../../../styles/ThemeContext";
import SumSideMenu from "../../components/sumSideMenu/SumSideMenu";
import Navbar from "../../components/general/Navbar";
import EntityAvailabilityLauncher from "../guide/EntityAvailabilityLauncher";
import ExamplePairCards, {
  EXAMPLE_PAIRS,
  type ExamplePair,
} from "../../components/general/ExamplePairCards";

// Fixed, hand-picked examples shown once the user has chosen a dataset + task
// (keyed by `${dataset}_${task}`). Every pair is pre-computed — paths cached in
// all three personas so it loads instantly under any persona — and each combo's
// first entry is the paper case study. Names/types match the graph labels
// exactly (verified against the cached pairs). Note OREGANO names follow the
// source data's casing (e.g. lowercase "warfarin").
const DATASET_EXAMPLES: Record<string, ExamplePair[]> = {
  hetionet_drug_repurposing: [
    { dataset: "hetionet", task: "drug_repurposing", taskLabel: "Drug Repurposing", sourceType: "Compound", sourceName: "Budesonide", targetType: "Disease", targetName: "Asthma" },
    { dataset: "hetionet", task: "drug_repurposing", taskLabel: "Drug Repurposing", sourceType: "Compound", sourceName: "Methotrexate", targetType: "Disease", targetName: "Systemic Lupus Erythematosus" },
    { dataset: "hetionet", task: "drug_repurposing", taskLabel: "Drug Repurposing", sourceType: "Compound", sourceName: "Phentermine", targetType: "Disease", targetName: "Obesity" },
  ],
  hetionet_drug_target: [
    { dataset: "hetionet", task: "drug_target", taskLabel: "Drug-Target Interaction", sourceType: "Compound", sourceName: "Apomorphine", targetType: "Gene", targetName: "Drd2" },
    { dataset: "hetionet", task: "drug_target", taskLabel: "Drug-Target Interaction", sourceType: "Compound", sourceName: "Acetaminophen", targetType: "Gene", targetName: "Abcb1" },
    { dataset: "hetionet", task: "drug_target", taskLabel: "Drug-Target Interaction", sourceType: "Compound", sourceName: "Fluticasone Propionate", targetType: "Gene", targetName: "Cyp3a4" },
  ],
  primekg_drug_repurposing: [
    { dataset: "primekg", task: "drug_repurposing", taskLabel: "Drug Repurposing", sourceType: "Drug", sourceName: "Famotidine", targetType: "Disease", targetName: "Peptic Esophagitis" },
    { dataset: "primekg", task: "drug_repurposing", taskLabel: "Drug Repurposing", sourceType: "Drug", sourceName: "Lindane", targetType: "Disease", targetName: "Scabies" },
    { dataset: "primekg", task: "drug_repurposing", taskLabel: "Drug Repurposing", sourceType: "Drug", sourceName: "Mianserin", targetType: "Disease", targetName: "Endogenous Depression" },
  ],
  oregano_drug_repurposing: [
    { dataset: "oregano", task: "drug_repurposing", taskLabel: "Drug Repurposing", sourceType: "Compound", sourceName: "warfarin", targetType: "Disease", targetName: "Ataxia" },
    { dataset: "oregano", task: "drug_repurposing", taskLabel: "Drug Repurposing", sourceType: "Compound", sourceName: "ethambutol", targetType: "Disease", targetName: "Tremor" },
    { dataset: "oregano", task: "drug_repurposing", taskLabel: "Drug Repurposing", sourceType: "Compound", sourceName: "escitalopram", targetType: "Disease", targetName: "Denture stomatitis" },
  ],
  oregano_drug_target: [
    { dataset: "oregano", task: "drug_target", taskLabel: "Drug-Target Interaction", sourceType: "Compound", sourceName: "Apomorphine", targetType: "Protein", targetName: "Dopamine D4 receptor" },
    { dataset: "oregano", task: "drug_target", taskLabel: "Drug-Target Interaction", sourceType: "Compound", sourceName: "etoposide", targetType: "Protein", targetName: "Ca-Ski" },
    { dataset: "oregano", task: "drug_target", taskLabel: "Drug-Target Interaction", sourceType: "Compound", sourceName: "Latrunculin A", targetType: "Protein", targetName: "Tankyrase-2" },
  ],
};

// Display helper: capitalize just the first letter for the card label. The
// underlying sourceName/targetName stay verbatim so they still resolve against
// the (case-sensitive) graph labels — OREGANO stores some names lowercase.
export default function SearchPage() {
  const colors = useTheme();
  const { theme } = useThemeContext();
  const searchParams = useSearchParams();
  const hasPersona = !!searchParams.get("persona");
  const hasDataset = !!searchParams.get("dataset");
  const hasTask = !!searchParams.get("task");
  const contextReady = hasPersona && hasDataset && hasTask;

  // Example links arrive with `autorun=1` and fire the search once the source
  // and target resolve from the URL, which needs the labels to load first. Until
  // then the empty state would flash its prompt and example cards, which is
  // jarring when the user has already committed to an example. PairSideMenu
  // strips the flag as soon as it fires, so this only covers the resolve window.
  const autorunPending = !!searchParams.get("autorun");

  // Show dataset-specific examples once a dataset + task are chosen; otherwise
  // (landing / Quick Search) show the cross-dataset paper examples.
  const exampleDataset = searchParams.get("dataset");
  const exampleTask = searchParams.get("task");
  const exampleSet: ExamplePair[] =
    exampleDataset && exampleTask
      ? DATASET_EXAMPLES[`${exampleDataset}_${exampleTask}`] ?? EXAMPLE_PAIRS
      : EXAMPLE_PAIRS;

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

      // LCAs are shown by default. The pre-computed verbalizations are produced
      // offline with the LCA context and name those ontology classes directly
      // (e.g. "all involving 20-Oxo Steroids"), so hiding the nodes left the
      // summary describing entities that were absent from the graph. Showing
      // them also keeps first-time (on-demand) verbalizations consistent with
      // pre-computed ones, since the request body sends the visible LCAs.
      // Mirrors the `allLcaNames` memo below; computed inline to keep this
      // effect dependent only on `selectedPair`.
      const lcaNames = new Set<string>();
      selectedPair.paths.forEach((path) => {
        if (!path.lowest_common_ancestors) return;
        Object.values(path.lowest_common_ancestors).forEach((lcaList) => {
          const arr = Array.isArray(lcaList) ? lcaList : [lcaList];
          arr.forEach((lca) => {
            if (lca) lcaNames.add(lca);
          });
        });
      });
      setVisibleLCAs(lcaNames);
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

  const togglePath = useCallback((pathId: string) => {
    setVisiblePaths((prev) => {
      const copy = new Set(prev);
      if (copy.has(pathId)) copy.delete(pathId);
      else copy.add(pathId);
      return copy;
    });
    // Adding a path does not auto-reveal that path's LCAs; LCA visibility is
    // controlled independently via the toolbar's Show/Hide LCAs toggle and the
    // per-LCA checkboxes. LCAs for the pair are shown by default on load.
  }, []);

  const toggleLCA = useCallback((lcaName: string) => {
    setVisibleLCAs((prev) => {
      const copy = new Set(prev);
      if (copy.has(lcaName)) copy.delete(lcaName);
      else copy.add(lcaName);
      return copy;
    });
  }, []);

  // Every LCA name available for the current pair (across all paths). Drives
  // the toolbar's bulk Show/Hide toggle and whether that control is shown.
  const allLcaNames = useMemo(() => {
    const names = new Set<string>();
    selectedPair?.paths.forEach((path) => {
      if (!path.lowest_common_ancestors) return;
      Object.values(path.lowest_common_ancestors).forEach((lcaList) => {
        const arr = Array.isArray(lcaList) ? lcaList : [lcaList];
        arr.forEach((lca) => {
          if (lca) names.add(lca);
        });
      });
    });
    return names;
  }, [selectedPair]);

  // Bulk toggle for the graph toolbar: if any LCAs are showing, hide them all;
  // otherwise reveal every LCA for the pair. Per-LCA checkboxes still work.
  const toggleAllLCAs = useCallback(() => {
    setVisibleLCAs((prev) =>
      prev.size > 0 ? new Set<string>() : new Set(allLcaNames)
    );
  }, [allLcaNames]);

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
          {/* Entity lookup sits in the top-right corner as a dropdown, away from
              the example cards: it is a reference/fact-check tool, not a step in
              the search flow, and placing it inline read like a third option for
              picking an entity. Kept in normal flow (rather than positioned over
              the graph panel) so it never overlaps the visualization toolbar. */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: "0.25rem",
            }}
          >
            <EntityAvailabilityLauncher dropdown iconOnly />
          </div>

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
                    Generating explanation
                  </h2>
                  <p style={{ margin: 0, lineHeight: 1.7, color: `${colors.white}cc` }}>
                    {searchState.message ??
                      "This is the first time someone is exploring this hypothesis, it may take a few minutes."}
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
                        "REx could not generate an explanation for this hypothesis.";
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
                    })() : autorunPending ? (
                      <p
                        style={{
                          margin: 0,
                          color: `${colors.white}cc`,
                          lineHeight: 1.7,
                        }}
                      >
                        Loading example...
                      </p>
                    ) : (
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

                        <ExamplePairCards examples={exampleSet} />

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
                    hasLcas={allLcaNames.size > 0}
                    lcasShown={visibleLCAs.size > 0}
                    onToggleLCAs={toggleAllLCAs}
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
