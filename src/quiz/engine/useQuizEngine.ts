import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { QuizModeDefinition, QuizTarget } from "../types";

export function useQuizEngine(args: {
  mode: QuizModeDefinition | null;
  goTo: (id: string) => void;
  currentId: string;
}) {
  const { mode, goTo, currentId } = args;

  const modeKey = mode?.id ?? "";
  const startScopeId = mode?.startScopeId ?? "ch";

  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);

  const [elapsedSec, setElapsedSec] = useState(0);
  const elapsedRef = useRef(0);
  const tickIntervalRef = useRef<number | null>(null);

  const [pool, setPool] = useState<QuizTarget[]>([]);
  const [remaining, setRemaining] = useState<QuizTarget[]>([]);

  const [target, setTarget] = useState<QuizTarget | null>(null);
  const [step, setStep] = useState(0);

  const [flashId, setFlashId] = useState<string | null>(null);
  const [flashColor, setFlashColor] = useState<"red" | "green" | "blue" | null>(null);

  const lockRef = useRef(false);
  const nextTimeoutRef = useRef<number | null>(null);

  const currentIdRef = useRef(currentId);
  useEffect(() => {
    currentIdRef.current = currentId;
  }, [currentId]);

  const wrongStreakRef = useRef(0);
  const hintIntervalRef = useRef<number | null>(null);
  const flashTimeoutRef = useRef<number | null>(null);

  // ✅ NEW: Hint Lock state (für UI / SVG)
  const [hintActive, setHintActive] = useState(false);
  const [hintExpectedId, setHintExpectedId] = useState<string | null>(null);

  const flash = useCallback((id: string, color: "red" | "green" | "blue") => {
    setFlashId(id);
    setFlashColor(color);

    if (flashTimeoutRef.current) window.clearTimeout(flashTimeoutRef.current);
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

  const keyOf = (t: QuizTarget) => `${t.name}::${t.path.join(">")}`;

  const pickRandom = (arr: QuizTarget[]) => {
    if (arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
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

  const startQuiz = useCallback(() => {
    if (started || finished) return;
    setStarted(true);
    lockRef.current = false;
    wrongStreakRef.current = 0;
    stopHint();
    startStopwatch();
  }, [started, finished, stopHint, startStopwatch]);

  useEffect(() => {
    if (!modeKey || !mode) return;

    let cancelled = false;

    stopHint();
    stopStopwatch();

    setStarted(false);
    setFinished(false);
    setElapsedSec(0);
    elapsedRef.current = 0;

    wrongStreakRef.current = 0;
    lockRef.current = true;

    if (nextTimeoutRef.current) window.clearTimeout(nextTimeoutRef.current);
    nextTimeoutRef.current = null;

    mode
      .loadPool()
      .then((p) => {
        if (cancelled) return;

        setPool(p);
        setRemaining(p);
        setTarget(pickRandom(p));
        setStep(0);

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

      if (nextTimeoutRef.current) {
        window.clearTimeout(nextTimeoutRef.current);
        nextTimeoutRef.current = null;
      }
      if (flashTimeoutRef.current) {
        window.clearTimeout(flashTimeoutRef.current);
        flashTimeoutRef.current = null;
      }
    };
  }, [modeKey, mode, softResetToStart, stopHint, stopStopwatch]);

  useEffect(() => {
    if (!finished) return;
    stopHint();
    stopStopwatch();
    lockRef.current = true;
  }, [finished, stopHint, stopStopwatch]);

  const onSelectNode = useCallback(
    (id: string) => {
      if (!target) return;
      if (!started) return;
      if (finished) return;
      if (lockRef.current) return;

      const expected = target.path[step];
      const isLast = step >= target.path.length - 1;

      // ✅ NEW RULE: Während Hint aktiv ist -> nur expected zulassen
      if (hintActive && hintExpectedId && id !== hintExpectedId) {
        // "simpel": ignorieren (kein unendlich falsch drücken)
        // optional: flash(id, "red");
        return;
      }

      // sobald irgendein gültiger Klick verarbeitet wird -> hint stop
      stopHint();

      if (id !== expected) {
        flash(id, "red");

        wrongStreakRef.current += 1;
        if (wrongStreakRef.current >= 3) {
          wrongStreakRef.current = 0;
          startHint(expected);
        }
        return;
      }

      wrongStreakRef.current = 0;

      if (!isLast) {
        goTo(id);
        setStep((s) => s + 1);
        return;
      }

      lockRef.current = true;
      flash(id, "green");

      setRemaining((prev) => {
        const solvedKey = keyOf(target);
        const nextRemaining = prev.filter((t) => keyOf(t) !== solvedKey);

        if (nextRemaining.length === 0) {
          if (nextTimeoutRef.current) window.clearTimeout(nextTimeoutRef.current);
          nextTimeoutRef.current = window.setTimeout(() => {
            setFinished(true);
          }, 650);
          return nextRemaining;
        }

        const nextTarget = pickRandom(nextRemaining);

        if (nextTimeoutRef.current) window.clearTimeout(nextTimeoutRef.current);
        nextTimeoutRef.current = window.setTimeout(() => {
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
      step,
      started,
      finished,
      hintActive,
      hintExpectedId,
      stopHint,
      flash,
      goTo,
      startHint,
      softResetToStart,
    ]
  );

  useEffect(() => {
    if (!started) return;
    if (finished) return;
    lockRef.current = false;
  }, [started, finished]);

  const progressTotal = pool.length;
  const progressDone = Math.max(0, pool.length - remaining.length);

  const elapsedText = useMemo(() => {
    const mm = String(Math.floor(elapsedSec / 60)).padStart(2, "0");
    const ss = String(elapsedSec % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }, [elapsedSec]);

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

    // ✅ export hint lock state for UI/SVG
    hintActive,
    hintExpectedId,

    startQuiz,
    onSelectNode,
  };
}
