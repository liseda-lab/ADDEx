"use client";
import React, { useEffect, useMemo, useState } from "react";
import { Pair, Path } from "@/app/hooks/types";
import { useTheme, useThemeContext } from "../../../../styles/ThemeContext";

type LinkCategory = "compound" | "disease" | "gene";
type EntityLinkInfo = {
  url: string;
  source?: string;
  externalId?: string;
};

interface PathListProps {
  dataset: string;
  pair: Pair;
  visiblePaths: Set<string>;
  togglePath: (pathId: string) => void;
  visibleLCAs: Set<string>;
  toggleLCA: (lcaName: string) => void;
  onPathHover: (pathId: string | null) => void;
  onLcaHover: (lcaName: string | null) => void;
  hoveredNodeId?: string | null;
  // "all": render every path + LCA section (default)
  // "visible": only paths currently in the viz, keep LCA section
  // "hidden": only paths NOT in the viz, hide LCA section, used by the
  //   "Other paths" tab so users can discover additional paths to add.
  filter?: "all" | "visible" | "hidden";
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function mapTypeToCategory(type: string): LinkCategory | null {
  const normalized = normalize(type);
  if (!normalized) return null;

  if (normalized.includes("drug") || normalized.includes("compound")) return "compound";
  if (normalized.includes("disease")) return "disease";
  if (normalized.includes("gene")) return "gene";
  return null;
}

function makeEntityKey(name: string, type?: string | null) {
  if (!type) return null;
  const category = mapTypeToCategory(type);
  if (!category) return null;
  return `${category}::${normalize(name)}`;
}

export default function PathList({
  dataset,
  pair,
  visiblePaths,
  togglePath,
  visibleLCAs,
  toggleLCA,
  onPathHover,
  onLcaHover,
  hoveredNodeId = null,
  filter = "all",
}: PathListProps) {
  const colors = useTheme();
  const { theme } = useThemeContext();
  // Link color for entity hyperlinks, the hardcoded #9dd6ff reads fine on
  // dark/legacy backgrounds but is too faint on light theme's white card.
  // Swap to a stronger blue when the theme's card is light-background.
  const linkColor = theme === "light" ? "#1F5FB5" : "#9dd6ff";
  const [entityLinksByKey, setEntityLinksByKey] = useState<Record<string, EntityLinkInfo>>({});

  const entitiesForLookup = useMemo(() => {
    const byKey = new Map<string, { name: string; type: string }>();

    for (const path of pair.paths) {
      for (const node of path.nodes) {
        const key = makeEntityKey(node.id, node.type);
        if (!key) continue;
        if (!byKey.has(key)) {
          byKey.set(key, { name: node.id, type: node.type });
        }
      }
    }

    return Array.from(byKey.values());
  }, [pair.paths]);

  useEffect(() => {
    let cancelled = false;

    if (!dataset || entitiesForLookup.length === 0) {
      setEntityLinksByKey({});
      return;
    }

    void (async () => {
      try {
        const response = await fetch("/api/entity-links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataset, entities: entitiesForLookup }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const json = (await response.json()) as {
          links?: Record<string, EntityLinkInfo>;
        };

        if (!cancelled) {
          setEntityLinksByKey(json.links ?? {});
        }
      } catch (error) {
        console.error("Failed to load entity links:", error);
        if (!cancelled) {
          setEntityLinksByKey({});
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dataset, entitiesForLookup]);

  useEffect(() => {
    return () => {
      onPathHover(null);
      onLcaHover(null);
    };
  }, [onLcaHover, onPathHover]);

  const nodeTypeByName = useMemo(() => {
    const map = new Map<string, string>();
    pair.paths.forEach((path) => {
      path.nodes.forEach((node) => {
        if (!map.has(node.id)) {
          map.set(node.id, node.type);
        }
      });
    });
    return map;
  }, [pair.paths]);

  // Parse LCA entries, only from paths that are currently visible so we
  // don't advertise ancestors whose supporting paths aren't in the graph.
  const lcaEntries: { lcaName: string; sourceNodes: string[] }[] = [];
  const seenLCAs = new Set<string>();

  pair.paths.forEach((path) => {
    if (!visiblePaths.has(path.id)) return;
    if (!path.lowest_common_ancestors) return;

    Object.entries(path.lowest_common_ancestors).forEach(
      ([key, lcaList]) => {
        const sourceNodes = key.split(",");
        const lcaArray = Array.isArray(lcaList)
          ? lcaList
          : [lcaList].filter(Boolean);

        lcaArray.forEach((lcaName) => {
          if (lcaName && !seenLCAs.has(lcaName)) {
            seenLCAs.add(lcaName);
            lcaEntries.push({ lcaName, sourceNodes });
          }
        });
      }
    );
  });

  const sectionLabelStyle: React.CSSProperties = {
    color: `${colors.white}99`,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    marginBottom: "0.5rem",
    paddingLeft: "0.25rem",
  };

  const cardStyle: React.CSSProperties = {
    flex: "0 1 90%",
    maxWidth: "280px",
    padding: "1rem",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: `${colors.white}30`,
    borderRadius: 10,
    backgroundColor: `${colors.white}10`,
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    position: "relative",
    color: colors.white,
    transition: "border-color 0.15s ease, background-color 0.15s ease",
  };

  const pathIdsContainingHoveredNode = useMemo(() => {
    if (!hoveredNodeId) return new Set<string>();
    const ids = new Set<string>();
    pair.paths.forEach((path) => {
      if (path.nodes.some((node) => node.id === hoveredNodeId)) {
        ids.add(path.id);
      }
    });
    return ids;
  }, [hoveredNodeId, pair.paths]);

  const renderNodeName = (name: string, nodeType?: string) => {
    const linkKey = makeEntityKey(name, nodeType);
    const linkInfo = linkKey ? entityLinksByKey[linkKey] : undefined;
    if (!linkInfo?.url) {
      return <strong>{name}</strong>;
    }

    const titleParts = [
      linkInfo.source ? `Source: ${linkInfo.source}` : null,
      linkInfo.externalId ? `ID: ${linkInfo.externalId}` : null,
    ].filter(Boolean);
    const hoverTitle =
      titleParts.length > 0
        ? `Open external reference (${titleParts.join(" | ")})`
        : "Open external reference";

    return (
      <span
        style={{ position: "relative", display: "inline-block" }}
        onMouseEnter={(e) => {
          const anchor = e.currentTarget.querySelector(
            "a"
          ) as HTMLAnchorElement | null;
          const tip = e.currentTarget.querySelector(
            ".pathlist-link-tip"
          ) as HTMLElement | null;
          if (!anchor || !tip) return;
          // Position the tooltip with `position: fixed` using the link's
          // screen rect so it escapes any ancestor with `overflow: hidden`.
          // Clamp to the viewport so the pill never gets cut off either.
          const r = anchor.getBoundingClientRect();
          // Temporarily make the tip visible enough to measure its width.
          tip.style.visibility = "hidden";
          tip.style.opacity = "0";
          tip.style.display = "block";
          const tipWidth = tip.offsetWidth || 160;
          const centerX = r.left + r.width / 2;
          const half = tipWidth / 2;
          const margin = 8;
          const left = Math.max(
            margin,
            Math.min(window.innerWidth - tipWidth - margin, centerX - half)
          );
          tip.style.left = `${left}px`;
          tip.style.top = `${Math.max(margin, r.top - tip.offsetHeight - 6)}px`;
          tip.style.visibility = "visible";
          tip.style.opacity = "1";
        }}
        onMouseLeave={(e) => {
          const tip = e.currentTarget.querySelector(
            ".pathlist-link-tip"
          ) as HTMLElement | null;
          if (tip) tip.style.opacity = "0";
        }}
      >
        <a
          href={linkInfo.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: linkColor,
            textDecoration: "underline",
            fontWeight: 700,
          }}
        >
          {name}
        </a>
        <span
          className="pathlist-link-tip"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            backgroundColor: "#333",
            color: "#fff",
            padding: "3px 8px",
            borderRadius: 4,
            fontSize: 10.5,
            whiteSpace: "nowrap",
            zIndex: 9999,
            pointerEvents: "none",
            opacity: 0,
            transition: "opacity 0.12s",
          }}
        >
          {hoverTitle}
        </span>
      </span>
    );
  };

  const formatScore = (value: number | undefined) =>
    typeof value === "number" ? value.toFixed(3) : "N/A";

  return (
    <div
      style={{
        marginTop: "0.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
      }}
    >
      {/* Paths Section */}
      <div>
        {filter !== "hidden" && (
          <div style={sectionLabelStyle}>Main Paths</div>
        )}
        {(() => {
          const filteredPaths = pair.paths.filter((p) => {
            if (filter === "visible") return visiblePaths.has(p.id);
            if (filter === "hidden") return !visiblePaths.has(p.id);
            return true;
          });
          if (filteredPaths.length === 0) {
            return (
              <p
                style={{
                  color: `${colors.white}99`,
                  fontSize: "0.85rem",
                  fontStyle: "italic",
                  textAlign: "center",
                  padding: "1rem 0",
                  margin: 0,
                }}
              >
                {filter === "hidden"
                  ? "All available paths are already in the visualization."
                  : "No paths to show."}
              </p>
            );
          }
          return (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            justifyContent: "center",
          }}
        >
          {filteredPaths.map((path: Path) => {
            const idx = pair.paths.indexOf(path);
            const isVisible = visiblePaths.has(path.id);
            const isNodeMatch = pathIdsContainingHoveredNode.has(path.id);

            return (
              <div
                key={path.id}
                style={{
                  ...cardStyle,
                  ...(isNodeMatch
                    ? {
                        borderColor: colors.firstColor,
                        backgroundColor: `${colors.firstColor}22`,
                      }
                    : null),
                }}
                onMouseEnter={() => {
                  if (isVisible) onPathHover(path.id);
                }}
                onMouseLeave={() => onPathHover(null)}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "0.5rem",
                    flexWrap: "wrap",
                    marginBottom: "0.5rem",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      color: colors.white,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={() => {
                        if (isVisible) onPathHover(null);
                        togglePath(path.id);
                      }}
                      title={isVisible ? "Hide path" : "Show path"}
                      style={{ marginRight: "0.5rem", cursor: "pointer" }}
                    />
                    <strong>Path {idx + 1}</strong>
                  </label>

                  {/* Score badge lives in the header row beside the title so it
                      reserves its own space in normal flow. It used to be
                      position:absolute and floated over the path steps, which
                      overlapped the first step once the padding was widened. */}
                  {(path.score?.ic_mean != null ||
                    path.score?.agentic_score != null) && (
                    <div
                      style={{
                        padding: "0.5rem 0.75rem",
                        borderRadius: 6,
                        border: `1px solid ${colors.white}30`,
                        backgroundColor: `${colors.white}18`,
                        color: colors.white,
                        fontSize: 11,
                        fontWeight: 700,
                        lineHeight: 1.35,
                        textAlign: "right",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {path.score?.ic_mean != null && (
                        <div>IC score: {formatScore(path.score.ic_mean)}</div>
                      )}

                      {path.score?.agentic_score != null && (
                        <div>
                          Agentic score: {formatScore(path.score.agentic_score)}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <ul
                  style={{
                    paddingLeft: "1.2rem",
                    margin: 0,
                    color: colors.white,
                    fontSize: "0.8rem",
                  }}
                >
                  {path.edges
                    .filter((edge) => edge.type !== "LCA")
                    .map((edge, i) => (
                      <li
                        key={i}
                        style={{
                          marginBottom: "0.4rem",
                          listStyleType: "disc",
                        }}
                      >
                        {renderNodeName(edge.source, nodeTypeByName.get(edge.source))}{" "}
                        <span style={{ fontWeight: 500 }}>
                          {edge.label}
                        </span>{" "}
                        {renderNodeName(edge.target, nodeTypeByName.get(edge.target))}
                      </li>
                    ))}
                </ul>
              </div>
            );
          })}
        </div>
          );
        })()}
      </div>

      {/* LCA Section, hide on the "hidden/Other paths" tab since LCAs are
          tied to the paths already in the viz, not the ones waiting to be
          added. */}
      {filter !== "hidden" && lcaEntries.length > 0 && (
        <div>
          <div style={sectionLabelStyle}>
            Lowest Common Ancestors
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              justifyContent: "center",
            }}
          >
            {lcaEntries.map(({ lcaName, sourceNodes }, idx) => {
              const isVisible = visibleLCAs.has(lcaName);

              return (
                <div
                  key={lcaName}
                  style={cardStyle}
                  onMouseEnter={() => {
                    if (isVisible) onLcaHover(lcaName);
                  }}
                  onMouseLeave={() => onLcaHover(null)}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      marginBottom: "0.5rem",
                      color: colors.white,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={() => {
                        if (isVisible) onLcaHover(null);
                        toggleLCA(lcaName);
                      }}
                      title={isVisible ? "Hide LCA" : "Show LCA"}
                      style={{ marginRight: "0.5rem", cursor: "pointer" }}
                    />
                    <strong>LCA {idx + 1}</strong>
                  </label>

                  <ul
                    style={{
                      paddingLeft: "1.2rem",
                      margin: 0,
                      color: colors.white,
                      fontSize: "0.8rem",
                    }}
                  >
                    {sourceNodes.map((sourceNode, i) => (
                      <li
                        key={i}
                        style={{
                          marginBottom: "0.4rem",
                          listStyleType: "disc",
                        }}
                      >
                        {renderNodeName(sourceNode, nodeTypeByName.get(sourceNode))}{" "}
                        <span style={{ fontWeight: 500 }}>
                          is a
                        </span>{" "}
                        <strong>{lcaName}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
