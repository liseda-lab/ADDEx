import { useCallback } from "react";
import { typeMatchesPreference } from "./taskDefaults";

export interface SelectionState {
  type: string;
  id: string;
}

export interface LabelNode {
  code: string;
  name: string;
  type: string;
}

export type LabelsByType = Record<string, LabelNode[]>;

export default function useResolvedPairCodes(labelsByType: LabelsByType) {
  const getLabelNamesForType = useCallback(
    (type: string) => {
      const matchingEntries = Object.entries(labelsByType).filter(([entryType]) =>
        typeMatchesPreference(entryType, type)
      );

      return Array.from(
        new Set(
          matchingEntries.flatMap(([, labels]) => labels.map((label) => label.name))
        )
      ).sort((left, right) => left.localeCompare(right));
    },
    [labelsByType]
  );

  const getCodeForSelection = useCallback(
    (selection: SelectionState) => {
      const matchingEntries = Object.entries(labelsByType).filter(([entryType]) =>
        typeMatchesPreference(entryType, selection.type)
      );

      for (const [, labels] of matchingEntries) {
        const match = labels.find((label) => label.name === selection.id);
        if (match) return match.code;
      }

      return "";
    },
    [labelsByType]
  );

  const printResolvedPairCodes = useCallback(
    ({
      dataset,
      task,
      source,
      target,
    }: {
      dataset?: string | null;
      task?: string | null;
      source: SelectionState;
      target: SelectionState;
    }) => {
      const sourceCode = getCodeForSelection(source);
      const targetCode = getCodeForSelection(target);

      console.log("Resolved pair IDs from graph_labels.tsv", {
        dataset,
        task,
        source: {
          name: source.id,
          type: source.type,
          code: sourceCode,
        },
        target: {
          name: target.id,
          type: target.type,
          code: targetCode,
        },
      });

      return { sourceCode, targetCode };
    },
    [getCodeForSelection]
  );

  return {
    getLabelNamesForType,
    printResolvedPairCodes,
  };
}
