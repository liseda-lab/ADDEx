import { useState, useEffect, useCallback, useMemo } from "react";
import { JsonData, Pair, Path, Node, Edge } from "./types";
import { typeMatchesPreference } from "./taskDefaults";

export default function useGraphData(jsonPath: string) {
  const [data, setData] = useState<JsonData | null>(null);

  // ✅ Map of "sourceId_targetId" -> Pair for fast lookup
  const pairMap = useMemo(() => {
    if (!data) return new Map<string, Pair>();
    const map = new Map<string, Pair>();
    data.pairs.forEach((pair) => {
      pair.paths.forEach((path) => {
        const sourceId = path.nodes[0]?.id;
        const targetId = path.nodes[path.nodes.length - 1]?.id;
        if (sourceId && targetId) {
          map.set(`${sourceId}_${targetId}`, { ...pair, source: sourceId, target: targetId });
        }
      });
    });
    return map;
  }, [data]);

  // Load JSON
  useEffect(() => {
    if (!jsonPath) {
      setData(null);
      return;
    }

    const fetchData = async () => {
      try {
        const res = await fetch(jsonPath);
        const json: JsonData = await res.json();
        setData(json);
      } catch (err) {
        console.error("Failed to load JSON:", err);
        setData(null);
      }
    };
    fetchData();
  }, [jsonPath]);

  const matchesType = useCallback(
    (actualType?: string, expectedType?: string) => {
      if (!actualType || !expectedType) return false;
      return typeMatchesPreference(actualType, expectedType);
    },
    []
  );

  // Get unique node types
  const getTypes = useCallback(
    (isSource: boolean, filterByOtherType?: string) => {
      if (!data) return [];
      const types = new Set<string>();
      data.pairs.forEach((pair) =>
        pair.paths.forEach((path) => {
          const node = isSource ? path.nodes[0] : path.nodes[path.nodes.length - 1];
          const otherNode = isSource ? path.nodes[path.nodes.length - 1] : path.nodes[0];
          if (!node) return;
          if (filterByOtherType && !matchesType(otherNode?.type, filterByOtherType)) return;
          types.add(node.type);
        })
      );
      return Array.from(types).sort();
    },
    [data, matchesType]
  );

  // Get node IDs filtered by type
  const getNodeIds = useCallback(
    (type: string, isSource: boolean, otherType?: string, otherId?: string) => {
      if (!data) return [];
      const ids = new Set<string>();
      data.pairs.forEach((pair) =>
        pair.paths.forEach((path) => {
          const node = isSource ? path.nodes[0] : path.nodes[path.nodes.length - 1];
          const otherNode = isSource ? path.nodes[path.nodes.length - 1] : path.nodes[0];
          if (!node || !matchesType(node.type, type)) return;
          if (otherType && !matchesType(otherNode?.type, otherType)) return;
          if (otherId && otherNode?.id !== otherId) return;
          ids.add(node.id);
        })
      );
      return Array.from(ids).sort();
    },
    [data, matchesType]
  );

  // Prepare Cytoscape elements
  const getCytoscapeElements = useCallback(() => {
    if (!data) return { nodes: [], edges: [] };
    const nodesMap = new Map<string, { data: { id: string; type: string; label: string; color?: string } }>();
    const edges: { data: { id: string; source: string; target: string; label: string; type?: "NE" | "LCA" } }[] = [];

    data.pairs.forEach((pair) => {
      pair.paths.forEach((path) => {
        // Add nodes
        path.nodes.forEach((n) => nodesMap.set(n.id, { data: { id: n.id, type: n.type, label: n.id } }));

        // Add edges
        path.edges.forEach((e) =>
          edges.push({ data: { id: `${e.source}-${e.target}-${e.label}`, source: e.source, target: e.target, label: e.label, type: e.type } })
        );

        // LCA nodes
        if (path.lowest_common_ancestors) {
          Object.entries(path.lowest_common_ancestors).forEach(([key, lcaList]) => {
            const nodeIds = key.split(",");
            lcaList.forEach((lcaName, idx) => {
              if (!lcaName) return;
              const lcaNodeId = `LCA::${lcaName}-${idx}`;
              if (!nodesMap.has(lcaNodeId)) nodesMap.set(lcaNodeId, { data: { id: lcaNodeId, type: "LCA", label: lcaName, color: "#d3d3d3" } });
              nodeIds.forEach((nid) =>
                edges.push({ data: { id: `${lcaNodeId}->${nid}`, source: lcaNodeId, target: nid, label: "is a", type: "LCA" } })
              );
            });
          });
        }
      });
    });

    return { nodes: Array.from(nodesMap.values()), edges };
  }, [data]);

  return { data, getTypes, getNodeIds, getCytoscapeElements, pairMap };
}
