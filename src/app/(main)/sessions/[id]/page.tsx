"use client";

import { use, useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type {
  WorkoutSession,
  WorkoutSet,
  Exercise,
  RoutineExercise,
} from "@/types/database";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  CheckCircle,
  Circle,
  Plus,
  Trash2,
  Timer,
  Play,
  Pause,
  SkipForward,
  Volume2,
  VolumeX,
  ArrowLeft,
  Trophy,
  Dumbbell,
  ChevronDown,
  ChevronRight,
  Search,
  Minus,
  Zap,
  Weight,
  Target,
  Clock,
  Star,
  Maximize2,
} from "lucide-react";
import ImmersiveMode from "@/components/sessions/ImmersiveMode";
import { usePRDetection } from "@/lib/usePRDetection";
import PRCelebration from "@/components/sessions/PRCelebration";

/* ═══════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════ */

interface ExerciseGroup {
  exercise: Exercise;
  sets: WorkoutSet[];
  routineExercise?: RoutineExercise;
}

interface SessionSummary {
  totalSets: number;
  completedSets: number;
  totalVolume: number;
  exerciseCount: number;
  duration: number;
  perExercise: {
    name: string;
    sets: number;
    volume: number;
    bestWeight: number;
  }[];
}

/* ═══════════════════════════════════════════════════════
   Loading Skeleton
   ═══════════════════════════════════════════════════════ */

function SessionSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* Top bar skeleton */}
      <div className="flex items-center gap-3 animate-pulse">
        <div className="h-10 w-10 rounded-lg bg-card-border" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-48 rounded bg-card-border" />
          <div className="h-3 w-32 rounded bg-card-border" />
        </div>
        <div className="h-9 w-24 rounded-lg bg-card-border" />
      </div>
      {/* Exercise cards skeleton */}
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <div className="animate-pulse space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-card-border" />
              <div className="space-y-1.5 flex-1">
                <div className="h-4 w-36 rounded bg-card-border" />
                <div className="h-3 w-24 rounded bg-card-border" />
              </div>
            </div>
            <div className="space-y-2">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-10 rounded bg-card-border/50" />
              ))}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Rest Timer (Floating Bottom Bar)
   ═══════════════════════════════════════════════════════ */

function RestTimer({
  defaultSeconds,
  onDismiss,
}: {
  defaultSeconds: number;
  onDismiss: () => void;
}) {
  const [totalSeconds, setTotalSeconds] = useState(defaultSeconds);
  const [timeLeft, setTimeLeft] = useState(defaultSeconds);
  const [paused, setPaused] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasPlayedRef = useRef(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Wake Lock: keep screen on while timer is active
  useEffect(() => {
    async function requestWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        }
      } catch {
        // Wake Lock not available or denied
      }
    }
    requestWakeLock();
    return () => {
      wakeLockRef.current?.release();
      wakeLockRef.current = null;
    };
  }, []);

  // Adjust time
  function adjustTime(delta: number) {
    setTotalSeconds((t) => Math.max(10, t + delta));
    setTimeLeft((t) => Math.max(0, t + delta));
  }

  useEffect(() => {
    if (paused || timeLeft <= 0) return;
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(intervalRef.current!);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [paused, timeLeft]);

  // Play beep when timer reaches 0
  useEffect(() => {
    if (timeLeft === 0 && soundEnabled && !hasPlayedRef.current) {
      hasPlayedRef.current = true;
      playBeep();
    }
  }, [timeLeft, soundEnabled]);

  function playBeep() {
    try {
      const ctx = new AudioContext();
      // First beep
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.frequency.value = 880;
      gain1.gain.setValueAtTime(0.4, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.25);
      // Second beep (higher)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = 1100;
      gain2.gain.setValueAtTime(0.4, ctx.currentTime + 0.3);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc2.start(ctx.currentTime + 0.3);
      osc2.stop(ctx.currentTime + 0.6);
      // Third beep (highest, longer)
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.frequency.value = 1320;
      gain3.gain.setValueAtTime(0.5, ctx.currentTime + 0.65);
      gain3.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.1);
      osc3.start(ctx.currentTime + 0.65);
      osc3.stop(ctx.currentTime + 1.1);
    } catch {
      // Audio not available
    }
  }

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const progress =
    totalSeconds > 0 ? ((totalSeconds - timeLeft) / totalSeconds) * 100 : 100;
  const isFinished = timeLeft === 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t-2 border-[color:var(--primary)] bg-card-bg/95 backdrop-blur-md lg:left-60 shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
      {/* Progress bar at the very top of the floating bar */}
      <div className="h-1 w-full bg-card-border overflow-hidden">
        <div
          className="h-full transition-all duration-1000 ease-linear"
          style={{
            width: `${progress}%`,
            backgroundColor: isFinished ? "var(--success)" : "var(--primary)",
          }}
        />
      </div>

      <div className="mx-auto max-w-4xl px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          {/* Left: Timer display */}
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${
                isFinished
                  ? "bg-[var(--success)]/20 text-[color:var(--success)]"
                  : "bg-primary/20 text-primary"
              }`}
            >
              <Timer className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                Descanso
              </div>
              <div
                className={`text-3xl font-black tabular-nums leading-tight sm:text-4xl ${
                  isFinished
                    ? "text-[color:var(--success)] animate-pulse"
                    : "text-foreground"
                }`}
              >
                {minutes}:{seconds.toString().padStart(2, "0")}
              </div>
            </div>
          </div>

          {/* Center: Time adjust buttons (hidden on small) */}
          <div className="hidden sm:flex items-center gap-1">
            <button
              onClick={() => adjustTime(-15)}
              className="rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-card-border hover:text-foreground cursor-pointer"
            >
              -15s
            </button>
            <button
              onClick={() => adjustTime(15)}
              className="rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-card-border hover:text-foreground cursor-pointer"
            >
              +15s
            </button>
            <button
              onClick={() => adjustTime(30)}
              className="rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-card-border hover:text-foreground cursor-pointer"
            >
              +30s
            </button>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="rounded-lg p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted hover:bg-card-border hover:text-foreground cursor-pointer"
              title={soundEnabled ? "Silenciar" : "Activar sonido"}
            >
              {soundEnabled ? (
                <Volume2 className="h-5 w-5" />
              ) : (
                <VolumeX className="h-5 w-5" />
              )}
            </button>
            {!isFinished && (
              <button
                onClick={() => setPaused(!paused)}
                className="rounded-lg p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted hover:bg-card-border hover:text-foreground cursor-pointer"
                title={paused ? "Reanudar" : "Pausar"}
              >
                {paused ? (
                  <Play className="h-5 w-5" />
                ) : (
                  <Pause className="h-5 w-5" />
                )}
              </button>
            )}
            <button
              onClick={onDismiss}
              className="rounded-lg p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted hover:bg-card-border hover:text-foreground cursor-pointer"
              title="Saltar"
            >
              <SkipForward className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Set Row Component
   ═══════════════════════════════════════════════════════ */

function SetRow({
  set,
  disabled,
  lastWeight,
  onUpdate,
  onComplete,
  onUncomplete,
  onDelete,
}: {
  set: WorkoutSet;
  disabled: boolean;
  lastWeight?: number;
  onUpdate: (updates: Partial<WorkoutSet>) => void;
  onComplete: () => void;
  onUncomplete: () => void;
  onDelete: () => void;
}) {
  const [reps, setReps] = useState(String(set.reps));
  const [weight, setWeight] = useState(String(set.weight_kg));
  const [rpe, setRpe] = useState(set.rpe ? String(set.rpe) : "");

  // Keep local state in sync with prop changes (e.g. after save)
  useEffect(() => {
    setReps(String(set.reps));
    setWeight(String(set.weight_kg));
    setRpe(set.rpe ? String(set.rpe) : "");
  }, [set.reps, set.weight_kg, set.rpe]);

  function commitChanges() {
    const updates: Partial<WorkoutSet> = {};
    const newReps = parseInt(reps) || 0;
    const newWeight = parseFloat(weight) || 0;
    const newRpe = rpe ? Math.min(10, Math.max(1, parseInt(rpe) || 0)) || null : null;

    if (newReps !== set.reps) updates.reps = newReps;
    if (newWeight !== set.weight_kg) updates.weight_kg = newWeight;
    if (newRpe !== set.rpe) updates.rpe = newRpe;

    if (Object.keys(updates).length > 0) onUpdate(updates);
  }

  const inputBase =
    "w-full rounded-lg border border-card-border bg-background text-center text-sm font-medium text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

  return (
    <div
      className={`grid grid-cols-[2.5rem_1fr_1fr_2.5rem_2rem] items-center gap-2 px-4 py-2 transition-colors sm:grid-cols-[2.5rem_1fr_1fr_2.5rem_2.5rem] sm:gap-3 sm:px-5 ${
        set.completed
          ? "bg-[var(--success)]/5"
          : ""
      }`}
    >
      {/* Set number */}
      <div
        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
          set.completed
            ? "bg-[var(--success)]/20 text-[color:var(--success)]"
            : "bg-card-border text-muted"
        }`}
      >
        {set.set_number}
      </div>

      {/* Weight */}
      <div>
        <div className="relative">
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            min="0"
            className={`${inputBase} h-11 px-2 sm:h-10`}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            onBlur={commitChanges}
            disabled={disabled || set.completed}
            placeholder="0"
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted">
            kg
          </span>
        </div>
        {lastWeight != null && lastWeight > 0 && set.set_number === 1 && (
          <span className="block mt-0.5 text-[10px] text-muted text-center leading-tight">
            (ultimo: {lastWeight} kg)
          </span>
        )}
      </div>

      {/* Reps */}
      <div className="relative">
        <input
          type="number"
          inputMode="numeric"
          min="0"
          className={`${inputBase} h-11 px-2 sm:h-10`}
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          onBlur={commitChanges}
          disabled={disabled || set.completed}
          placeholder="0"
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-muted">
          reps
        </span>
      </div>

      {/* Complete toggle */}
      <button
        onClick={() => {
          if (set.completed) {
            onUncomplete();
          } else {
            commitChanges();
            onComplete();
          }
        }}
        disabled={disabled}
        className="flex h-11 w-full items-center justify-center rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 hover:bg-card-border sm:h-10"
        title={set.completed ? "Desmarcar" : "Completar serie"}
      >
        {set.completed ? (
          <CheckCircle className="h-6 w-6 text-[color:var(--success)]" />
        ) : (
          <Circle className="h-6 w-6 text-muted hover:text-[color:var(--success)]" />
        )}
      </button>

      {/* Delete */}
      {!disabled && !set.completed ? (
        <button
          onClick={onDelete}
          className="flex h-11 w-full items-center justify-center rounded-lg text-muted transition-colors hover:bg-card-border hover:text-danger cursor-pointer sm:h-10"
          title="Eliminar serie"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : (
        <div />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Summary Stat
   ═══════════════════════════════════════════════════════ */

function SummaryStat({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-xl bg-background p-4 text-center">
      <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <div className="text-xl font-bold text-foreground">{value}</div>
      <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-muted">
        {label}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Main Session Page
   ═══════════════════════════════════════════════════════ */

export default function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sessionId } = use(params);
  const supabase = createClient();
  const router = useRouter();

  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [exerciseGroups, setExerciseGroups] = useState<ExerciseGroup[]>([]);
  const [routineExercises, setRoutineExercises] = useState<RoutineExercise[]>(
    []
  );
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastWeights, setLastWeights] = useState<
    Map<string, number>
  >(new Map());
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [pendingDeleteSet, setPendingDeleteSet] = useState<{ setId: string; exerciseId: string } | null>(null);
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [restSeconds, setRestSeconds] = useState(90);
  const [showSummary, setShowSummary] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [sessionRating, setSessionRating] = useState<number>(0);
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(
    new Set()
  );
  const [immersiveMode, setImmersiveMode] = useState(false);
  const { checkForPR, prCelebration, dismissPR } = usePRDetection(exerciseGroups);
  const [sessionStartTime] = useState(() => Date.now());
  const [elapsedTime, setElapsedTime] = useState("0:00");

  // Elapsed timer - updates every second for accuracy
  useEffect(() => {
    function update() {
      const totalSecs = Math.floor((Date.now() - sessionStartTime) / 1000);
      const h = Math.floor(totalSecs / 3600);
      const m = Math.floor((totalSecs % 3600) / 60);
      const s = totalSecs % 60;
      if (h > 0) {
        setElapsedTime(`${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
      } else {
        setElapsedTime(`${m}:${s.toString().padStart(2, "0")}`);
      }
    }
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [sessionStartTime]);

  const loadSession = useCallback(async () => {
    setLoading(true);
    const { data: sessionData } = await supabase
      .from("workout_sessions")
      .select("*, routine:routines(*)")
      .eq("id", sessionId)
      .single();

    if (!sessionData) {
      router.push("/sessions");
      return;
    }
    setSession(sessionData as WorkoutSession);

    // Load sets with exercises
    const { data: sets } = await supabase
      .from("workout_sets")
      .select("*, exercise:exercises(*)")
      .eq("session_id", sessionId)
      .order("exercise_id")
      .order("set_number");

    // Load routine exercises if session has a routine
    let reList: RoutineExercise[] = [];
    if (sessionData.routine_id) {
      const { data: re } = await supabase
        .from("routine_exercises")
        .select("*, exercise:exercises(*)")
        .eq("routine_id", sessionData.routine_id)
        .order("order_index");
      reList = (re as RoutineExercise[]) ?? [];
      setRoutineExercises(reList);
    }

    // Group sets by exercise
    const groups = groupSets((sets as WorkoutSet[]) ?? [], reList);

    // Pre-create sets for routine exercises that have no sets yet
    if (!sessionData.completed) {
      const setsToCreate: {
        session_id: string;
        exercise_id: string;
        set_number: number;
        reps: number;
        weight_kg: number;
        completed: boolean;
      }[] = [];

      for (const group of groups) {
        if (group.routineExercise && group.sets.length === 0) {
          const re = group.routineExercise;
          for (let i = 0; i < re.target_sets; i++) {
            setsToCreate.push({
              session_id: sessionId,
              exercise_id: re.exercise_id,
              set_number: i + 1,
              reps: re.target_reps,
              weight_kg: re.target_weight_kg ?? 0,
              completed: false,
            });
          }
        }
      }

      if (setsToCreate.length > 0) {
        const { data: newSets } = await supabase
          .from("workout_sets")
          .insert(setsToCreate)
          .select("*, exercise:exercises(*)");

        if (newSets) {
          // Add new sets to their groups
          for (const ns of newSets as WorkoutSet[]) {
            const group = groups.find((g) => g.exercise.id === ns.exercise_id);
            if (group) group.sets.push(ns);
          }
          // Sort sets within each group
          for (const group of groups) {
            group.sets.sort((a, b) => a.set_number - b.set_number);
          }
        }
      }
    }

    setExerciseGroups(groups);

    // Expand all exercises by default
    const allIds = new Set(groups.map((g) => g.exercise.id));
    setExpandedExercises(allIds);

    // Fetch last session weights for same routine
    if (sessionData.routine_id) {
      const { data: prevSession } = await supabase
        .from("workout_sessions")
        .select("id")
        .eq("user_id", sessionData.user_id)
        .eq("routine_id", sessionData.routine_id)
        .neq("id", sessionId)
        .eq("completed", true)
        .order("date", { ascending: false })
        .limit(1)
        .single();

      if (prevSession) {
        const { data: prevSets } = await supabase
          .from("workout_sets")
          .select("exercise_id, weight_kg")
          .eq("session_id", prevSession.id)
          .eq("completed", true)
          .order("set_number", { ascending: false });

        if (prevSets && prevSets.length > 0) {
          const weightMap = new Map<string, number>();
          // Reverse so earlier sets overwrite later — we keep the last (highest set_number) weight
          for (const s of prevSets) {
            weightMap.set(s.exercise_id, s.weight_kg);
          }
          setLastWeights(weightMap);
        }
      }
    }

    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Load all exercises for "add exercise" modal
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("exercises")
        .select("*")
        .order("name");
      setAllExercises((data as Exercise[]) ?? []);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function groupSets(
    sets: WorkoutSet[],
    reList: RoutineExercise[]
  ): ExerciseGroup[] {
    const map = new Map<string, ExerciseGroup>();

    // First, add routine exercises in order
    for (const re of reList) {
      if (re.exercise) {
        map.set(re.exercise_id, {
          exercise: re.exercise,
          sets: [],
          routineExercise: re,
        });
      }
    }

    // Then populate with actual sets
    for (const set of sets) {
      if (!set.exercise) continue;
      const existing = map.get(set.exercise_id);
      if (existing) {
        existing.sets.push(set);
      } else {
        map.set(set.exercise_id, {
          exercise: set.exercise,
          sets: [set],
        });
      }
    }

    return Array.from(map.values());
  }

  /* ─── Set CRUD ─── */

  async function updateSet(setId: string, updates: Partial<WorkoutSet>) {
    setSaving(true);
    await supabase.from("workout_sets").update(updates).eq("id", setId);

    setExerciseGroups((prev) =>
      prev.map((g) => ({
        ...g,
        sets: g.sets.map((s) =>
          s.id === setId ? { ...s, ...updates } : s
        ),
      }))
    );
    setSaving(false);
  }

  async function completeSet(set: WorkoutSet, restSecs: number) {
    await updateSet(set.id, { completed: true });
    // Check for PR after completing a set
    checkForPR(set.exercise_id, set.weight_kg, set.reps);
    setRestSeconds(restSecs);
    setShowRestTimer(true);
  }

  async function uncompleteSet(setId: string) {
    await updateSet(setId, { completed: false });
  }

  async function deleteSet(setId: string, exerciseId: string) {
    await supabase.from("workout_sets").delete().eq("id", setId);
    setExerciseGroups((prev) =>
      prev
        .map((g) => ({
          ...g,
          sets: g.sets.filter((s) => s.id !== setId),
        }))
        .filter((g) => g.sets.length > 0 || g.routineExercise)
    );
  }

  async function addSet(exerciseId: string) {
    const group = exerciseGroups.find((g) => g.exercise.id === exerciseId);
    const lastSet = group?.sets[group.sets.length - 1];
    const setNumber = (lastSet?.set_number ?? 0) + 1;

    const { data } = await supabase
      .from("workout_sets")
      .insert({
        session_id: sessionId,
        exercise_id: exerciseId,
        set_number: setNumber,
        reps:
          lastSet?.reps ?? group?.routineExercise?.target_reps ?? 10,
        weight_kg:
          lastSet?.weight_kg ??
          group?.routineExercise?.target_weight_kg ??
          0,
        rpe: null,
        completed: false,
      })
      .select("*, exercise:exercises(*)")
      .single();

    if (data) {
      setExerciseGroups((prev) =>
        prev.map((g) =>
          g.exercise.id === exerciseId
            ? { ...g, sets: [...g.sets, data as WorkoutSet] }
            : g
        )
      );
      // Make sure the exercise is expanded
      setExpandedExercises((prev) => new Set([...prev, exerciseId]));
    }
  }

  async function addExerciseToSession(exercise: Exercise) {
    setShowAddExercise(false);
    setExerciseSearch("");

    if (exerciseGroups.some((g) => g.exercise.id === exercise.id)) return;

    const { data } = await supabase
      .from("workout_sets")
      .insert({
        session_id: sessionId,
        exercise_id: exercise.id,
        set_number: 1,
        reps: 10,
        weight_kg: 0,
        rpe: null,
        completed: false,
      })
      .select("*, exercise:exercises(*)")
      .single();

    if (data) {
      setExerciseGroups((prev) => [
        ...prev,
        { exercise, sets: [data as WorkoutSet] },
      ]);
      setExpandedExercises((prev) => new Set([...prev, exercise.id]));
    }
  }

  async function removeExercise(exerciseId: string) {
    await supabase
      .from("workout_sets")
      .delete()
      .eq("session_id", sessionId)
      .eq("exercise_id", exerciseId);

    setExerciseGroups((prev) =>
      prev.filter((g) => g.exercise.id !== exerciseId)
    );
  }

  /* ─── Session actions ─── */

  async function updateSessionNotes(notes: string) {
    await supabase
      .from("workout_sessions")
      .update({ notes })
      .eq("id", sessionId);
    setSession((prev) => (prev ? { ...prev, notes } : prev));
  }

  function getSummary(): SessionSummary {
    const allSets = exerciseGroups.flatMap((g) => g.sets);
    const completed = allSets.filter((s) => s.completed);
    const totalVolume = completed.reduce(
      (acc, s) => acc + s.reps * s.weight_kg,
      0
    );
    const duration =
      session?.duration_minutes ??
      Math.max(1, Math.round((Date.now() - sessionStartTime) / 60000));

    const perExercise = exerciseGroups
      .filter((g) => g.sets.some((s) => s.completed))
      .map((g) => {
        const completedSets = g.sets.filter((s) => s.completed);
        const vol = completedSets.reduce(
          (a, s) => a + s.reps * s.weight_kg,
          0
        );
        const bestWeight = Math.max(
          ...completedSets.map((s) => s.weight_kg),
          0
        );
        return {
          name: g.exercise.name,
          sets: completedSets.length,
          volume: Math.round(vol),
          bestWeight,
        };
      });

    return {
      totalSets: allSets.length,
      completedSets: completed.length,
      totalVolume,
      exerciseCount: exerciseGroups.filter((g) =>
        g.sets.some((s) => s.completed)
      ).length,
      duration,
      perExercise,
    };
  }

  function finishSession() {
    setShowRestTimer(false);
    setShowRating(true);
  }

  async function confirmFinishWithRating() {
    const duration = Math.max(
      1,
      Math.round((Date.now() - sessionStartTime) / 60000)
    );

    // First update completed + duration (critical)
    const updateData: Record<string, unknown> = {
      completed: true,
      duration_minutes: session?.duration_minutes ?? duration,
    };
    if (sessionRating > 0) updateData.rating = sessionRating;

    const { error } = await supabase
      .from("workout_sessions")
      .update(updateData)
      .eq("id", sessionId);

    if (error) {
      // Retry without rating in case column doesn't exist
      await supabase
        .from("workout_sessions")
        .update({ completed: true, duration_minutes: session?.duration_minutes ?? duration })
        .eq("id", sessionId);
    }

    setSession((prev) =>
      prev
        ? {
            ...prev,
            completed: true,
            duration_minutes: prev.duration_minutes ?? duration,
            rating: sessionRating > 0 ? sessionRating : null,
          }
        : prev
    );
    setShowRating(false);
    setShowSummary(true);
  }

  function toggleExpand(exerciseId: string) {
    setExpandedExercises((prev) => {
      const next = new Set(prev);
      if (next.has(exerciseId)) next.delete(exerciseId);
      else next.add(exerciseId);
      return next;
    });
  }

  const filteredExercises = useMemo(
    () =>
      allExercises.filter(
        (e) =>
          e.name.toLowerCase().includes(exerciseSearch.toLowerCase()) ||
          e.muscle_group.toLowerCase().includes(exerciseSearch.toLowerCase())
      ),
    [allExercises, exerciseSearch]
  );

  // Group filtered exercises by muscle group for the modal
  const groupedFilteredExercises = useMemo(() => {
    const groups = new Map<string, Exercise[]>();
    for (const ex of filteredExercises) {
      const mg = ex.muscle_group;
      if (!groups.has(mg)) groups.set(mg, []);
      groups.get(mg)!.push(ex);
    }
    return Array.from(groups.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );
  }, [filteredExercises]);

  // Overall progress
  const totalSets = exerciseGroups.reduce(
    (acc, g) => acc + g.sets.length,
    0
  );
  const completedSets = exerciseGroups.reduce(
    (acc, g) => acc + g.sets.filter((s) => s.completed).length,
    0
  );
  const progressPct = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

  if (loading) {
    return <SessionSkeleton />;
  }

  if (!session) return null;

  const summary = getSummary();
  const isFree = !session.routine_id;

  return (
    <div
      className={`mx-auto max-w-4xl space-y-4 ${
        showRestTimer ? "pb-36" : "pb-6"
      }`}
    >
      {/* ─── Top Bar ─── */}
      <div className="sticky top-0 z-30 -mx-4 bg-background/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push("/sessions")}
              className="flex-shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-card-border hover:text-foreground cursor-pointer"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-foreground sm:text-xl">
                {session.routine?.name ?? "Sesion Libre"}
              </h1>
              <div className="flex items-center gap-2 text-xs text-muted">
                <Badge
                  color={session.completed ? "green" : "yellow"}
                  size="sm"
                >
                  {session.completed ? "Completada" : "En progreso"}
                </Badge>
                <span className="flex items-center gap-1 tabular-nums">
                  <Clock className="h-3 w-3" />
                  {session.duration_minutes
                    ? `${session.duration_minutes}min`
                    : elapsedTime}
                </span>
                <span className="tabular-nums">
                  {completedSets}/{totalSets} series
                </span>
              </div>
            </div>
          </div>

          {!session.completed && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {exerciseGroups.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setImmersiveMode(true)}
                  title="Modo Inmersivo"
                >
                  <Maximize2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Inmersivo</span>
                </Button>
              )}
              {(isFree || session.completed === false) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddExercise(true)}
                  className="hidden sm:inline-flex"
                >
                  <Plus className="h-4 w-4" />
                  Ejercicio
                </Button>
              )}
              <Button size="sm" onClick={finishSession}>
                <CheckCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Finalizar</span>
              </Button>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {!session.completed && totalSets > 0 && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-card-border">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                backgroundColor:
                  progressPct === 100 ? "var(--success)" : "var(--primary)",
              }}
            />
          </div>
        )}
      </div>

      {/* ─── Exercise Groups ─── */}
      {exerciseGroups.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Dumbbell className="h-8 w-8 text-primary" />
          </div>
          <p className="mt-4 text-lg font-medium text-foreground">
            No hay ejercicios
          </p>
          <p className="mt-1 text-sm text-muted">
            Agrega un ejercicio para comenzar tu entrenamiento
          </p>
          {!session.completed && (
            <Button
              className="mt-6"
              onClick={() => setShowAddExercise(true)}
            >
              <Plus className="h-4 w-4" />
              Agregar Ejercicio
            </Button>
          )}
        </Card>
      ) : (
        exerciseGroups.map((group) => {
          const isExpanded = expandedExercises.has(group.exercise.id);
          const completedCount = group.sets.filter(
            (s) => s.completed
          ).length;
          const totalCount = group.sets.length;
          const re = group.routineExercise;
          const target = re
            ? `${re.target_sets}\u00d7${re.target_reps}${
                re.target_weight_kg ? ` @ ${re.target_weight_kg}kg` : ""
              }`
            : null;
          const defaultRest = re?.rest_seconds ?? 90;
          const allDone =
            totalCount > 0 && completedCount === totalCount;

          return (
            <Card
              key={group.exercise.id}
              padding="compact"
              className="overflow-hidden"
            >
              {/* Exercise Header - clickable to collapse/expand */}
              <button
                className="flex w-full items-center justify-between px-4 py-3 text-left cursor-pointer hover:bg-card-border/30 transition-colors sm:px-5"
                onClick={() => toggleExpand(group.exercise.id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Completion indicator */}
                  <div
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      allDone
                        ? "bg-[var(--success)]/20 text-[color:var(--success)]"
                        : completedCount > 0
                        ? "bg-[var(--warning)]/20 text-[color:var(--warning)]"
                        : "bg-card-border text-muted"
                    }`}
                  >
                    {completedCount}/{totalCount}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-foreground">
                        {group.exercise.name}
                      </span>
                      {allDone && (
                        <CheckCircle className="h-4 w-4 flex-shrink-0 text-[color:var(--success)]" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <span className="capitalize">
                        {group.exercise.muscle_group.replace("_", " ")}
                      </span>
                      {target && (
                        <>
                          <span className="text-card-border">|</span>
                          <span
                            style={{ color: "var(--info)" }}
                            className="font-medium"
                          >
                            {target}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {!session.completed && !re && (
                    <span
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeExercise(group.exercise.id);
                      }}
                      className="rounded-lg p-1.5 text-muted transition-colors hover:bg-card-border hover:text-danger cursor-pointer"
                      title="Eliminar ejercicio"
                    >
                      <Trash2 className="h-4 w-4" />
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-muted" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted" />
                  )}
                </div>
              </button>

              {/* Sets */}
              {isExpanded && (
                <div className="border-t border-card-border">
                  {/* Column headers */}
                  <div className="grid grid-cols-[2.5rem_1fr_1fr_2.5rem_2rem] gap-2 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted sm:grid-cols-[2.5rem_1fr_1fr_2.5rem_2.5rem] sm:gap-3 sm:px-5">
                    <div>Serie</div>
                    <div>Peso</div>
                    <div>Reps</div>
                    <div></div>
                    <div></div>
                  </div>

                  {/* Set rows */}
                  {group.sets.map((set) => (
                    <SetRow
                      key={set.id}
                      set={set}
                      disabled={session.completed}
                      lastWeight={lastWeights.get(group.exercise.id)}
                      onUpdate={(updates) => updateSet(set.id, updates)}
                      onComplete={() => completeSet(set, defaultRest)}
                      onUncomplete={() => uncompleteSet(set.id)}
                      onDelete={() =>
                        setPendingDeleteSet({ setId: set.id, exerciseId: group.exercise.id })
                      }
                    />
                  ))}

                  {/* Add Set */}
                  {!session.completed && (
                    <div className="border-t border-card-border/50 px-4 py-2.5 sm:px-5">
                      <button
                        onClick={() => addSet(group.exercise.id)}
                        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10 cursor-pointer"
                      >
                        <Plus className="h-4 w-4" />
                        Agregar Serie
                      </button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })
      )}

      {/* ─── Add exercise button (mobile FAB for free sessions) ─── */}
      {!session.completed && isFree && exerciseGroups.length > 0 && (
        <div className="flex justify-center sm:hidden">
          <Button
            variant="secondary"
            onClick={() => setShowAddExercise(true)}
            fullWidth
          >
            <Plus className="h-4 w-4" />
            Agregar Ejercicio
          </Button>
        </div>
      )}

      {/* ─── Notes ─── */}
      <Card>
        <Textarea
          label="Notas de la sesion"
          placeholder="Escribe notas sobre tu entrenamiento..."
          value={session.notes ?? ""}
          onChange={(e) => updateSessionNotes(e.target.value)}
          disabled={session.completed}
          autoResize
        />
      </Card>

      {/* ─── Rest Timer ─── */}
      {showRestTimer && !session.completed && (
        <RestTimer
          defaultSeconds={restSeconds}
          onDismiss={() => setShowRestTimer(false)}
        />
      )}

      {/* ─── PR Celebration ─── */}
      {prCelebration && (
        <PRCelebration
          exerciseName={prCelebration.exerciseName}
          newWeight={prCelebration.newWeight}
          previousWeight={prCelebration.previousWeight}
          type={prCelebration.type}
          estimated1RM={prCelebration.estimated1RM}
          onDismiss={dismissPR}
        />
      )}

      {/* ─── Delete Set Confirm ─── */}
      <ConfirmDialog
        open={!!pendingDeleteSet}
        onClose={() => setPendingDeleteSet(null)}
        onConfirm={() => {
          if (pendingDeleteSet) {
            deleteSet(pendingDeleteSet.setId, pendingDeleteSet.exerciseId);
            setPendingDeleteSet(null);
          }
        }}
        title="Eliminar serie"
        message="¿Estás seguro de que quieres eliminar esta serie? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        variant="danger"
      />

      {/* ─── Add Exercise Modal ─── */}
      <Modal
        open={showAddExercise}
        onClose={() => {
          setShowAddExercise(false);
          setExerciseSearch("");
        }}
        title="Agregar Ejercicio"
        size="lg"
      >
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              className="w-full rounded-lg border border-card-border bg-background py-2.5 pl-10 pr-3 text-sm text-foreground placeholder-muted outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Buscar ejercicio por nombre o grupo muscular..."
              value={exerciseSearch}
              onChange={(e) => setExerciseSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-80 space-y-4 overflow-y-auto">
            {groupedFilteredExercises.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">
                No se encontraron ejercicios
              </p>
            ) : (
              groupedFilteredExercises.map(([muscleGroup, exercises]) => (
                <div key={muscleGroup}>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted">
                    {muscleGroup.replace("_", " ")}
                  </p>
                  <div className="space-y-0.5">
                    {exercises.map((exercise) => {
                      const alreadyAdded = exerciseGroups.some(
                        (g) => g.exercise.id === exercise.id
                      );
                      return (
                        <button
                          key={exercise.id}
                          className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors cursor-pointer ${
                            alreadyAdded
                              ? "opacity-30 cursor-not-allowed"
                              : "hover:bg-card-border/50"
                          }`}
                          onClick={() =>
                            !alreadyAdded &&
                            addExerciseToSession(exercise)
                          }
                          disabled={alreadyAdded}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm font-medium text-foreground">
                                {exercise.name}
                              </div>
                              <div className="text-xs text-muted capitalize">
                                {exercise.equipment.replace("_", " ")}
                              </div>
                            </div>
                            {alreadyAdded && (
                              <Badge color="gray" size="sm">
                                Agregado
                              </Badge>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      {/* ─── Rating Modal ─── */}
      <Modal
        open={showRating}
        onClose={() => {
          setShowRating(false);
          confirmFinishWithRating();
        }}
        title="Califica tu entrenamiento"
      >
        <div className="space-y-6">
          <p className="text-center text-sm text-muted">
            Como fue tu entrenamiento?
          </p>

          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                onClick={() => setSessionRating(value)}
                className="flex flex-col items-center gap-1.5 rounded-xl p-3 transition-all cursor-pointer hover:bg-[var(--hover-bg)]"
              >
                <Star
                  className={`h-8 w-8 transition-colors ${
                    value <= sessionRating
                      ? "fill-[var(--warning)] text-[color:var(--warning)]"
                      : "text-card-border"
                  }`}
                />
              </button>
            ))}
          </div>

          {sessionRating > 0 && (
            <p className="text-center text-sm font-medium text-foreground">
              {["", "Muy facil", "Facil", "Normal", "Dificil", "Muy dificil"][sessionRating]}
            </p>
          )}

          <Button
            fullWidth
            size="lg"
            onClick={confirmFinishWithRating}
          >
            {sessionRating > 0 ? "Confirmar y ver resumen" : "Saltar y ver resumen"}
          </Button>
        </div>
      </Modal>

      {/* ─── Immersive Mode ─── */}
      {immersiveMode && !session.completed && (
        <ImmersiveMode
          exerciseGroups={exerciseGroups}
          session={session}
          onCompleteSet={(exerciseId, setIndex, w, r) => {
            const group = exerciseGroups.find(
              (g) => g.exercise.id === exerciseId
            );
            if (!group) return;
            const set = group.sets[setIndex];
            if (!set) return;
            updateSet(set.id, {
              weight_kg: w,
              reps: r,
              completed: true,
            });
          }}
          onAddSet={(exerciseId) => addSet(exerciseId)}
          onFinish={() => {
            setImmersiveMode(false);
            finishSession();
          }}
          onExit={() => setImmersiveMode(false)}
          lastWeights={lastWeights}
          prCelebration={prCelebration}
          onDismissPR={dismissPR}
          checkForPR={checkForPR}
        />
      )}

      {/* ─── Summary Modal ─── */}
      <Modal
        open={showSummary}
        onClose={() => {
          setShowSummary(false);
          router.push("/sessions");
        }}
        title="Entrenamiento Completado"
        size="lg"
      >
        <div className="space-y-6">
          {/* Trophy icon */}
          <div className="flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--success)]/15">
              <Trophy className="h-10 w-10 text-[color:var(--success)]" />
            </div>
          </div>

          <p className="text-center text-sm text-muted">
            Excelente trabajo. Aqui esta tu resumen.
          </p>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryStat
              label="Duracion"
              value={`${summary.duration}min`}
              icon={Clock}
              color="var(--info)"
            />
            <SummaryStat
              label="Ejercicios"
              value={String(summary.exerciseCount)}
              icon={Dumbbell}
              color="var(--accent)"
            />
            <SummaryStat
              label="Series"
              value={`${summary.completedSets}/${summary.totalSets}`}
              icon={Target}
              color="var(--warning)"
            />
            <SummaryStat
              label="Volumen"
              value={`${Math.round(summary.totalVolume).toLocaleString()}kg`}
              icon={Zap}
              color="var(--success)"
            />
          </div>

          {/* Per-exercise breakdown */}
          {summary.perExercise.length > 0 && (
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
                Desglose por ejercicio
              </h3>
              <div className="space-y-2">
                {summary.perExercise.map((ex) => (
                  <div
                    key={ex.name}
                    className="flex items-center justify-between rounded-xl bg-background px-4 py-3"
                  >
                    <div>
                      <span className="text-sm font-medium text-foreground">
                        {ex.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted">
                      <span>{ex.sets} series</span>
                      <span className="font-medium text-foreground">
                        {ex.volume.toLocaleString()} kg
                      </span>
                      {ex.bestWeight > 0 && (
                        <span style={{ color: "var(--warning)" }}>
                          max {ex.bestWeight}kg
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button
            fullWidth
            size="lg"
            onClick={() => {
              setShowSummary(false);
              router.push("/sessions");
            }}
          >
            Volver a Sesiones
          </Button>
        </div>
      </Modal>
    </div>
  );
}
