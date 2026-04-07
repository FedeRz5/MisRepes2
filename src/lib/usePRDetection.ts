"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Exercise, RoutineExercise, WorkoutSet } from "@/types/database";

/* ═══════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════ */

interface ExerciseGroup {
  exercise: Exercise;
  sets: WorkoutSet[];
  routineExercise?: RoutineExercise;
}

export interface PRInfo {
  exerciseName: string;
  newWeight: number;
  previousWeight: number | null;
  type: "weight" | "1rm";
  estimated1RM?: number;
}

interface ExercisePRRecord {
  maxWeight: number;
  max1RM: number;
}

/* ═══════════════════════════════════════════════════════
   Epley 1RM Formula
   ═══════════════════════════════════════════════════════ */

function calculateEstimated1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/* ═══════════════════════════════════════════════════════
   usePRDetection Hook
   ═══════════════════════════════════════════════════════ */

export function usePRDetection(exerciseGroups: ExerciseGroup[]) {
  const supabase = createClient();
  const [prRecords, setPrRecords] = useState<Map<string, ExercisePRRecord>>(
    new Map()
  );
  const [prCelebration, setPrCelebration] = useState<PRInfo | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Track PRs already celebrated this session to avoid duplicates
  const celebratedRef = useRef<Set<string>>(new Set());

  // Extract exercise IDs from groups
  const exerciseIds = exerciseGroups.map((g) => g.exercise.id);
  const exerciseIdsKey = exerciseIds.sort().join(",");

  // Fetch existing PR records on mount / when exercises change
  useEffect(() => {
    if (exerciseIds.length === 0) {
      setLoaded(true);
      return;
    }

    async function fetchPRs() {
      // Get the current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoaded(true);
        return;
      }

      // Query all completed sets for these exercises across completed sessions
      const { data: sets } = await supabase
        .from("workout_sets")
        .select(
          "exercise_id, weight_kg, reps, workout_sessions!inner(user_id, completed)"
        )
        .in("exercise_id", exerciseIds)
        .eq("completed", true)
        .eq("workout_sessions.user_id", user.id)
        .eq("workout_sessions.completed", true);

      const records = new Map<string, ExercisePRRecord>();

      if (sets && sets.length > 0) {
        for (const s of sets as { exercise_id: string; weight_kg: number; reps: number }[]) {
          const existing = records.get(s.exercise_id) ?? {
            maxWeight: 0,
            max1RM: 0,
          };
          if (s.weight_kg > existing.maxWeight) {
            existing.maxWeight = s.weight_kg;
          }
          const est1RM = calculateEstimated1RM(s.weight_kg, s.reps);
          if (est1RM > existing.max1RM) {
            existing.max1RM = est1RM;
          }
          records.set(s.exercise_id, existing);
        }
      }

      setPrRecords(records);
      setLoaded(true);
    }

    fetchPRs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseIdsKey]);

  const checkForPR = useCallback(
    (exerciseId: string, weight: number, reps: number): PRInfo | null => {
      if (!loaded || weight <= 0 || reps <= 0) return null;

      const exerciseName =
        exerciseGroups.find((g) => g.exercise.id === exerciseId)?.exercise
          .name ?? "Ejercicio";

      const existing = prRecords.get(exerciseId);
      const previousMaxWeight = existing?.maxWeight ?? null;
      const previousMax1RM = existing?.max1RM ?? 0;
      const estimated1RM = calculateEstimated1RM(weight, reps);

      // Check weight PR
      const isWeightPR =
        previousMaxWeight === null || weight > previousMaxWeight;
      // Check 1RM PR (only if not already a weight PR, to avoid double celebration)
      const is1RMPR = !isWeightPR && estimated1RM > previousMax1RM && previousMax1RM > 0;

      if (!isWeightPR && !is1RMPR) return null;

      // Build celebration key to avoid duplicates this session
      const celebrationKey = `${exerciseId}-${isWeightPR ? "w" : "1rm"}-${weight}-${reps}`;
      if (celebratedRef.current.has(celebrationKey)) return null;
      celebratedRef.current.add(celebrationKey);

      // Update the local PR records so future checks reflect this new PR
      const updatedRecord: ExercisePRRecord = {
        maxWeight: Math.max(existing?.maxWeight ?? 0, weight),
        max1RM: Math.max(existing?.max1RM ?? 0, estimated1RM),
      };
      setPrRecords((prev) => {
        const next = new Map(prev);
        next.set(exerciseId, updatedRecord);
        return next;
      });

      const prInfo: PRInfo = isWeightPR
        ? {
            exerciseName,
            newWeight: weight,
            previousWeight: previousMaxWeight,
            type: "weight",
            estimated1RM: reps > 1 ? estimated1RM : undefined,
          }
        : {
            exerciseName,
            newWeight: weight,
            previousWeight: previousMaxWeight,
            type: "1rm",
            estimated1RM,
          };

      setPrCelebration(prInfo);
      return prInfo;
    },
    [loaded, exerciseGroups, prRecords]
  );

  const dismissPR = useCallback(() => {
    setPrCelebration(null);
  }, []);

  return { checkForPR, prCelebration, dismissPR };
}
