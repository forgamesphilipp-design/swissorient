import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { QuizModeDefinition, QuizTarget } from "../types";

export function useQuizEngine(args: {
  mode: QuizModeDefinition | null;
  goTo: (id: string) => void;
  currentId: string;
}) {
  const { mode, goTo, currentId } = args;

  // ✅ stabile keys
  const modeKey = mode?.id ?? "";
  const startScopeId = mode?.startScopeId ?? "ch";

  // Pre-start
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);

  // Stopwatch
  const [elapsedSec, setElapsedSec] = useState(0);
  const elapsedRef = useRef(0);
  const tickIntervalRef = useRef<number | null>(null);

  const [pool, setPool] = useState<QuizTarget[]>([]);
  const [remaining, setRemaining] = useState<QuizTarget[]>([]);

  const [target, setTarget] = useState<QuizTarget | null>(null);
  const [step, setStep] = useState(0);

  const [flashId, setFlashId] = useState<string | null>(null);
  const [flashColor, setFlashColor] = useState<"red" | "green" | "blue" | null>(
    null
  );

  const lockRef = useRef(false);
  const nextTimeoutRef = useRef<number | null>(null);

  // currentId stabil halten
  const currentIdRef = useRef(currentId);
  useEffect(() => {
    currentIdRef.current = currentId;
  }, [currentId]);

  // Auto-Hint nach 3 Fehlern
  const wrongStreakRef = useRef(0);
  const hintIntervalRef = useRef<number | null>(null);

  // ✅ cleanup-sicher: timeouts/intervals tracken
  const flashTimeoutRef = useRef<number | null>(null);

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

  const softResetToStart = useCallback(() => {
    if (currentIdRef.current !== startScopeId) goTo(startScopeId);
  }, [goTo, startScopeId]);

  const keyOf = (t: QuizTarget) => `${t.name}::${t.path.join(">")}`;

  const pickRandom = (arr: QuizTarget[]) => {
    if (arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  };

  const stopHint = useCallback(() => {
    if (hintIntervalRef.current) {
      window.clearInterval(hintIntervalRef.current);
      hintIntervalRef.current = null;
    }
  }, []);

  const startHint = useCallback(
    (expectedId: string) => {
      stopHint();
      flash(expectedId, "blue");
      hintIntervalRef.current = window.setInterval(() => {
        flash(expectedId, "blue");
      }, 800);
    },
    [flash, stopHint]
  );

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

  // Public start (Button)
  const startQuiz = useCallback(() => {
    if (started || finished) return;
    setStarted(true);
    lockRef.current = false;
    wrongStreakRef.current = 0;
    stopHint();
    startStopwatch();
  }, [started, finished, stopHint, startStopwatch]);

  // ✅ Mode load: vorbereiten, aber NICHT starten
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
    lockRef.current = true; // 🔒 vor Start keine Klicks

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

        // ✅ beim Mode-Load einmal auf Start-Scope springen
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

      // ✅ harte cleanup
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

  // Wenn finished -> stop
  useEffect(() => {
    if (!finished) return;
    stopHint();
    stopStopwatch();
    lockRef.current = true;
  }, [finished, stopHint, stopStopwatch]);

  // Klick-Logik (nur wenn started)
  const onSelectNode = useCallback(
    (id: string) => {
      if (!target) return;
      if (!started) return;
      if (finished) return;
      if (lockRef.current) return;

      stopHint();

      const expected = target.path[step];
      const isLast = step >= target.path.length - 1;

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
      stopHint,
      flash,
      goTo,
      startHint,
      softResetToStart,
    ]
  );

  // Sobald gestartet wird, darf man klicken
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

    startQuiz,
    onSelectNode,
  };
}
