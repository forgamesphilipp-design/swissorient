import type { QuizModeDefinition } from "../types";

export const chCantonsMode: QuizModeDefinition = {
  id: "ch-cantons",
  title: "Kantone – Schweiz",
  description: "Finde den richtigen Kanton auf der Karte",

  async loadPool() {
    return [
      { name: "Zürich", path: ["1"] },
      { name: "Bern", path: ["2"] },
      { name: "Luzern", path: ["3"] },
      { name: "Uri", path: ["4"] },
      { name: "Schwyz", path: ["5"] },
      { name: "Obwalden", path: ["6"] },
      { name: "Nidwalden", path: ["7"] },
      { name: "Glarus", path: ["8"] },
      { name: "Zug", path: ["9"] },
      { name: "Fribourg", path: ["10"] },
      { name: "Solothurn", path: ["11"] },
      { name: "Basel-Stadt", path: ["12"] },
      { name: "Basel-Landschaft", path: ["13"] },
      { name: "Schaffhausen", path: ["14"] },
      { name: "Appenzell Ausserrhoden", path: ["15"] },
      { name: "Appenzell Innerrhoden", path: ["16"] },
      { name: "St. Gallen", path: ["17"] },
      { name: "Graubünden", path: ["18"] },
      { name: "Aargau", path: ["19"] },
      { name: "Thurgau", path: ["20"] },
      { name: "Tessin", path: ["21"] },
      { name: "Waadt", path: ["22"] },
      { name: "Wallis", path: ["23"] },
      { name: "Neuchâtel", path: ["24"] },
      { name: "Genève", path: ["25"] },
      { name: "Jura", path: ["26"] },
    ];
  },
};
