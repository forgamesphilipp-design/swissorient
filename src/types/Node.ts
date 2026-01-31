export type Level = "country" | "canton" | "district";

export interface Node {
  id: string;
  name: string;
  level: Level;
  parentId: string | null;
  childrenIds: string[];
}
