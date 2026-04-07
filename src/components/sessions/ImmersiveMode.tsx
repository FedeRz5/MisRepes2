"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type {
  WorkoutSession,
  WorkoutSet,
  Exercise,
  RoutineExercise,
} from "@/types/database";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  Minus,
  Plus,
  SkipForward,
} from "lucide-react";
import PRCelebration from "@/components/sessions/PRCelebration";

/* ═══════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════ */

interface ExerciseGroup {
  exercise: Exercise;
  sets: WorkoutSet[];
  routineExercise?: RoutineExercise;
}

interface PRInfo {
  exerciseName: string;
  newWeight: number;
  previousWeight: number | null;
  type: "weight" | "1rm";
  estimated1RM?: number;
}

interface ImmersiveModeProps {
  exerciseGroups: ExerciseGroup[];
  session: WorkoutSession;
  onCompleteSet: (
    exerciseId: string,
    setIndex: number,
    weight: number,
    reps: number
  ) => void;
  onAddSet: (exerciseId: string) => void;
  onFinish: () => void;
  onExit: () => void;
  lastWeights: Map<string, number>;
  prCelebration: PRInfo | null;
  onDismissPR: () => void;
  checkForPR: (exerciseId: string, weight: number, reps: number) => PRInfo | null;
}

/* ═══════════════════════════════════════════════════════
   Circular Progress Ring
   ═══════════════════════════════════════════════════════ */

function CircularProgress({
  progress,
  size = 220,
  strokeWidth = 8,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - progress * circumference;

  return (
    <svg
      width={size}
      height={size}
      className="absolute inset-0 m-auto -rotate-90"
    >
      {/* Background ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--card-border)"
        strokeWidth={strokeWidth}
      />
      {/* Progress ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-[stroke-dashoffset] duration-1000 ease-linear"
      />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════
   Main ImmersiveMode Component
   ═══════════════════════════════════════════════════════ */

type ViewState =
  | { kind: "exercise" }
  | { kind: "setComplete"; setNum: number }
  | { kind: "rest"; seconds: number; total: number }
  | { kind: "exerciseComplete" };

export default function ImmersiveMode({
  exerciseGroups,
  session,
  onCompleteSet,
  onAddSet,
  onFinish,
  onExit,
  lastWeights,
  prCelebration,
  onDismissPR,
  checkForPR,
}: ImmersiveModeProps) {
  // ── Navigation state ──
  const [currentIdx, setCurrentIdx] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // ── View state ──
  const [viewState, setViewState] = useState<ViewState>({ kind: "exercise" });

  // ── Input state ──
  const [weight, setWeight] = useState(0);
  const [reps, setReps] = useState(0);
  const [selectedRpe, setSelectedRpe] = useState<number | null>(null);

  // ── Elapsed time ──
  const [elapsed, setElapsed] = useState("0:00:00");
  const sessionStart = useRef(Date.now());

  // ── Touch tracking ──
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchMoved = useRef(false);

  // ── Rest timer ──
  const restIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [restTimeLeft, setRestTimeLeft] = useState(0);
  const [restTotal, setRestTotal] = useState(0);

  // ── Set complete transition timer (ref avoids effect race conditions) ──
  const setCompleteTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Wake lock ──
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    async function requestWakeLock() {
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
        }
      } catch {
        // Not available
      }
    }
    requestWakeLock();
    return () => {
      wakeLockRef.current?.release();
      wakeLockRef.current = null;
      if (setCompleteTimerRef.current) {
        clearTimeout(setCompleteTimerRef.current);
      }
    };
  }, []);

  // ── Current group ──
  const group = exerciseGroups[currentIdx];
  const currentSetIdx = group
    ? group.sets.findIndex((s) => !s.completed)
    : -1;
  const currentSet = currentSetIdx >= 0 ? group.sets[currentSetIdx] : null;

  // ── Initialize inputs when exercise/set changes ──
  useEffect(() => {
    if (!group) return;
    const set = group.sets.find((s) => !s.completed);
    if (set) {
      const lw = lastWeights.get(group.exercise.id);
      setWeight(
        set.weight_kg > 0
          ? set.weight_kg
          : lw ?? group.routineExercise?.target_weight_kg ?? 0
      );
      setReps(set.reps > 0 ? set.reps : group.routineExercise?.target_reps ?? 10);
    }
    setSelectedRpe(null);
  }, [currentIdx, group, lastWeights, exerciseGroups]);

  // ── Elapsed timer ──
  useEffect(() => {
    function tick() {
      const total = Math.floor((Date.now() - sessionStart.current) / 1000);
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      setElapsed(
        `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
      );
    }
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  // ── Rest timer countdown ──
  useEffect(() => {
    if (viewState.kind !== "rest") return;
    setRestTimeLeft(viewState.seconds);
    setRestTotal(viewState.total);

    restIntervalRef.current = setInterval(() => {
      setRestTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(restIntervalRef.current!);
          restIntervalRef.current = null;
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      if (restIntervalRef.current) {
        clearInterval(restIntervalRef.current);
        restIntervalRef.current = null;
      }
    };
  }, [viewState]);

  // ── When rest timer reaches 0 ──
  useEffect(() => {
    if (viewState.kind === "rest" && restTimeLeft === 0) {
      // Vibrate
      try {
        navigator.vibrate?.([200, 100, 200, 100, 400]);
      } catch {
        // Not available
      }
      // Return to exercise after a beat
      setTimeout(() => {
        setViewState({ kind: "exercise" });
      }, 400);
    }
  }, [viewState.kind, restTimeLeft]);

  // ── Auto-advance after exercise complete ──
  useEffect(() => {
    if (viewState.kind !== "exerciseComplete") return;
    const timeout = setTimeout(() => {
      if (currentIdx < exerciseGroups.length - 1) {
        navigateTo(currentIdx + 1);
      }
      setViewState({ kind: "exercise" });
    }, 1500);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewState.kind]);

  // Note: setComplete → rest transition is handled directly in handleCompleteSet
  // using setCompleteTimerRef to avoid effect-based race conditions.

  // ── Navigation ──
  const navigateTo = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= exerciseGroups.length || idx === currentIdx)
        return;
      // Cancel any pending set-complete → rest transition
      if (setCompleteTimerRef.current) {
        clearTimeout(setCompleteTimerRef.current);
        setCompleteTimerRef.current = null;
      }
      const direction = idx > currentIdx ? -1 : 1;
      setIsAnimating(true);
      setTranslateX(direction * 100);
      setTimeout(() => {
        setCurrentIdx(idx);
        setTranslateX(0);
        setIsAnimating(false);
        setViewState({ kind: "exercise" });
      }, 250);
    },
    [currentIdx, exerciseGroups.length]
  );

  // ── Touch handlers ──
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchMoved.current = false;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      touchMoved.current = true;
      if (dx < 0) {
        // swipe left -> next
        navigateTo(currentIdx + 1);
      } else {
        // swipe right -> prev
        navigateTo(currentIdx - 1);
      }
    }
  }

  // ── Complete set ──
  function handleCompleteSet() {
    if (!group || !currentSet) return;
    onCompleteSet(group.exercise.id, currentSetIdx, weight, reps);
    // Check for PR
    checkForPR(group.exercise.id, weight, reps);

    // Check if all sets are now done (current was the last incomplete)
    const remainingAfter = group.sets.filter(
      (s, i) => !s.completed && i !== currentSetIdx
    ).length;

    if (remainingAfter === 0) {
      setViewState({ kind: "exerciseComplete" });
    } else {
      // Use ref-based timer to avoid effect race conditions.
      // This ensures the rest timer always appears after the flash,
      // regardless of parent re-renders or other state updates.
      const restSecs = group.routineExercise?.rest_seconds ?? 90;
      setViewState({ kind: "setComplete", setNum: currentSet.set_number });
      if (setCompleteTimerRef.current) clearTimeout(setCompleteTimerRef.current);
      setCompleteTimerRef.current = setTimeout(() => {
        setViewState({ kind: "rest", seconds: restSecs, total: restSecs });
        setCompleteTimerRef.current = null;
      }, 1200);
    }
  }

  // ── Skip rest ──
  function skipRest() {
    if (restIntervalRef.current) {
      clearInterval(restIntervalRef.current);
      restIntervalRef.current = null;
    }
    setViewState({ kind: "exercise" });
  }

  // ── Target info string ──
  function getTargetInfo(): string {
    if (!group) return "";
    const re = group.routineExercise;
    if (!re) return `${group.sets.length} series`;
    const w = re.target_weight_kg;
    return `${re.target_sets}\u00d7${re.target_reps}${w ? ` @ ${w}kg` : ""}`;
  }

  // ── Render helpers ──
  if (!group) return null;

  const completedCount = group.sets.filter((s) => s.completed).length;
  const totalCount = group.sets.length;
  const allDone = totalCount > 0 && completedCount === totalCount;

  /* ═══════════════════════════════════════════════════════
     REST TIMER VIEW
     ═══════════════════════════════════════════════════════ */
  if (viewState.kind === "rest") {
    const restProgress =
      restTotal > 0 ? (restTotal - restTimeLeft) / restTotal : 1;
    const restMin = Math.floor(restTimeLeft / 60);
    const restSec = restTimeLeft % 60;

    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background overflow-hidden">
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3">
          <button
            onClick={onExit}
            className="rounded-xl p-3 text-muted hover:bg-card-bg transition-colors cursor-pointer"
          >
            <X className="h-6 w-6" />
          </button>
          <span className="text-sm font-medium text-muted tabular-nums">
            {elapsed}
          </span>
          <div className="w-12" />
        </div>

        {/* Label */}
        <p className="mb-6 text-xs font-semibold uppercase tracking-widest text-muted">
          Descanso
        </p>

        {/* Circular timer */}
        <div className="relative flex items-center justify-center" style={{ width: 220, height: 220 }}>
          <CircularProgress progress={restProgress} />
          <div className="z-10 text-center">
            <span className="text-7xl font-black tabular-nums text-foreground leading-none">
              {restMin > 0 && (
                <>
                  {restMin}
                  <span className="text-4xl text-muted">:</span>
                </>
              )}
              {restSec.toString().padStart(2, "0")}
            </span>
          </div>
        </div>

        {/* Skip button */}
        <button
          onClick={skipRest}
          className="mt-10 flex items-center gap-2 rounded-2xl bg-card-bg px-8 py-4 text-base font-bold text-foreground transition-colors hover:bg-card-border cursor-pointer"
        >
          <SkipForward className="h-5 w-5" />
          SALTAR
        </button>

        {/* Next exercise preview */}
        <p className="mt-6 text-sm text-muted">
          {group.exercise.name} &mdash; Serie {completedCount + 1}/{totalCount}
        </p>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════
     SET COMPLETE FLASH
     ═══════════════════════════════════════════════════════ */
  if (viewState.kind === "setComplete") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background overflow-hidden">
        <div className="animate-[bounceIn_0.5s_ease-out]">
          <div
            className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full"
            style={{ backgroundColor: "color-mix(in srgb, var(--success) 20%, transparent)" }}
          >
            <Check
              className="h-14 w-14"
              style={{ color: "var(--success)" }}
              strokeWidth={3}
            />
          </div>
          <p className="text-center text-2xl font-bold text-foreground">
            Serie {viewState.setNum} completada
          </p>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════
     EXERCISE COMPLETE FLASH
     ═══════════════════════════════════════════════════════ */
  if (viewState.kind === "exerciseComplete") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background overflow-hidden">
        <div className="animate-[bounceIn_0.5s_ease-out]">
          <div
            className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full"
            style={{ backgroundColor: "color-mix(in srgb, var(--success) 20%, transparent)" }}
          >
            <Check
              className="h-14 w-14"
              style={{ color: "var(--success)" }}
              strokeWidth={3}
            />
          </div>
          <p className="text-center text-2xl font-bold text-foreground">
            EJERCICIO COMPLETADO
          </p>
          <p className="mt-2 text-center text-sm text-muted">
            {group.exercise.name}
          </p>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════
     MAIN EXERCISE VIEW
     ═══════════════════════════════════════════════════════ */
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background overflow-hidden select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ─── Top Bar ─── */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <button
          onClick={onExit}
          className="rounded-xl p-3 text-muted hover:bg-card-bg transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <X className="h-6 w-6" />
        </button>
        <span className="text-sm font-medium text-muted tabular-nums">
          {elapsed}
        </span>
        <button
          onClick={onFinish}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:opacity-90 cursor-pointer min-h-[44px]"
        >
          Finalizar
        </button>
      </div>

      {/* ─── Exercise indicator ─── */}
      <div className="flex-shrink-0 px-4">
        {/* Exercise step dots */}
        <div className="flex items-center justify-center gap-1.5">
          {exerciseGroups.map((_, i) => (
            <button
              key={i}
              onClick={() => navigateTo(i)}
              className={`rounded-full transition-all cursor-pointer ${
                i === currentIdx
                  ? "h-2 w-6 bg-primary"
                  : "h-2 w-2 bg-card-border hover:bg-muted"
              }`}
            />
          ))}
        </div>
        <p className="mt-1 text-center text-[10px] font-semibold uppercase tracking-widest text-muted">
          Ejercicio {currentIdx + 1} de {exerciseGroups.length}
          {exerciseGroups.length > 1 && (
            <span className="ml-2 opacity-60">· deslizá para navegar</span>
          )}
        </p>
      </div>

      {/* ─── Main content with swipe animation ─── */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-6"
        style={{
          transform: `translateX(${translateX}%)`,
          transition: isAnimating ? "transform 0.25s ease-out" : "none",
        }}
      >
        {/* Exercise name */}
        <h2 className="text-2xl font-bold text-foreground text-center leading-tight">
          {group.exercise.name}
        </h2>

        {/* Target info */}
        <p className="mt-1 text-sm text-muted">{getTargetInfo()}</p>

        {/* Progress dots */}
        <div className="mt-4 flex items-center gap-2">
          {group.sets.map((s, i) => (
            <div
              key={s.id}
              className={`h-3 w-3 rounded-full transition-colors ${
                s.completed
                  ? "bg-[color:var(--success)]"
                  : i === currentSetIdx
                  ? "bg-primary ring-2 ring-primary/30"
                  : "bg-card-border"
              }`}
            />
          ))}
        </div>

        {allDone ? (
          /* All sets completed message */
          <div className="mt-8 text-center">
            <div
              className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: "color-mix(in srgb, var(--success) 20%, transparent)" }}
            >
              <Check className="h-8 w-8" style={{ color: "var(--success)" }} />
            </div>
            <p className="text-lg font-bold text-foreground">
              Todas las series completadas
            </p>
            <button
              onClick={() => onAddSet(group.exercise.id)}
              className="mt-4 flex items-center gap-2 mx-auto rounded-xl bg-card-bg px-5 py-3 text-sm font-semibold text-primary transition-colors hover:bg-card-border cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Agregar serie extra
            </button>
          </div>
        ) : (
          /* ─── Current Set Input ─── */
          <>
            {/* Weight & Reps inputs */}
            <div className="mt-8 flex items-stretch gap-4 w-full max-w-xs">
              {/* Weight */}
              <div className="flex-1 rounded-2xl bg-card-bg p-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-2">
                  Peso (kg)
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setWeight((w) => Math.max(0, w - 2.5))}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-card-border text-foreground transition-colors hover:bg-primary/20 cursor-pointer"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={weight}
                    onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
                    className="w-20 bg-transparent text-center text-3xl font-black text-foreground outline-none tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() => setWeight((w) => w + 2.5)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-card-border text-foreground transition-colors hover:bg-primary/20 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Reps */}
              <div className="flex-1 rounded-2xl bg-card-bg p-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-2">
                  Reps
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setReps((r) => Math.max(0, r - 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-card-border text-foreground transition-colors hover:bg-primary/20 cursor-pointer"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={reps}
                    onChange={(e) => setReps(parseInt(e.target.value) || 0)}
                    className="w-16 bg-transparent text-center text-3xl font-black text-foreground outline-none tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() => setReps((r) => r + 1)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-card-border text-foreground transition-colors hover:bg-primary/20 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* RPE selector */}
            <div className="mt-5 w-full max-w-xs">
              <p className="text-center text-[10px] font-semibold uppercase tracking-widest text-muted mb-2">
                RPE (opcional)
              </p>
              <div className="flex items-center justify-center gap-1.5">
                {[6, 7, 8, 9, 10].map((val) => (
                  <button
                    key={val}
                    onClick={() =>
                      setSelectedRpe(selectedRpe === val ? null : val)
                    }
                    className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                      selectedRpe === val
                        ? "bg-primary text-white"
                        : "bg-card-bg text-muted hover:bg-card-border hover:text-foreground"
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>

            {/* Complete button */}
            <button
              onClick={handleCompleteSet}
              className="mt-8 w-full max-w-xs h-16 rounded-2xl text-lg font-bold text-white transition-all active:scale-[0.97] cursor-pointer"
              style={{ backgroundColor: "var(--success)" }}
            >
              COMPLETAR SERIE
            </button>
          </>
        )}
      </div>

      {/* ─── Side navigation arrows ─── */}
      {exerciseGroups.length > 1 && (
        <>
          <button
            onClick={() => navigateTo(currentIdx - 1)}
            disabled={currentIdx === 0}
            className="absolute left-2 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-card-bg/80 text-muted backdrop-blur-sm transition-colors hover:bg-card-border hover:text-foreground cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => navigateTo(currentIdx + 1)}
            disabled={currentIdx === exerciseGroups.length - 1}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-card-bg/80 text-muted backdrop-blur-sm transition-colors hover:bg-card-border hover:text-foreground cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* ─── Bottom safe area spacer ─── */}
      <div className="h-6 flex-shrink-0" />

      {/* ─── PR Celebration ─── */}
      {prCelebration && (
        <PRCelebration
          exerciseName={prCelebration.exerciseName}
          newWeight={prCelebration.newWeight}
          previousWeight={prCelebration.previousWeight}
          type={prCelebration.type}
          estimated1RM={prCelebration.estimated1RM}
          onDismiss={onDismissPR}
        />
      )}
    </div>
  );
}
