import type { Node } from "../types/Node";

export const baseNodes: Record<string, Node> = {
  ch: {
    id: "ch",
    name: "Schweiz",
    level: "country",
    parentId: null,
    childrenIds: [
      "1","2","3","4","5","6","7","8","9","10",
      "11","12","13","14","15","16","17","18","19","20",
      "21","22","23","24","25","26"
    ]
  },

  "1":  { id:"1",  name:"Kanton Zürich",                 level:"canton", parentId:"ch", childrenIds:[] },
  "2":  { id:"2",  name:"Kanton Bern",                   level:"canton", parentId:"ch", childrenIds:[] },
  "3":  { id:"3",  name:"Kanton Luzern",                 level:"canton", parentId:"ch", childrenIds:[] },
  "4":  { id:"4",  name:"Kanton Uri",                    level:"canton", parentId:"ch", childrenIds:[] },
  "5":  { id:"5",  name:"Kanton Schwyz",                 level:"canton", parentId:"ch", childrenIds:[] },
  "6":  { id:"6",  name:"Kanton Obwalden",               level:"canton", parentId:"ch", childrenIds:[] },
  "7":  { id:"7",  name:"Kanton Nidwalden",              level:"canton", parentId:"ch", childrenIds:[] },
  "8":  { id:"8",  name:"Kanton Glarus",                 level:"canton", parentId:"ch", childrenIds:[] },
  "9":  { id:"9",  name:"Kanton Zug",                    level:"canton", parentId:"ch", childrenIds:[] },
  "10": { id:"10", name:"Kanton Fribourg",               level:"canton", parentId:"ch", childrenIds:[] },
  "11": { id:"11", name:"Kanton Solothurn",              level:"canton", parentId:"ch", childrenIds:[] },
  "12": { id:"12", name:"Kanton Basel-Stadt",            level:"canton", parentId:"ch", childrenIds:[] },
  "13": { id:"13", name:"Kanton Basel-Landschaft",       level:"canton", parentId:"ch", childrenIds:[] },
  "14": { id:"14", name:"Kanton Schaffhausen",           level:"canton", parentId:"ch", childrenIds:[] },
  "15": { id:"15", name:"Kanton Appenzell Ausserrhoden", level:"canton", parentId:"ch", childrenIds:[] },
  "16": { id:"16", name:"Kanton Appenzell Innerrhoden",  level:"canton", parentId:"ch", childrenIds:[] },
  "17": { id:"17", name:"Kanton St. Gallen",             level:"canton", parentId:"ch", childrenIds:[] },
  "18": { id:"18", name:"Kanton Graubünden",             level:"canton", parentId:"ch", childrenIds:[] },
  "19": { id:"19", name:"Kanton Aargau",                 level:"canton", parentId:"ch", childrenIds:[] },
  "20": { id:"20", name:"Kanton Thurgau",                level:"canton", parentId:"ch", childrenIds:[] },
  "21": { id:"21", name:"Kanton Tessin",                 level:"canton", parentId:"ch", childrenIds:[] },
  "22": { id:"22", name:"Kanton Waadt",                  level:"canton", parentId:"ch", childrenIds:[] },
  "23": { id:"23", name:"Kanton Wallis",                 level:"canton", parentId:"ch", childrenIds:[] },
  "24": { id:"24", name:"Kanton Neuchâtel",              level:"canton", parentId:"ch", childrenIds:[] },
  "25": { id:"25", name:"Kanton Genève",                 level:"canton", parentId:"ch", childrenIds:[] },
  "26": { id:"26", name:"Kanton Jura",                   level:"canton", parentId:"ch", childrenIds:[] }
};
