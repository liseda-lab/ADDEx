"use client";
import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { User, Gear, ShareNetwork, Lightbulb } from "phosphor-react";

import { useTheme, useThemeContext } from "../../../../styles/ThemeContext";
import SelectorBlock from "./NodeSelectorBlock";
import { ExplanationSearchState, Pair } from "../../hooks/types";
import useResolvedPairCodes, {
  type LabelsByType,
} from "@/app/hooks/useResolvedPairCodes";
import {
  getDefaultTypes,
  resolveTypePreference,
} from "@/app/hooks/taskDefaults";

const iconMap: Record<string, React.ElementType> = {
  Gear,
  ShareNetwork,
  Lightbulb,
  User,
};

export interface SelectionState {
  type: string;
  id: string;
}

interface PairSideMenuProps {
  onSelectFile: (filename: string) => void;
  onShowGraph: (pair: Pair, show?: boolean) => void;
  onShowSummary?: (show?: boolean) => void;
  onOutputModeChange?: (modes: { visualization: boolean; verbalization: boolean }) => void;
  onSetPair?: (pair: Pair) => void;
  onJobStateChange?: (state: ExplanationSearchState) => void;
  onRegisterCancel?: (cancelFn: (() => Promise<void>) | null) => void;
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
}

interface PersonaOption {
  id: string;
  name: string;
  accentColor: string;
  iconName: string;
}

interface DatasetOption {
  name: string;
  tasks: string[];
}

export default function PairSideMenu({
  onSelectFile,
  onShowGraph,
  onShowSummary,
  onOutputModeChange,
  onSetPair,
  onJobStateChange,
  onRegisterCancel,
  collapsed,
  setCollapsed,
}: PairSideMenuProps) {
  const colors = useTheme();
  const { theme } = useThemeContext();
  // Theme-aware accent map for known personas. Legacy keeps OG green/blue;
  // other themes use the semantic per-persona hue, Insight Driven=purple,
  // Mechanistic Analyst=blue, Neutral=green, so the side-panel symbol matches
  // the tagline keywords and dataset cards.
  const personaAccentFor = (id: string | null | undefined): string => {
    if (!id) return colors.white;
    if (theme === "legacy") {
      if (id === "mechanistic_analyst") return colors.green;
      if (id === "insight_driven") return colors.firstColor;
      return colors.firstColor;
    }
    if (id === "mechanistic_analyst") return colors.headingAccents[3];
    if (id === "insight_driven") return colors.headingAccents[0];
    return colors.headingAccents[6];
  };
  // Known identifiers get special-cased display labels (hyphenation, etc.).
  // Anything else falls through to the generic snake-case → Title Case.
  const DISPLAY_LABELS: Record<string, string> = {
    drug_target: "Drug-Target Interaction",
    drug_repurposing: "Drug Repurposing",
  };
  const formatDisplayLabel = (value?: string | null) => {
    if (!value) return "";
    if (DISPLAY_LABELS[value]) return DISPLAY_LABELS[value];
    return value
      .replace(/_/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  const [source, setSource] = useState<SelectionState>({
    type: "",
    id: "",
  });

  const [target, setTarget] = useState<SelectionState>({
    type: "",
    id: "",
  });
  const [labelsByType, setLabelsByType] = useState<LabelsByType>({});
  const [jobState, setJobState] = useState<ExplanationSearchState>({
    status: "idle",
  });
  const [personaOptions, setPersonaOptions] = useState<PersonaOption[]>([]);
  const [datasetOptions, setDatasetOptions] = useState<DatasetOption[]>([]);
  const [outputSelection, setOutputSelection] = useState({
    visualization: true,
    verbalization: true,
  });
  const [newSearchOpen, setNewSearchOpen] = useState(false);
  const [hasInitiatedSearch, setHasInitiatedSearch] = useState(false);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchedPairRef = useRef<{ source: string; target: string } | null>(null);
  // Wrapper around the "New Search" toggle + its popover; used to close the
  // popover when the user clicks anywhere outside of it (or presses Esc).
  const newSearchRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!newSearchOpen) return;
    const onClick = (e: MouseEvent) => {
      const root = newSearchRootRef.current;
      if (root && !root.contains(e.target as Node)) {
        setNewSearchOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNewSearchOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [newSearchOpen]);

  useEffect(() => {
    if (!hasInitiatedSearch) return;
    const searched = searchedPairRef.current;
    if (!searched) return;
    if (source.id !== searched.source || target.id !== searched.target) {
      setHasInitiatedSearch(false);
      searchedPairRef.current = null;
    }
  }, [source.id, target.id, hasInitiatedSearch]);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { getLabelNamesForType, printResolvedPairCodes } =
    useResolvedPairCodes(labelsByType);

  // Canonical icon mapping per persona id, source of truth so the symbol
  // always matches what the user saw on the profile card, even if the URL
  // has a stale `icon` param (e.g. `User` from before the round-tripping
  // fix). Falls back to the URL param for unknown persona ids.
  const personaIconFor = (id: string | null | undefined): string => {
    if (id === "mechanistic_analyst") return "Gear";
    if (id === "insight_driven") return "ShareNetwork";
    if (id === "neutral") return "Lightbulb";
    return searchParams.get("icon") ?? "User";
  };

  const selectedPersona = useMemo(() => {
    const personaId = searchParams.get("persona");
    const personaName = searchParams.get("personaName");
    const dataset = searchParams.get("dataset");
    const task = searchParams.get("task");

    if (!personaId) return null;

    // Derive the accent from the current theme + persona id, not from the
    // URL param. That way the side-panel symbol stays in sync with the theme
    // even if an older URL carries a stale accent color.
    const accentColor = personaAccentFor(personaId);
    const iconName = personaIconFor(personaId);
    const IconComponent = iconMap[iconName] ?? User;

    return {
      id: personaId,
      name: personaName ?? personaId,
      accentColor,
      icon: <IconComponent size={20} weight="bold" color={accentColor} />,
      dataset,
      task,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, theme, colors]);

  const personaSelectStyles = (accentColor: string) => {
    const caretColor = encodeURIComponent(accentColor);
    const caret = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='none' stroke='${caretColor}' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' d='M1 1l4 4 4-4'/></svg>")`;
    return {
      width: "100%",
      fontSize: "0.8rem",
      fontWeight: 500,
      color: accentColor,
      backgroundColor: colors.darkblue,
      padding: "5px 22px 5px 8px",
      borderRadius: 8,
      border: `1px solid ${colors.white}25`,
      cursor: "pointer",
      appearance: "none" as const,
      WebkitAppearance: "none" as const,
      MozAppearance: "none" as const,
      backgroundImage: caret,
      backgroundRepeat: "no-repeat",
      backgroundPosition: "right 8px center",
      backgroundSize: "10px 6px",
    };
  };

  const defaultTypes = useMemo(
    () =>
      getDefaultTypes(
        selectedPersona?.task ?? undefined,
        selectedPersona?.dataset ?? undefined
      ),
    [selectedPersona?.dataset, selectedPersona?.task]
  );

  useEffect(() => {
    const loadSelectorOptions = async () => {
      try {
        const [personasRes, datasetsRes] = await Promise.all([
          fetch("/api/personas"),
          fetch("/api/datasets"),
        ]);

        if (!personasRes.ok || !datasetsRes.ok) {
          throw new Error("Failed to load personas or datasets");
        }

        const personasJson: Array<{ id: string; name?: string }> = await personasRes.json();
        const datasetsJson: Array<{ name: string; tasks: string[] }> = await datasetsRes.json();

        const personaIcons: Record<string, string> = {
          mechanistic_analyst: "Gear",
          insight_driven: "ShareNetwork",
          neutral: "Lightbulb",
        };

        setPersonaOptions(
          personasJson.map((persona) => ({
            id: persona.id,
            name: persona.name || persona.id,
            accentColor: personaAccentFor(persona.id),
            iconName: personaIcons[persona.id] ?? "User",
          }))
        );
        setDatasetOptions(
          datasetsJson.map((dataset) => ({
            name: dataset.name,
            tasks: dataset.tasks ?? [],
          }))
        );
      } catch (error) {
        console.error("Failed to load selector options:", error);
        setPersonaOptions([]);
        setDatasetOptions([]);
      }
    };

    void loadSelectorOptions();
  }, []);

  const currentDatasetOption = useMemo(
    () =>
      datasetOptions.find((option) => option.name === selectedPersona?.dataset) ??
      null,
    [datasetOptions, selectedPersona?.dataset]
  );

  const applySearchContext = ({
    personaId,
    dataset,
    task,
  }: {
    personaId?: string | null;
    dataset?: string | null;
    task?: string | null;
  }) => {
    const nextPersonaId = personaId ?? selectedPersona?.id ?? null;
    const nextDataset = dataset ?? selectedPersona?.dataset ?? null;
    const nextTask = task ?? selectedPersona?.task ?? null;

    const params = new URLSearchParams(searchParams.toString());

    // Quick-search mode allows partial writes: the user may pick persona first,
    // then dataset, then task. Only write params for the fields that have a
    // value, and clear the others so the derived `selectedPersona` stays in
    // sync with what's actually been chosen.
    if (nextPersonaId) {
      const personaMeta = personaOptions.find((p) => p.id === nextPersonaId);
      params.set("persona", nextPersonaId);
      params.set("personaName", personaMeta?.name ?? nextPersonaId);
      params.set(
        "accentColor",
        personaMeta?.accentColor ?? (selectedPersona?.accentColor ?? colors.white)
      );
      params.set("icon", personaMeta?.iconName ?? "User");
    } else {
      params.delete("persona");
      params.delete("personaName");
      params.delete("accentColor");
      params.delete("icon");
    }
    if (nextDataset) params.set("dataset", nextDataset);
    else params.delete("dataset");
    if (nextTask) params.set("task", nextTask);
    else params.delete("task");

    // Clear example-pair pre-fills whenever dataset or task changes — those
    // URL params describe entities in the previous dataset/task and would
    // otherwise survive into the new context (e.g., a "Disease" target from
    // Drug Repurposing leaking into a Drug-Target Interaction run).
    const datasetChanged = dataset !== undefined && dataset !== selectedPersona?.dataset;
    const taskChanged = task !== undefined && task !== selectedPersona?.task;
    if (datasetChanged || taskChanged) {
      params.delete("sourceType");
      params.delete("sourceName");
      params.delete("targetType");
      params.delete("targetName");
    }

    setSource((prev) => ({ ...prev, id: "" }));
    setTarget((prev) => ({ ...prev, id: "" }));
    router.push(`${pathname}?${params.toString()}`);
  };

  useEffect(() => {
    if (!selectedPersona?.dataset || !selectedPersona?.task) {
      setLabelsByType({});
      return;
    }
    let isActive = true;
    const expectedDataset = selectedPersona.dataset;
    const expectedTask = selectedPersona.task;

    const fetchLabels = async () => {
      try {
        const params = new URLSearchParams({
          dataset: expectedDataset ?? "",
          task: expectedTask ?? "",
        });
        const response = await fetch(`/api/labels?${params.toString()}`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const json: { labelsByType: LabelsByType } = await response.json();
        if (!isActive) return;
        setLabelsByType(json.labelsByType ?? {});
      } catch (error) {
        if (!isActive) return;
        console.error("Failed to load labels:", error);
        setLabelsByType({});
      }
    };

    fetchLabels();

    return () => {
      isActive = false;
    };
  }, [selectedPersona?.dataset, selectedPersona?.task]);

  useEffect(() => {
    onJobStateChange?.(jobState);
  }, [jobState, onJobStateChange]);

  useEffect(() => {
    onOutputModeChange?.(outputSelection);
  }, [onOutputModeChange, outputSelection]);

  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, []);

  const currentJobIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    currentJobIdRef.current = jobState.jobId;
  }, [jobState.jobId]);

  const cancelSearch = useCallback(async () => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }

    const jobId = currentJobIdRef.current;
    if (jobId) {
      try {
        await fetch(
          `/api/explanation-search?jobId=${encodeURIComponent(jobId)}`,
          { method: "DELETE" }
        );
      } catch (error) {
        console.error("Failed to cancel explanation job:", error);
      }
    }

    setJobState({ status: "idle" });
  }, []);

  useEffect(() => {
    if (!onRegisterCancel) return;
    onRegisterCancel(cancelSearch);
    return () => onRegisterCancel(null);
  }, [onRegisterCancel, cancelSearch]);

  const availableTypes = useMemo(() => Object.keys(labelsByType), [labelsByType]);
  // String form of searchParams so the effect below reliably re-runs when
  // the URL changes (the ReadonlyURLSearchParams reference is not always
  // a fresh value across navigations).
  const searchParamsStr = searchParams.toString();

  useEffect(() => {
    const resolvedSourceType = resolveTypePreference(
      availableTypes,
      defaultTypes.source
    );
    const resolvedTargetType = resolveTypePreference(
      availableTypes,
      defaultTypes.target
    );

    // Pre-fill from URL params when arriving via an example-pair link. The
    // types fall through the normal default-type resolution if not provided.
    // Names are only applied if they actually exist in the loaded labels,
    // otherwise we leave the field empty rather than auto-selecting something
    // the user didn't ask for.
    const urlSourceType = searchParams.get("sourceType");
    const urlSourceName = searchParams.get("sourceName");
    const urlTargetType = searchParams.get("targetType");
    const urlTargetName = searchParams.get("targetName");

    const sourceType =
      urlSourceType || resolvedSourceType || defaultTypes.source[0] || "";
    const targetType =
      urlTargetType || resolvedTargetType || defaultTypes.target[0] || "";

    const sourceNames = sourceType ? getLabelNamesForType(sourceType) : [];
    const targetNames = targetType ? getLabelNamesForType(targetType) : [];

    setSource({
      type: sourceType,
      id: urlSourceName && sourceNames.includes(urlSourceName) ? urlSourceName : "",
    });

    setTarget({
      type: targetType,
      id: urlTargetName && targetNames.includes(urlTargetName) ? urlTargetName : "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableTypes, defaultTypes.source, defaultTypes.target, searchParamsStr]);

  const styles = {
    aside: {
      width: collapsed ? 60 : 270,
      height: "calc(100dvh - 60px)",
      padding: collapsed ? "0.85rem 0.5rem" : "0.95rem 0.82rem 0.95rem",
      backgroundColor: colors.card,
      borderRight: `1px solid ${colors.white}15`,
      boxShadow: "0 8px 22px rgba(0,0,0,0.08)",
      color: colors.white,
      fontWeight: 500,
      boxSizing: "border-box" as const,
      overflowY: "auto" as const,
      position: "fixed" as const,
      top: 60,
      left: 0,
      zIndex: 40,
      transition: "width 0.2s ease",
    },
    toggleButton: {
      position: "absolute" as const,
      top: 10,
      right: 10,
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
    userIcon: {
      display: collapsed ? "none" : "flex",
      justifyContent: "center",
      marginBottom: "0.9rem",
    },
  };

  // Display labels for the locked Type field, driven by the task instead of
  // the underlying entity type. For Drug-Target Interaction, the target side
  // shows "Target" even when the stored type is "Gene"/"Protein". For Drug
  // Repurposing, the target side shows "Disease". The source side shows
  // "Compound" for both tasks.
  const taskTypeLabel = (role: "source" | "target"): string | null => {
    const task = selectedPersona?.task;
    if (task === "drug_target") {
      return role === "target" ? "Target" : "Compound";
    }
    if (task === "drug_repurposing") {
      return role === "target" ? "Disease" : "Compound";
    }
    return null;
  };

  const selectorsConfig = [
    {
      title: "Source",
      role: "source" as const,
      state: source,
      setState: setSource,
    },
    {
      title: "Target",
      role: "target" as const,
      state: target,
      setState: setTarget,
    },
  ];

  const searchInProgress =
    jobState.status === "checking" ||
    jobState.status === "queued" ||
    jobState.status === "running";

  const searchButtonRef = useRef<HTMLButtonElement>(null);

  // Press Enter to run the search after both source + target are selected.
  // The Dropdown component blurs its input on commit so focus lands on body;
  // we still skip when focus is in a text field or an actively-open dropdown
  // so we never hijack Enter from those controls.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey)
        return;
      if (searchInProgress || hasInitiatedSearch) return;
      if (!source.id || !target.id) return;

      const active = document.activeElement as HTMLElement | null;
      if (active) {
        const tag = active.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea" || active.isContentEditable)
          return;
        if (active.getAttribute("aria-expanded") === "true") return;
      }

      e.preventDefault();
      searchButtonRef.current?.click();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [source.id, target.id, searchInProgress, hasInitiatedSearch]);

  // Exponential backoff schedule for job polling: cached / pre-warmed pairs
  // resolve on the first or second poll, so the early intervals are short
  // (~300ms). Long-running first-time computations fall back to the 4s cap
  // to avoid hammering the server.
  const POLL_BACKOFF_MS = [300, 700, 1500, 2500, 4000];
  const nextPollDelay = (attempt: number) =>
    POLL_BACKOFF_MS[Math.min(attempt, POLL_BACKOFF_MS.length - 1)];

  const pollJobStatus = async ({
    dataset,
    task,
    persona,
    sourceCode,
    targetCode,
    jobId,
    attempt = 0,
  }: {
    dataset: string;
    task: string;
    persona: string;
    sourceCode: string;
    targetCode: string;
    jobId: string;
    attempt?: number;
  }) => {
    try {
      const params = new URLSearchParams({
        dataset,
        task,
        persona,
        source: sourceCode,
        target: targetCode,
        jobId,
      });

      const response = await fetch(`/api/explanation-search?${params.toString()}`);
      if (!response.ok) {
        if (response.status === 404) {
          pollTimeoutRef.current = setTimeout(() => {
            void pollJobStatus({
              dataset,
              task,
              persona,
              sourceCode,
              targetCode,
              jobId,
              attempt: attempt + 1,
            });
          }, nextPollDelay(attempt));
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const json:
        | { status: "ready"; pair: Pair }
        | { status: "queued" | "running" | "failed" | "missing"; message?: string; jobId?: string } =
        await response.json();

      if (json.status === "ready") {
        setJobState({
          status: "idle",
        });
        onShowGraph(json.pair, outputSelection.visualization);
        onSetPair?.(json.pair);
        onShowSummary?.(outputSelection.verbalization);
        return;
      }

      if (json.status === "queued" || json.status === "running") {
        setJobState({
          status: json.status,
          message:
            json.message ??
            "This is the first time someone is running this pair, it may take a few minutes.",
          jobId: json.jobId ?? jobId,
        });
        pollTimeoutRef.current = setTimeout(() => {
          void pollJobStatus({
            dataset,
            task,
            persona,
            sourceCode,
            targetCode,
            jobId: json.jobId ?? jobId,
            attempt: attempt + 1,
          });
        }, nextPollDelay(attempt));
        return;
      }

      setJobState({
        status: json.status,
        message:
          json.message ??
          "REx could not generate an explanation for this pair.",
        jobId: json.jobId,
      });
    } catch (error) {
      console.error("Failed to poll explanation job:", error);
      setJobState({
        status: "failed",
        message: "Failed while waiting for the explanation run to finish.",
      });
    }
  };

  return (
    <aside style={styles.aside}>
      {/* Breathing glow that draws attention to the Search button when the
          pair is ready to run. Runs four cycles (~6s) then settles, enough
          to signal "click here next" after an example is clicked, without
          pulsing forever. */}
      <style>{`
        @keyframes rex-search-pulse {
          0%, 100% {
            box-shadow: 0 8px 18px rgba(0,0,0,0.28);
          }
          50% {
            box-shadow:
              0 8px 18px rgba(0,0,0,0.28),
              0 0 0 6px ${colors.buttons}44,
              0 0 24px ${colors.buttons}66;
          }
        }
        .rex-search-ready {
          animation: rex-search-pulse 1.5s ease-in-out 4;
        }
      `}</style>
      <button
        style={styles.toggleButton}
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? ">" : "<"}
      </button>

      {!collapsed && (
        <div
          style={{
            marginTop: "0.675rem",
          }}
        >
          {/* Persona */}
          <div
            style={{
              ...styles.userIcon,
              border: `1px solid ${colors.white}28`,
              borderRadius: 14,
              padding: "0.75rem 0.68rem 0.7rem",
              // Foreground-tinted overlay so the persona panel reads subtly
              // in both dark and light themes (previously a black overlay
              // that turned into muddy gray on a white card).
              background: `${colors.white}12`,
            }}
          >
            <div>
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: "50%",
                  border: `2px solid ${selectedPersona?.accentColor ?? colors.white}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto",
                  background: `${selectedPersona?.accentColor ?? colors.white}22`,
                }}
              >
                {selectedPersona?.icon ?? (
                  <User size={28} weight="bold" color={colors.white} />
                )}
              </div>

              <div
                style={{
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  alignItems: "stretch",
                  marginTop: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      minWidth: 60,
                      fontSize: "0.74rem",
                      fontWeight: 600,
                      color: colors.white,
                    }}
                  >
                    Profile:
                  </span>
                  <select
                    value={selectedPersona?.id ?? ""}
                    onChange={(event) =>
                      applySearchContext({ personaId: event.target.value })
                    }
                    style={personaSelectStyles(colors.white)}
                  >
                    <option value="" disabled>
                      Select profile...
                    </option>
                    {personaOptions.map((persona) => (
                      <option key={persona.id} value={persona.id}>
                        {formatDisplayLabel(persona.name)}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      minWidth: 60,
                      fontSize: "0.74rem",
                      fontWeight: 600,
                      color: colors.white,
                    }}
                  >
                    Dataset:
                  </span>
                  <select
                    value={selectedPersona?.dataset ?? ""}
                    onChange={(event) => {
                      const nextDataset = event.target.value;
                      const datasetEntry = datasetOptions.find((d) => d.name === nextDataset);
                      // Preserve the user's current task if the new dataset supports it;
                      // otherwise clear the task so they pick a valid one rather than
                      // silently auto-assigning.
                      const nextTask =
                        datasetEntry?.tasks.includes(selectedPersona?.task ?? "")
                          ? (selectedPersona?.task ?? "")
                          : "";
                      applySearchContext({
                        dataset: nextDataset,
                        task: nextTask,
                      });
                    }}
                    style={personaSelectStyles(colors.white)}
                  >
                    <option value="" disabled>
                      Select dataset...
                    </option>
                    {datasetOptions.map((dataset) => (
                      <option key={dataset.name} value={dataset.name}>
                        {formatDisplayLabel(dataset.name)}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      minWidth: 60,
                      fontSize: "0.74rem",
                      fontWeight: 600,
                      color: colors.white,
                    }}
                  >
                    Task:
                  </span>
                  <select
                    value={selectedPersona?.task ?? ""}
                    onChange={(event) =>
                      applySearchContext({ task: event.target.value })
                    }
                    disabled={!selectedPersona?.dataset}
                    style={personaSelectStyles(colors.white)}
                  >
                    <option value="" disabled>
                      {selectedPersona?.dataset ? "Select task..." : "Choose dataset first"}
                    </option>
                    {(currentDatasetOption?.tasks ?? []).map((task) => (
                      <option key={task} value={task}>
                        {formatDisplayLabel(task)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Output mode toggles are always visible so users can switch
              between visualization/verbalization anytime, including after a
              search has already completed. */}
          {/* Selectors */}
          <div
            style={{
              marginTop: "0.5rem",
              padding: 0,
            }}
          >
            {selectorsConfig.map(({ title, role, state, setState }) => (
              <SelectorBlock
                key={title}
                title={title}
                mainValue={state.type}
                setMainValue={() => {}}
                secondaryValue={state.id}
                setSecondaryValue={(value) =>
                  setState((prev) => ({
                    ...prev,
                    id: value,
                  }))
                }
                mainOptions={state.type ? [state.type] : []}
                secondaryOptions={
                  state.type ? getLabelNamesForType(state.type) : []
                }
                mainLabel="Type"
                secondaryLabel="Name"
                allowDeselect={false}
                // The type is task-determined and locked, so we display a
                // task-friendly label (Compound / Target / Disease) regardless
                // of the underlying graph type (Gene, Protein, etc.).
                mainDisplayFor={(value) => {
                  const taskLabel = taskTypeLabel(role);
                  if (taskLabel) return taskLabel;
                  if (
                    selectedPersona?.dataset?.toLowerCase() === "oregano" &&
                    value === "Protein"
                  ) {
                    return "Target";
                  }
                  return value;
                }}
              />
            ))}

            <div
              style={{
                marginTop: "0.2rem",
                marginBottom: "0.25rem",
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                padding: "0.35rem 0.5rem",
                borderRadius: 8,
                border: `1px solid ${colors.white}22`,
                backgroundColor: `${colors.white}08`,
                flexWrap: "nowrap",
                whiteSpace: "nowrap",
              }}
            >
              <span
                style={{
                  fontSize: "0.74rem",
                  color: `${colors.white}d0`,
                  fontWeight: 600,
                }}
              >
                Show:
              </span>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: "0.74rem",
                  color: colors.white,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={outputSelection.visualization}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setOutputSelection((prev) => ({
                      visualization: next,
                      verbalization: next || prev.verbalization,
                    }));
                  }}
                />
                Graph
              </label>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: "0.74rem",
                  color: colors.white,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={outputSelection.verbalization}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setOutputSelection((prev) => ({
                      verbalization: next,
                      visualization: next || prev.visualization,
                    }));
                  }}
                />
                Summary
              </label>
            </div>

            {source.id && target.id && (
              <div
                style={{
                  marginTop: "0.6rem",
                }}
              >
                {source.id && target.id && !hasInitiatedSearch && (
                  <button
                    ref={searchButtonRef}
                    className={searchInProgress ? undefined : "rex-search-ready"}
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.65rem",
                      borderRadius: 8,
                      border: `1px solid ${colors.buttons}60`,
                      backgroundColor: searchInProgress
                        ? `${colors.buttons}a8`
                        : colors.buttons,
                      color: "#FFFFFF",
                      fontWeight: 600,
                      fontSize: "0.78rem",
                      cursor: searchInProgress ? "wait" : "pointer",
                      opacity: searchInProgress ? 0.8 : 1,
                      boxShadow: searchInProgress
                        ? "none"
                        : "0 8px 18px rgba(0,0,0,0.28)",
                    }}
                    type="button"
                    disabled={searchInProgress}
                    aria-keyshortcuts="Enter"
                    title="Press Enter to run the search"
                    onClick={async () => {
                      if (pollTimeoutRef.current) {
                        clearTimeout(pollTimeoutRef.current);
                      }

                      const { sourceCode, targetCode } = printResolvedPairCodes({
                        dataset: selectedPersona?.dataset,
                        task: selectedPersona?.task,
                        source,
                        target,
                      });

                      if (
                        !selectedPersona?.dataset ||
                        !selectedPersona?.task ||
                        !selectedPersona?.id ||
                        !sourceCode ||
                        !targetCode
                      ) {
                        console.warn("Could not resolve saved explanation lookup.");
                        setJobState({
                          status: "failed",
                          message: "Could not resolve the selected pair IDs.",
                        });
                        return;
                      }

                      try {
                        searchedPairRef.current = { source: source.id, target: target.id };
                        setHasInitiatedSearch(true);
                        setJobState({
                          status: "checking",
                          message: "Checking whether this explanation already exists...",
                        });
                        const response = await fetch("/api/explanation-search", {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify({
                            dataset: selectedPersona.dataset,
                            task: selectedPersona.task,
                            persona: selectedPersona.id,
                            source: sourceCode,
                            target: targetCode,
                          }),
                        });

                        if (!response.ok) {
                          throw new Error(`HTTP ${response.status}`);
                        }

                        const json:
                          | { status: "ready"; pair: Pair }
                          | { status: "queued" | "running"; message?: string; jobId?: string }
                          | { status: "failed"; error?: string; message?: string } = await response.json();

                        if (json.status === "ready") {
                          setJobState({
                            status: "idle",
                          });
                          onShowGraph(json.pair, outputSelection.visualization);
                          onSetPair?.(json.pair);
                          onShowSummary?.(outputSelection.verbalization);
                          return;
                        }

                        if (json.status === "queued" || json.status === "running") {
                          setJobState({
                            status: json.status,
                            message:
                              json.message ??
                              "This is the first time someone is running this pair, it may take a few minutes.",
                            jobId: json.jobId,
                          });

                          if (json.jobId) {
                            void pollJobStatus({
                              dataset: selectedPersona.dataset,
                              task: selectedPersona.task,
                              persona: selectedPersona.id,
                              sourceCode,
                              targetCode,
                              jobId: json.jobId,
                            });
                          }
                          return;
                        }

                        if (json.status === "failed") {
                          setJobState({
                            status: "failed",
                            message:
                              json.message ??
                              json.error ??
                              "Failed to load or generate this explanation.",
                          });
                        }
                      } catch (error) {
                        console.error("Failed to load saved explanation:", error);
                        setJobState({
                          status: "failed",
                          message: "Failed to load or generate this explanation.",
                        });
                      }
                    }}
                  >
                    {jobState.status === "checking"
                      ? "Checking..."
                      : searchInProgress
                        ? "Running REx..."
                        : "Search Explanation"}
                  </button>
                )}
              </div>
            )}

            {hasInitiatedSearch && selectedPersona?.id && (
              <div
                ref={newSearchRootRef}
                style={{ position: "relative", marginTop: "0.5rem" }}
              >
                <button
                  type="button"
                  onClick={() => setNewSearchOpen((prev) => !prev)}
                  aria-expanded={newSearchOpen}
                  aria-haspopup="menu"
                  style={{
                    width: "100%",
                    padding: "0.45rem 0.75rem",
                    borderRadius: 8,
                    border: `1px solid ${colors.white}30`,
                    backgroundColor: "transparent",
                    color: colors.white,
                    fontWeight: 500,
                    fontSize: "0.78rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                  }}
                >
                  New Search {newSearchOpen ? "▲" : "▼"}
                </button>
                {newSearchOpen && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "calc(100% + 6px)",
                      left: 0,
                      right: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      padding: 4,
                      borderRadius: 8,
                      border: `1px solid ${colors.white}30`,
                      backgroundColor: colors.darkblue,
                      boxShadow: "0 8px 20px rgba(0,0,0,0.45)",
                      zIndex: 100,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setNewSearchOpen(false);
                        const params = new URLSearchParams(
                          searchParams.toString()
                        );
                        // Drop the example-pair pre-fills so the new tab
                        // starts empty instead of inheriting the previous
                        // source/target — same reset semantics as the
                        // "Current page" button.
                        params.delete("sourceType");
                        params.delete("sourceName");
                        params.delete("targetType");
                        params.delete("targetName");
                        const url = `${pathname}?${params.toString()}`;
                        window.open(url, "_blank", "noopener,noreferrer");
                      }}
                      style={{
                        padding: "0.4rem 0.6rem",
                        borderRadius: 6,
                        border: "none",
                        backgroundColor: "transparent",
                        color: colors.white,
                        fontSize: "0.78rem",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      New page
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewSearchOpen(false);
                        if (pollTimeoutRef.current) {
                          clearTimeout(pollTimeoutRef.current);
                          pollTimeoutRef.current = null;
                        }
                        setSource((prev) => ({ ...prev, id: "" }));
                        setTarget((prev) => ({ ...prev, id: "" }));
                        setJobState({ status: "idle" });
                        setHasInitiatedSearch(false);
                        searchedPairRef.current = null;
                        onSelectFile("");
                        // Strip the example-pair URL params so the browser
                        // URL no longer reflects the previous search; without
                        // this the URL still reads ?sourceName=A&targetName=B
                        // and any future re-render (e.g. theme change) that
                        // re-evaluates the URL effect would re-populate the
                        // pickers with the stale pair.
                        const params = new URLSearchParams(
                          searchParams.toString()
                        );
                        params.delete("sourceType");
                        params.delete("sourceName");
                        params.delete("targetType");
                        params.delete("targetName");
                        router.replace(
                          `${pathname}?${params.toString()}`,
                          { scroll: false }
                        );
                      }}
                      style={{
                        padding: "0.4rem 0.6rem",
                        borderRadius: 6,
                        border: "none",
                        backgroundColor: "transparent",
                        color: colors.white,
                        fontSize: "0.78rem",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      Current page
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}
    </aside>
  );
}
