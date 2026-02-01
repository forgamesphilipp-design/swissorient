import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { QuizModeDefinition, QuizTarget } from "../types";

type LockedFill = Record<string, "white" | "yellow" | "orange" | "red">;
type FlashColor = "red" | "green" | "blue";

export function useQuizEngine(args: {
  mode: QuizModeDefinition | null;
  goTo: (id: string) => void;
  currentId: string;
}) {
  const { mode, goTo, currentId } = args;

  const modeKey = mode?.id ?? "";
  const startScopeId = mode?.startScopeId ?? "ch";

  // ---------- Core quiz state ----------
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);

  const [pool, setPool] = useState<QuizTarget[]>([]);
  const [remaining, setRemaining] = useState<QuizTarget[]>([]);
  const [target, setTarget] = useState<QuizTarget | null>(null);
  const [step, setStep] = useState(0);

  // ---------- Timer ----------
  const [elapsedSec, setElapsedSec] = useState(0);
  const elapsedRef = useRef(0);
  const tickIntervalRef = useRef<number | null>(null);

  // ---------- UI effects ----------
  const [flashId, setFlashId] = useState<string | null>(null);
  const [flashColor, setFlashColor] = useState<FlashColor | null>(null);
  const flashTimeoutRef = useRef<number | null>(null);

  // ---------- Locking / scheduling ----------
  const lockRef = useRef(false);
  const nextTimeoutRef = useRef<number | null>(null);

  // currentId as ref (stable callbacks)
  const currentIdRef = useRef(currentId);
  useEffect(() => {
    currentIdRef.current = currentId;
  }, [currentId]);

  // ---------- Wrong / hint logic ----------
  const wrongStreakRef = useRef(0);
  const wrongAttemptsThisStepRef = useRef(0);
  const hintUsedThisStepRef = useRef(false);

  const hintIntervalRef = useRef<number | null>(null);
  const [hintActive, setHintActive] = useState(false);
  const [hintExpectedId, setHintExpectedId] = useState<string | null>(null);

  // ---------- Permanent “logged” fields ----------
  const [lockedFills, setLockedFills] = useState<LockedFill>({});

  // ---------- Helpers ----------
  const keyOf = (t: QuizTarget) => `${t.name}::${t.path.join(">")}`;

  const pickRandom = (arr: QuizTarget[]) => {
    if (arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  };

  const clearNextTimeout = () => {
    if (nextTimeoutRef.current) {
      window.clearTimeout(nextTimeoutRef.current);
      nextTimeoutRef.current = null;
    }
  };

  const clearFlashTimeout = () => {
    if (flashTimeoutRef.current) {
      window.clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = null;
    }
  };

  const resetStepRating = () => {
    wrongAttemptsThisStepRef.current = 0;
    hintUsedThisStepRef.current = false;
  };

  const stopStopwatch = useCallback(() => {
    if (tickIntervalRef.current) {
      window.clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
  }, []);

  const startStopwatch = useCallback(() => {
    stopStopwatch();
    elapsedRef.current = 0;
    setElapsedSec(0);

    tickIntervalRef.current = window.setInterval(() => {
      elapsedRef.current += 1;
      setElapsedSec(elapsedRef.current);
    }, 1000);
  }, [stopStopwatch]);

  const flash = useCallback((id: string, color: FlashColor) => {
    setFlashId(id);
    setFlashColor(color);

    clearFlashTimeout();
    flashTimeoutRef.current = window.setTimeout(() => {
      setFlashId(null);
      setFlashColor(null);
      flashTimeoutRef.current = null;
    }, 450);
  }, []);

  const stopHint = useCallback(() => {
    if (hintIntervalRef.current) {
      window.clearInterval(hintIntervalRef.current);
      hintIntervalRef.current = null;
    }
    setHintActive(false);
    setHintExpectedId(null);
  }, []);

  const startHint = useCallback(
    (expectedId: string) => {
      // “erst nach Tipp: rot”
      hintUsedThisStepRef.current = true;

      stopHint();
      setHintActive(true);
      setHintExpectedId(expectedId);

      flash(expectedId, "blue");
      hintIntervalRef.current = window.setInterval(() => {
        flash(expectedId, "blue");
      }, 800);
    },
    [flash, stopHint]
  );

  const softResetToStart = useCallback(() => {
    if (currentIdRef.current !== startScopeId) goTo(startScopeId);
  }, [goTo, startScopeId]);

  const solveColorForStep = (): "white" | "yellow" | "orange" | "red" => {
    if (hintUsedThisStepRef.current) return "red";
    const w = wrongAttemptsThisStepRef.current;
    if (w <= 0) return "white";
    if (w === 1) return "yellow";
    return "orange";
  };

  // ---------- Derived stats ----------
  const progressTotal = pool.length;
  const progressDone = Math.max(0, pool.length - remaining.length);

  const whiteCount = useMemo(() => {
    let c = 0;
    for (const k of Object.keys(lockedFills)) {
      if (lockedFills[k] === "white") c += 1;
    }
    return c;
  }, [lockedFills]);

  const skillPercent = useMemo(() => {
    if (!progressTotal) return 0;
    return Math.round((whiteCount / progressTotal) * 100);
  }, [whiteCount, progressTotal]);

  const elapsedText = useMemo(() => {
    const mm = String(Math.floor(elapsedSec / 60)).padStart(2, "0");
    const ss = String(elapsedSec % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }, [elapsedSec]);

  // ---------- Public actions ----------
  const startQuiz = useCallback(() => {
    if (started || finished) return;

    setStarted(true);
    lockRef.current = false;
    wrongStreakRef.current = 0;

    resetStepRating();
    stopHint();
    startStopwatch();
  }, [started, finished, stopHint, startStopwatch]);

  const onSelectNode = useCallback(
    (id: string) => {
      if (!target) return;
      if (!started) return;
      if (finished) return;
      if (lockRef.current) return;

      // geloggte Felder sind tot
      if (lockedFills[id]) return;

      const expected = target.path[step];
      const isLast = step >= target.path.length - 1;

      // Während Hint aktiv: nur expected
      if (hintActive && hintExpectedId && id !== hintExpectedId) return;

      // Klick wird verarbeitet → hint stop (aber hintUsed bleibt ggf. true)
      stopHint();

      // falsch
      if (id !== expected) {
        flash(id, "red");

        wrongStreakRef.current += 1;
        wrongAttemptsThisStepRef.current += 1;

        if (wrongStreakRef.current >= 3) {
          wrongStreakRef.current = 0;
          startHint(expected);
        }
        return;
      }

      // richtig
      wrongStreakRef.current = 0;

      // noch nicht final → weiter navigieren
      if (!isLast) {
        resetStepRating();
        goTo(id);
        setStep((s) => s + 1);
        return;
      }

      // final richtig → loggen + nicht mehr klickbar
      lockRef.current = true;

      const fill = solveColorForStep();
      setLockedFills((prev) => ({ ...prev, [id]: fill }));

      setRemaining((prev) => {
        const solvedKey = keyOf(target);
        const nextRemaining = prev.filter((t) => keyOf(t) !== solvedKey);

        // fertig
        if (nextRemaining.length === 0) {
          clearNextTimeout();
          nextTimeoutRef.current = window.setTimeout(() => {
            setFinished(true);
          }, 650);
          return nextRemaining;
        }

        // nächstes Ziel
        const nextTarget = pickRandom(nextRemaining);

        clearNextTimeout();
        nextTimeoutRef.current = window.setTimeout(() => {
          resetStepRating();
          setTarget(nextTarget);
          setStep(0);
          softResetToStart();
          lockRef.current = false;
          nextTimeoutRef.current = null;
        }, 650);

        return nextRemaining;
      });
    },
    [
      target,
      started,
      finished,
      step,
      lockedFills,
      hintActive,
      hintExpectedId,
      stopHint,
      flash,
      goTo,
      startHint,
      softResetToStart,
    ]
  );

  // ---------- Mode changes ----------
  useEffect(() => {
    if (!modeKey || !mode) return;

    let cancelled = false;

    stopHint();
    stopStopwatch();

    setStarted(false);
    setFinished(false);

    elapsedRef.current = 0;
    setElapsedSec(0);

    wrongStreakRef.current = 0;
    lockRef.current = true;

    setLockedFills({});
    resetStepRating();

    clearNextTimeout();
    clearFlashTimeout();

    mode
      .loadPool()
      .then((p) => {
        if (cancelled) return;

        setPool(p);
        setRemaining(p);

        const first = pickRandom(p);
        setTarget(first);
        setStep(0);

        resetStepRating();
        softResetToStart();
      })
      .catch(() => {
        if (cancelled) return;
        setPool([]);
        setRemaining([]);
        setTarget(null);
        setStep(0);
      });

    return () => {
      cancelled = true;
      stopHint();
      stopStopwatch();
      clearNextTimeout();
      clearFlashTimeout();
    };
  }, [modeKey, mode, softResetToStart, stopHint, stopStopwatch]);

  // finished → lock + timer stop
  useEffect(() => {
    if (!finished) return;
    stopHint();
    stopStopwatch();
    lockRef.current = true;
  }, [finished, stopHint, stopStopwatch]);

  // started (and not finished) → unlock
  useEffect(() => {
    if (!started) return;
    if (finished) return;
    lockRef.current = false;
  }, [started, finished]);

  return {
    started,
    finished,

    elapsedSec,
    elapsedText,

    progressDone,
    progressTotal,

    target,
    step,

    flashId,
    flashColor,

    hintActive,
    hintExpectedId,

    lockedFills,

    whiteCount,
    skillPercent,

    startQuiz,
    onSelectNode,
  };
}
