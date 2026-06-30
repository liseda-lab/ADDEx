"use client";

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import cytoscape, { Core, LayoutOptions, NodeSingular } from "cytoscape";
import { Pair, Path } from "@/app/hooks/types";
import GraphMenu from "./GraphMenu";
import NodeLegend from "../legend/NodeLegend";
import graphStyles from "@/app/hooks/graphStyles";
import { useColors } from "../../../../../styles/useColors";
import { normalizeNodeType } from "../../../../../styles/typeKey";
import { Rnd } from "react-rnd";
import ColorPicker from "../legend/ColorPicker";
import { exportGraphWithLegend, exportGraphAsSVG } from "@/app/hooks/exportPNG";
import ExportPreviewModal from "../../imgExport/ExportPreviewModal";
import { getGraphSettings } from "@/app/hooks/graphSettings";
import { runClusterLayoutByType } from "@/app/hooks/clusterLayout";

let cytoscapeSvgRegistered = false;
async function ensureCytoscapeSvgRegistered() {
  if (cytoscapeSvgRegistered) return;
  // @ts-expect-error cytoscape-svg has no bundled types
  const mod = await import("cytoscape-svg");
  cytoscape.use(mod.default ?? mod);
  cytoscapeSvgRegistered = true;
}

const LEGEND_W = 220;
const LEGEND_H = 120;
const MARGIN = 12;

// Fit the graph into the viewport, but if any node would render underneath the
// floating legend, reserve a strip on the legend's side and re-fit so nodes
// never sit beneath it. (The export already avoids overlap by compositing the
// legend onto its own canvas; this brings the live view in line.) When nothing
// overlaps the legend — typically with only a few paths — this behaves exactly
// like a normal centered fit, so sparse graphs are unaffected.
function fitAvoidingLegend(
  cy: Core,
  legend: { x: number; y: number; w: number; h: number }
) {
  cy.fit(cy.elements(), MARGIN);

  const nodes = cy.nodes();
  if (nodes.empty()) return;

  const legendX2 = legend.x + legend.w;
  const legendY2 = legend.y + legend.h;
  const overlaps = nodes.toArray().some((n) => {
    const b = n.renderedBoundingBox();
    return (
      b.x1 < legendX2 && b.x2 > legend.x && b.y1 < legendY2 && b.y2 > legend.y
    );
  });
  if (!overlaps) return;

  const bb = cy.elements().boundingBox();
  if (bb.w === 0 || bb.h === 0) return;

  const viewW = cy.width();
  const viewH = cy.height();
  const legendOnLeft = legend.x + legend.w / 2 < viewW / 2;
  const reserve = legend.w + 2 * MARGIN;
  const availW = Math.max(50, viewW - reserve - MARGIN);
  const availH = Math.max(50, viewH - 2 * MARGIN);

  const zoom = Math.min(availW / bb.w, availH / bb.h);
  cy.zoom(zoom);
  const originX = legendOnLeft ? reserve : MARGIN;
  cy.pan({
    x: originX + (availW - bb.w * zoom) / 2 - bb.x1 * zoom,
    y: MARGIN + (availH - bb.h * zoom) / 2 - bb.y1 * zoom,
  });
}

interface GraphVisualizerProps {
  pair: Pair;
  visiblePaths: Set<string>;
  visibleLCAs: Set<string>;
  // Bulk LCA visibility control surfaced in the graph toolbar. `hasLcas` gates
  // whether the toggle is shown; `lcasShown` drives its label/icon.
  hasLcas?: boolean;
  lcasShown?: boolean;
  onToggleLCAs?: () => void;
  isVisible?: boolean;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  hoveredPathId: string | null;
  hoveredLcaName: string | null;
  hoveredNodeId?: string | null;
  onNodeHover?: (nodeId: string | null) => void;
}

export default function GraphVisualizer({
  pair,
  visiblePaths,
  visibleLCAs,
  hasLcas = false,
  lcasShown = false,
  onToggleLCAs,
  isVisible = true,
  leftCollapsed,
  rightCollapsed,
  hoveredPathId,
  hoveredLcaName,
  hoveredNodeId = null,
  onNodeHover,
}: GraphVisualizerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const legendRef = useRef<HTMLDivElement>(null);
  const graphVisualizerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  const {
    nodeTypeColors,
    getColorForType,
    updateColor,
    resetColors,
    ensureColors,
    paletteOverride,
    setPaletteOverride,
  } = useColors();

  const [loading, setLoading] = useState(true);
  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(null);
  const [previewCanvasNoLegend, setPreviewCanvasNoLegend] =
    useState<HTMLCanvasElement | null>(null);
  const [previewSvg, setPreviewSvg] = useState<string | null>(null);
  const [previewSvgNoLegend, setPreviewSvgNoLegend] = useState<string | null>(null);
  const [legendPos, setLegendPos] = useState<{ x: number; y: number } | null>(null);
  // Start at a snug fixed width so "Lowest Common Ancestor" naturally wraps
  // onto a second line, then height auto-fits. Once the user drags a resize
  // handle, both flip to concrete pixel numbers.
  const [legendSize, setLegendSize] = useState<{
    width: number | "auto";
    height: number | "auto";
  }>({ width: 175, height: "auto" });
  const [isLegendColumnLayout, setIsLegendColumnLayout] = useState(true);

  // The Rnd's explicit width drives whether row-mode actually flows
  // horizontally: at 175px the items wrap one-per-line, so row mode would
  // look identical to column. Snap width to "auto" on row toggle so the
  // legend grows to fit content; restore the snug column default on toggle
  // back.
  const handleToggleLegendLayout = useCallback(() => {
    setIsLegendColumnLayout((prev) => {
      const next = !prev;
      setLegendSize(
        next ? { width: 175, height: "auto" } : { width: "auto", height: "auto" }
      );
      return next;
    });
  }, []);
  const [activeColorPicker, setActiveColorPicker] =
    useState<{ type: string; position: { x: number; y: number } } | null>(null);
  const menuCenterRef = useRef<(() => void) | null>(null);
  const hasInitialCenteringRun = useRef(false);
  const onNodeHoverRef = useRef(onNodeHover);
  useEffect(() => {
    onNodeHoverRef.current = onNodeHover;
  }, [onNodeHover]);

  // Current legend rectangle (viewport px), kept in a ref so the fit helper can
  // read it without stale closures. Width/height fall back to estimates while
  // the legend is auto-sized.
  const legendRectRef = useRef<{ x: number; y: number; w: number; h: number }>({
    x: MARGIN,
    y: MARGIN,
    w: 200,
    h: 170,
  });
  useEffect(() => {
    legendRectRef.current = {
      x: legendPos?.x ?? MARGIN,
      y: legendPos?.y ?? MARGIN,
      w: typeof legendSize.width === "number" ? legendSize.width : 200,
      h: typeof legendSize.height === "number" ? legendSize.height : 170,
    };
  }, [legendPos, legendSize]);

  // --- Prepare graph elements ---
  const elements = useMemo(() => {
  const elems: cytoscape.ElementDefinition[] = [];
  const addedNodes = new Set<string>();
  const addedEdges = new Set<string>();

  const addNode = (
    id: string,
    label: string,
    type: string,
    connectedNE?: string[]
  ) => {
    if (!addedNodes.has(id)) {
      elems.push({ data: { id, label, type, connectedNE } });
      addedNodes.add(id);
    }
  };

  const addEdge = (
    source: string,
    target: string,
    label: string,
    type?: string,
    style?: any
  ) => {
    const key = `${source}-${target}-${label}`;
    if (!addedEdges.has(key)) {
      elems.push({
        data: { id: key, source, target, label, type: type || "NE" },
        style,
      });
      addedEdges.add(key);
    }
  };

  pair.paths.forEach((path: Path) => {
    if (!visiblePaths.has(path.id)) return;

    // --- Normal nodes and edges ---
    path.nodes.forEach((n) => addNode(n.id, n.id, n.type));

    path.edges.forEach((e) =>
      addEdge(e.source, e.target, e.label, e.type, {
        "target-arrow-shape": "triangle",
        "line-style": "solid",
      })
    );

    // --- LCA handling ---
    if (path.lowest_common_ancestors) {
      Object.entries(path.lowest_common_ancestors).forEach(
        ([key, lcaList]) => {
          const sourceNodes = key.split(",");

          const lcas = Array.isArray(lcaList)
            ? lcaList
            : [lcaList].filter(Boolean);

          lcas.forEach((lcaName: string) => {
            // respect toggle
            if (!visibleLCAs.has(lcaName)) return;

            // Add LCA node
            addNode(lcaName, lcaName, "LCA", sourceNodes);

            // Connect sources to LCA
            sourceNodes.forEach((source) => {
              addEdge(source, lcaName, "is_a", "LCA", {
                "line-style": "dashed",
                "target-arrow-shape": "triangle",
              });
            });
          });
        }
      );
    }
  });

  return elems;
}, [pair, visiblePaths, visibleLCAs]);

  // Maps each visible node to the index of the first visible path that
  // contains it (Path 1 → 0, Path 2 → 1, …). Used by the breadthfirst layout's
  // `depthSort` so paths stack top-to-bottom in the same order as the Paths
  // panel, instead of whatever order the layout picks on its own.
  const nodeOrder = useMemo(() => {
    const order = new Map<string, number>();
    pair.paths.forEach((path: Path, idx: number) => {
      if (!visiblePaths.has(path.id)) return;
      const assign = (id: string) => {
        if (!order.has(id)) order.set(id, idx);
      };
      path.nodes.forEach((n) => assign(n.id));
      if (path.lowest_common_ancestors) {
        Object.values(path.lowest_common_ancestors).forEach((lcaList) => {
          const arr = Array.isArray(lcaList)
            ? lcaList
            : [lcaList].filter(Boolean);
          arr.forEach((lcaName) => {
            if (lcaName) assign(lcaName as string);
          });
        });
      }
    });
    return order;
  }, [pair, visiblePaths]);

  // --- Initialize Cytoscape ---
  const initGraph = useCallback(() => {
    if (!containerRef.current) return;
    setLoading(true);
    // Re-run centering on every graph rebuild (new pair, reload, etc.).
    hasInitialCenteringRun.current = false;

    if (cyRef.current) cyRef.current.destroy();

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: graphStyles(nodeTypeColors, elements),
    });

    cyRef.current = cy;

    cy.on("layoutstop", () => {
      if (!hasInitialCenteringRun.current) {
        fitAvoidingLegend(cy, legendRectRef.current);
        hasInitialCenteringRun.current = true;
      }
      setLoading(false);
    });

    cy.on("mouseover", "node", (event) => {
      const id = event.target.id() as string;
      onNodeHoverRef.current?.(id);
    });

    cy.on("mouseout", "node", () => {
      onNodeHoverRef.current?.(null);
    });

    const savedLayout = getGraphSettings().layoutName ?? "breadthfirst";
    if (savedLayout === "cluster" || savedLayout === "cose") {
      runClusterLayoutByType(cy);
      return;
    }

    const layout: LayoutOptions =
      savedLayout === "hierarchical"
        ? {
            name: "breadthfirst",
            directed: false,
            // `roots` takes node IDs (string[]), not a node collection — map the
            // matched LCA nodes to their ids so it's both type-correct and what
            // the layout consumes at runtime.
            roots: cy
              .nodes()
              .filter((node) => String(node.data("type")) === "LCA")
              .map((node) => node.id()),
            spacingFactor: 1,
            avoidOverlap: true,
            animate: true,
            direction: "downward",
          }
        : savedLayout === "hierarchicalClassic"
        ? {
            name: "breadthfirst",
            directed: true,
            spacingFactor: 1,
            avoidOverlap: true,
            animate: true,
            direction: "downward",
          }
        : savedLayout === "breadthfirst"
        ? {
            name: "breadthfirst",
            directed: true,
            spacingFactor: 1,
            avoidOverlap: true,
            animate: true,
            direction: "rightward",
            // Stack paths top-to-bottom in Paths-panel order (Path 1 on top).
            // For this rightward layout Cytoscape places the first-sorted node
            // at the bottom of each column, so sort by path index DESCENDING
            // (highest index first → bottom) to put Path 1 on top.
            depthSort: (a: NodeSingular, b: NodeSingular) =>
              (nodeOrder.get(b.id()) ?? 0) - (nodeOrder.get(a.id()) ?? 0),
          }
        : savedLayout === "circle"
            ? {
                name: "circle",
                animate: true,
                fit: true,
                padding: 24,
              }
            : savedLayout === "concentric"
              ? {
                  name: "concentric",
                  animate: true,
                  fit: true,
                  padding: 24,
                }
              : {
                  name: "grid",
                  avoidOverlap: true,
                  avoidOverlapPadding: 40,
                  spacingFactor: 1.5,
                  condense: false,
                  animate: true,
                  fit: true,
                  padding: 24,
                };

    cy.layout(layout).run();
  }, [elements, nodeOrder]);

  useEffect(() => {
    ensureColors(elements.map(el => el.data.type));
    initGraph();
  }, [elements, initGraph, ensureColors]);

  // Apply node/edge color updates without rebuilding Cytoscape so user-moved
  // node positions are preserved.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.style(graphStyles(nodeTypeColors, elements));
  }, [nodeTypeColors, elements]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.batch(() => {
      cy.elements().removeClass("path-dim path-highlight");

      if (hoveredPathId) {
        const hoveredPath = pair.paths.find((path) => path.id === hoveredPathId);
        if (!hoveredPath) return;

        const nodeIds = new Set(hoveredPath.nodes.map((node) => node.id));
        const edgeIds = new Set(
          hoveredPath.edges.map((edge) => `${edge.source}-${edge.target}-${edge.label}`)
        );

        cy.elements().addClass("path-dim");

        nodeIds.forEach((id) => {
          const node = cy.getElementById(id);
          if (node.nonempty()) {
            node.removeClass("path-dim").addClass("path-highlight");
          }
        });

        edgeIds.forEach((id) => {
          const edge = cy.getElementById(id);
          if (edge.nonempty()) {
            edge.removeClass("path-dim").addClass("path-highlight");
          }
        });

        return;
      }

      if (hoveredNodeId) {
        const hoveredNode = cy.getElementById(hoveredNodeId);
        const hoveredNodeType = hoveredNode.nonempty()
          ? String(hoveredNode.data("type") || "")
          : "";

        if (hoveredNodeType === "LCA") {
          cy.elements().addClass("path-dim");
          hoveredNode.removeClass("path-dim").addClass("path-highlight");

          hoveredNode.connectedEdges().forEach((edge) => {
            if (String(edge.data("type") || "") !== "LCA") return;
            edge.removeClass("path-dim").addClass("path-highlight");
            const otherEnd =
              edge.source().id() === hoveredNodeId ? edge.target() : edge.source();
            otherEnd.removeClass("path-dim").addClass("path-highlight");
          });

          return;
        }

        const matchingPaths = pair.paths.filter(
          (path) =>
            visiblePaths.has(path.id) &&
            path.nodes.some((node) => node.id === hoveredNodeId)
        );

        if (matchingPaths.length === 0) return;

        const nodeIds = new Set<string>();
        const edgeIds = new Set<string>();

        matchingPaths.forEach((path) => {
          path.nodes.forEach((node) => nodeIds.add(node.id));
          path.edges.forEach((edge) =>
            edgeIds.add(`${edge.source}-${edge.target}-${edge.label}`)
          );
        });

        cy.elements().addClass("path-dim");

        nodeIds.forEach((id) => {
          const node = cy.getElementById(id);
          if (node.nonempty()) {
            node.removeClass("path-dim").addClass("path-highlight");
          }
        });

        edgeIds.forEach((id) => {
          const edge = cy.getElementById(id);
          if (edge.nonempty()) {
            edge.removeClass("path-dim").addClass("path-highlight");
          }
        });

        return;
      }

      if (!hoveredLcaName) return;

      const sourceIds = new Set<string>();
      pair.paths.forEach((path) => {
        Object.entries(path.lowest_common_ancestors ?? {}).forEach(
          ([key, lcaList]) => {
            const lcaArray = Array.isArray(lcaList) ? lcaList : [lcaList];
            if (!lcaArray.includes(hoveredLcaName)) return;

            key.split(",").forEach((source) => sourceIds.add(source));
          }
        );
      });

      cy.elements().addClass("path-dim");

      const lcaNode = cy.getElementById(hoveredLcaName);
      if (lcaNode.nonempty()) {
        lcaNode.removeClass("path-dim").addClass("path-highlight");
      }

      sourceIds.forEach((id) => {
        const node = cy.getElementById(id);
        if (node.nonempty()) {
          node.removeClass("path-dim").addClass("path-highlight");
        }

        const edge = cy.getElementById(`${id}-${hoveredLcaName}-is_a`);
        if (edge.nonempty()) {
          edge.removeClass("path-dim").addClass("path-highlight");
        }
      });
    });
  }, [hoveredPathId, hoveredLcaName, hoveredNodeId, visiblePaths, pair.paths, elements]);

  // --- Resize Cytoscape on panel collapse ---
  useEffect(() => {
    if (!cyRef.current) return;
    const timeout = setTimeout(() => {
      cyRef.current!.resize();
      fitAvoidingLegend(cyRef.current!, legendRectRef.current);
    }, 220);
    return () => clearTimeout(timeout);
  }, [leftCollapsed, rightCollapsed]);

  // When the graph panel is re-opened after being collapsed/hidden, force a
  // resize + fit + center once the width transition settles.
  useEffect(() => {
    if (!isVisible || !cyRef.current) return;
    const timeout = setTimeout(() => {
      const cy = cyRef.current;
      if (!cy) return;
      cy.resize();
      fitAvoidingLegend(cy, legendRectRef.current);
    }, 280);
    return () => clearTimeout(timeout);
  }, [isVisible]);

  // --- Initialize legend position after canvas mounts ---
  useEffect(() => {
    if (!legendPos && containerRef.current) {
      setLegendPos({ x: MARGIN, y: MARGIN });
    }
  }, [containerRef.current]);

  // --- Export ---
  const handleExport = async () => {
    if (!cyRef.current || !pair || !graphVisualizerRef.current || !legendRef.current) return;

    setLoading(true);
    try {
      const legendRect = {
        x: legendPos?.x ?? 0,
        y: legendPos?.y ?? 0,
        width: LEGEND_W,
        height: LEGEND_H,
      };
      const [canvas, canvasNoLegend] = await Promise.all([
        exportGraphWithLegend(
          cyRef.current,
          pair,
          graphVisualizerRef.current,
          legendRef.current,
          legendRect,
          true
        ),
        exportGraphWithLegend(
          cyRef.current,
          pair,
          graphVisualizerRef.current,
          null,
          null,
          true
        ),
      ]);
      if (!canvas || !canvasNoLegend) throw new Error("Failed to generate preview!");
      setPreviewCanvas(canvas);
      setPreviewCanvasNoLegend(canvasNoLegend);

      try {
        await ensureCytoscapeSvgRegistered();
        const svgString = exportGraphAsSVG(
          cyRef.current,
          legendRef.current,
          legendRect
        );
        const svgStringNoLegend = exportGraphAsSVG(cyRef.current, null, null);
        setPreviewSvg(svgString);
        setPreviewSvgNoLegend(svgStringNoLegend);
      } catch (svgErr) {
        console.warn("SVG export unavailable:", svgErr);
        setPreviewSvg(null);
        setPreviewSvgNoLegend(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const activeTypes = useMemo(() => {
    const nodeTypes = elements
      .filter(el => !("source" in el.data))
      .map(el => (el.data as any).type)
      .filter(Boolean);

    const normalizedToLabel = new Map<string, string>();
    nodeTypes.forEach((type) => {
      const normalized = normalizeNodeType(type);
      if (!normalized || normalizedToLabel.has(normalized)) return;
      normalizedToLabel.set(normalized, type);
    });

    return Array.from(normalizedToLabel.values());
  }, [elements]);

  return (
    <div
      ref={graphVisualizerRef}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "580px",
        border: "1px solid #ccc",
        borderRadius: 6,
        backgroundColor: "#fafafa",
        overflow: "hidden",
      }}
    >
      {/* Menu stays above graph */}
      <GraphMenu
        ref={menuCenterRef}
        cy={cyRef.current}
        onReload={initGraph}
        pair={pair}
        hasLcas={hasLcas}
        lcasShown={lcasShown}
        onToggleLCAs={onToggleLCAs}
        onExport={handleExport}
        paletteOverride={paletteOverride}
        setPaletteOverride={setPaletteOverride}
        resetColors={() => {
          resetColors();
          initGraph();
        }}
      />

      {/* Graph + Legend container */}
      <div style={{ position: "relative", flex: 1, minHeight: "300px" }}>
        <div
          ref={containerRef}
          style={{
            width: "100%",
            height: "100%",
            position: "relative", // crucial for legend absolute positioning
            backgroundColor: "#fff",
            borderRadius: 6,
          }}
        />

        {/* Draggable Legend */}
        {legendPos !== null && containerRef.current && (
          <Rnd
            size={legendSize}
            position={legendPos}
            bounds={containerRef.current} // restrict movement inside canvas
            onDragStop={(_, d) => setLegendPos({ x: d.x, y: d.y })}
            onResizeStop={(_, __, ref, ___, pos) => {
              setLegendSize({
                width: ref.offsetWidth,
                height: ref.offsetHeight,
              });
              setLegendPos({ x: pos.x, y: pos.y });
            }}
            minWidth={140}
            minHeight={80}
            style={{
              position: "absolute",
              zIndex: 20,
              background: "#fafafa",
              border: "1px solid #ccc",
              borderRadius: 6,
              padding: 4,
              display: "flex",
              flexDirection: "column",
              // No `overflow: auto` here — the legend's height is "auto" by
              // default, so it must be free to grow with wrapped content
              // (e.g. "Lowest Common Ancestor" on two lines). overflow:auto
              // would clip wrapped text in the export bbox.
            }}
            enableResizing={{
              bottom: true,
              bottomLeft: true,
              bottomRight: true,
              left: true,
              right: true,
              top: true,
              topLeft: true,
              topRight: true,
            }}
          >
            <div ref={legendRef}>
              <NodeLegend
                getColorForType={getColorForType}
                updateColor={updateColor}
                resetColors={resetColors}
                activeTypes={activeTypes}
                openColorPicker={(type, pos) =>
                  setActiveColorPicker({ type, position: pos })
                }
                isColumnLayout={isLegendColumnLayout}
                onToggleLayout={handleToggleLegendLayout}
              />
            </div>
          </Rnd>
        )}

        {/* Loading Overlay */}
        {loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "#ffffffaa",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
            }}
          >
            <div className="spinner" />
            <style jsx>{`
              .spinner {
                border: 6px solid #f3f3f3;
                border-top: 6px solid #3498db;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
              }
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}
      </div>

      {/* Active Color Picker */}
      {activeColorPicker && (
        <ColorPicker
          key={activeColorPicker.type}
          color={getColorForType(activeColorPicker.type)}
          position={activeColorPicker.position}
          onChange={c => updateColor(activeColorPicker.type, c)}
          onClose={() => setActiveColorPicker(null)}
        />
      )}

      {/* Preview Export Modal */}
      {previewCanvas && previewCanvasNoLegend && (
        <ExportPreviewModal
          canvas={previewCanvas}
          canvasNoLegend={previewCanvasNoLegend}
          svgString={previewSvg ?? undefined}
          svgStringNoLegend={previewSvgNoLegend ?? undefined}
          verbalization={pair.verbalization?.trim() || undefined}
          fileName={`${pair.source}_${pair.target}`}
          onClose={() => {
            setPreviewCanvas(null);
            setPreviewCanvasNoLegend(null);
            setPreviewSvg(null);
            setPreviewSvgNoLegend(null);
          }}
        />
      )}

      {loading && (
        <div style={{
          position: "absolute", top: 50, left: 0, width: "100%", height: "calc(100% - 50px)",
          backgroundColor: "#ffffffaa", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10
        }}>
          <div className="spinner" />
          <style jsx>{`
            .spinner { border: 6px solid #f3f3f3; border-top: 6px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          `}</style>
        </div>
      )}
    </div>
  );
}

