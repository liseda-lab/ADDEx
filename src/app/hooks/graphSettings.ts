// app/hooks/graphSettings.ts
export interface GraphSettings {
  nodeShape: string;
  edgeThickness: number;
  arrowShape: string;
  neLineStyle: string;
  lcaLineStyle: string;
}

let currentSettings: GraphSettings = {
  nodeShape: "roundrectangle",
  edgeThickness: 2,
  arrowShape: "triangle",
  neLineStyle: "solid",
  lcaLineStyle: "dashed",
};

export const getGraphSettings = (): GraphSettings => currentSettings;

export const setGraphSettings = (settings: Partial<GraphSettings>) => {
  currentSettings = { ...currentSettings, ...settings };
};