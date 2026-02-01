export type QuizTarget = {
  name: string;
  path: string[];
};

export type QuizModeDefinition = {
  id: string;
  title: string;
  description: string;

  startScopeId?: string;
  loadPool: () => Promise<QuizTarget[]>;
};

export type QuizModeProvider = () => Promise<QuizModeDefinition[]>;
