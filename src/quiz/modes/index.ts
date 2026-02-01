import type { QuizModeDefinition } from "../types";
import { chCantonsMode } from "./ch-cantons";
import { chCommunitiesMode } from "./ch-communities";
import { loadDistrictModesForCantons } from "./ch-districts";

let cachedModes: QuizModeDefinition[] | null = null;

export async function getQuizModes(): Promise<QuizModeDefinition[]> {
  if (cachedModes) return cachedModes;

  const districtModes = await loadDistrictModesForCantons();

  cachedModes = [
    chCantonsMode,
    chCommunitiesMode,
    ...districtModes,
  ];

  return cachedModes;
}

export async function getQuizMode(id: string): Promise<QuizModeDefinition | undefined> {
  const modes = await getQuizModes();
  return modes.find((m) => m.id === id);
}
