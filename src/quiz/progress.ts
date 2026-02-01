export type QuizBest = {
    percent: number;   // 0..100 (nur weiss zählt)
    timeSec: number;   // benötigte Zeit
  };
  
  function storageKey(modeId: string) {
    return `swissorients:quizbest:${modeId}`;
  }
  
  export function loadQuizBest(modeId: string): QuizBest | null {
    try {
      const raw = localStorage.getItem(storageKey(modeId));
      if (!raw) return null;
      const obj = JSON.parse(raw);
      const percent = Number(obj?.percent);
      const timeSec = Number(obj?.timeSec);
      if (!Number.isFinite(percent) || !Number.isFinite(timeSec)) return null;
      return { percent, timeSec };
    } catch {
      return null;
    }
  }
  
  export function saveQuizBestIfBetter(modeId: string, next: QuizBest) {
    const prev = loadQuizBest(modeId);
  
    const isBetter =
      !prev ||
      next.percent > prev.percent ||
      (next.percent === prev.percent && next.timeSec < prev.timeSec);
  
    if (!isBetter) return;
  
    try {
      localStorage.setItem(storageKey(modeId), JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  
  export function formatTimeMMSS(sec: number) {
    const s = Math.max(0, Math.floor(sec));
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }
  