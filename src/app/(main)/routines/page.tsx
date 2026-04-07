'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DAY_NAMES } from '@/lib/constants';
import type { Profile, Routine } from '@/types/database';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Plus, Dumbbell, Calendar, Loader2, Star } from 'lucide-react';

interface RoutineWithMeta extends Routine {
  exercise_count: number;
  is_assigned: boolean;
}

export default function RoutinesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [routines, setRoutines] = useState<RoutineWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (!prof) return;
        setProfile(prof as Profile);

        const routineMap = new Map<string, RoutineWithMeta>();

        // Load user's own routines
        const { data: ownRoutines, error: ownErr } = await supabase
          .from('routines')
          .select('*')
          .eq('created_by', user.id)
          .order('created_at', { ascending: false });
        if (ownErr) throw ownErr;

        for (const r of (ownRoutines ?? []) as Routine[]) {
          routineMap.set(r.id, { ...r, exercise_count: 0, is_assigned: false });
        }

        // Load assigned routines
        const { data: assignments, error: assignErr } = await supabase
          .from('routine_assignments')
          .select('routine_id, routines(*)')
          .eq('user_id', user.id)
          .eq('active', true);
        if (!assignErr && assignments) {
          for (const a of assignments) {
            const r = (a as Record<string, unknown>).routines as Routine | null;
            if (r && !routineMap.has(r.id)) {
              routineMap.set(r.id, { ...r, exercise_count: 0, is_assigned: true });
            }
          }
        }

        // Get exercise counts
        const allRoutines = Array.from(routineMap.values());
        const withCounts: RoutineWithMeta[] = await Promise.all(
          allRoutines.map(async (r) => {
            const { count } = await supabase
              .from('routine_exercises')
              .select('*', { count: 'exact', head: true })
              .eq('routine_id', r.id);
            return { ...r, exercise_count: count ?? 0 };
          })
        );

        setRoutines(withCounts);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar rutinas');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-40 animate-pulse rounded-lg bg-card-bg" />
            <div className="mt-2 h-4 w-56 animate-pulse rounded bg-card-bg" />
          </div>
          <div className="h-10 w-32 animate-pulse rounded-lg bg-card-bg" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-card-border bg-card-bg p-5"
            >
              <div className="h-5 w-3/4 animate-pulse rounded bg-background" />
              <div className="mt-3 h-4 w-full animate-pulse rounded bg-background" />
              <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-background" />
              <div className="mt-4 flex gap-3">
                <div className="h-4 w-20 animate-pulse rounded bg-background" />
                <div className="h-4 w-20 animate-pulse rounded bg-background" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Rutinas</h1>
          <p className="mt-1 text-sm text-muted">
            Tus rutinas de entrenamiento
          </p>
        </div>
        <Button onClick={() => router.push('/routines/new')}>
          <Plus className="h-4 w-4" />
          Crear Rutina
        </Button>
      </div>

      {/* Routines grid */}
      {routines.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <div
            className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"
          >
            <Dumbbell className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            Todavia no tienes rutinas
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted">
            Crea tu primera rutina para organizar tus ejercicios y empezar a entrenar de forma estructurada.
          </p>
          <Button
            className="mt-5"
            onClick={() => router.push('/routines/new')}
          >
            <Plus className="h-4 w-4" />
            Crear primera rutina
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {routines.map((routine) => (
            <Card
              key={routine.id}
              className="cursor-pointer transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
              onClick={() => router.push(`/routines/${routine.id}`)}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-foreground line-clamp-1">
                  {routine.name}
                </h3>
                <div className="flex shrink-0 items-center gap-1.5">
                  {routine.is_assigned && (
                    <Badge color="purple">
                      <Star className="mr-1 h-3 w-3" />
                      Asignada
                    </Badge>
                  )}
                  {routine.day_of_week !== null && (
                    <Badge color="blue">{DAY_NAMES[routine.day_of_week]}</Badge>
                  )}
                </div>
              </div>

              {routine.description && (
                <p className="mt-2 text-sm text-muted line-clamp-2">
                  {routine.description}
                </p>
              )}

              <div className="mt-4 flex items-center gap-4 text-xs text-muted">
                <span className="flex items-center gap-1.5">
                  <Dumbbell className="h-3.5 w-3.5" />
                  {routine.exercise_count} ejercicio{routine.exercise_count !== 1 ? 's' : ''}
                </span>
                {routine.day_of_week !== null && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {DAY_NAMES[routine.day_of_week]}
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
