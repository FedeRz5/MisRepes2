"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { WorkoutSession, Routine, RoutineAssignment } from "@/types/database";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import {
  Plus,
  CheckCircle,
  Clock,
  Dumbbell,
  Copy,
  Timer,
  X,
  Star,
  Trash2,
  Play,
} from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

/* ─── Skeleton ─── */

function SessionSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <div className="flex items-center gap-4 animate-pulse">
            <div className="h-10 w-10 rounded-full bg-card-border" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 rounded bg-card-border" />
              <div className="h-3 w-56 rounded bg-card-border" />
            </div>
            <div className="h-8 w-8 rounded-lg bg-card-border" />
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ─── Main ─── */

export default function SessionsPage() {
  const supabase = createClient();
  const router = useRouter();

  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [todayRoutine, setTodayRoutine] = useState<Routine | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("todo");
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadSessions();
    loadRoutines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSessions() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("workout_sessions")
      .select("*, routine:routines(*)")
      .eq("user_id", user.id)
      .order("date", { ascending: false });

    setSessions((data as WorkoutSession[]) ?? []);
    setLoading(false);
  }

  async function loadRoutines() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: assignments } = await supabase
      .from("routine_assignments")
      .select("*, routine:routines(*)")
      .eq("user_id", user.id)
      .eq("active", true);

    const { data: ownRoutines } = await supabase
      .from("routines")
      .select("*")
      .eq("created_by", user.id);

    const assignedRoutines =
      ((assignments as RoutineAssignment[] | null)
        ?.map((a) => a.routine)
        .filter(Boolean) as Routine[]) ?? [];

    const own = (ownRoutines as Routine[]) ?? [];

    const map = new Map<string, Routine>();
    [...assignedRoutines, ...own].forEach((r) => {
      if (r) map.set(r.id, r);
    });
    setRoutines(Array.from(map.values()));

    // Find today's assigned routine by day_of_week (0=Mon...6=Sun)
    const jsDay = new Date().getDay();
    const appDay = (jsDay + 6) % 7;
    const todayAssignment = (assignments as RoutineAssignment[] | null)?.find(
      (a) => a.routine && (a.routine as Routine).day_of_week === appDay
    );
    setTodayRoutine(todayAssignment ? (todayAssignment.routine as Routine) : null);
  }

  async function createSession(routineId: string | null) {
    setCreating(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("workout_sessions")
      .insert({
        user_id: user.id,
        routine_id: routineId,
        date: new Date().toISOString().split("T")[0],
        completed: false,
      })
      .select()
      .single();

    if (data && !error) {
      if (routineId) {
        const { data: routineExercises } = await supabase
          .from("routine_exercises")
          .select("*")
          .eq("routine_id", routineId)
          .order("order_index");

        if (routineExercises && routineExercises.length > 0) {
          const sets = routineExercises.flatMap((re: any) =>
            Array.from({ length: re.target_sets }, (_, i) => ({
              session_id: data.id,
              exercise_id: re.exercise_id,
              set_number: i + 1,
              reps: re.target_reps,
              weight_kg: re.target_weight_kg ?? 0,
              rpe: null,
              completed: false,
            }))
          );
          await supabase.from("workout_sets").insert(sets);
        }
      }

      router.push(`/sessions/${data.id}`);
    }
    setCreating(false);
    setModalOpen(false);
  }

  async function duplicateSession(session: WorkoutSession) {
    setCreating(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: newSession, error } = await supabase
      .from("workout_sessions")
      .insert({
        user_id: user.id,
        routine_id: session.routine_id,
        date: new Date().toISOString().split("T")[0],
        completed: false,
      })
      .select()
      .single();

    if (newSession && !error) {
      const { data: prevSets } = await supabase
        .from("workout_sets")
        .select("*")
        .eq("session_id", session.id)
        .order("exercise_id")
        .order("set_number");

      if (prevSets && prevSets.length > 0) {
        const newSets = prevSets.map((s: any) => ({
          session_id: newSession.id,
          exercise_id: s.exercise_id,
          set_number: s.set_number,
          reps: s.reps,
          weight_kg: s.weight_kg,
          rpe: null,
          completed: false,
        }));
        await supabase.from("workout_sets").insert(newSets);
      }

      router.push(`/sessions/${newSession.id}`);
    }
    setCreating(false);
  }

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (dateFrom && s.date < dateFrom) return false;
      if (dateTo && s.date > dateTo) return false;
      return true;
    });
  }, [sessions, dateFrom, dateTo]);

  async function handleDeleteSession() {
    if (!deleteSessionId) return;
    setDeleting(true);
    // Sets are cascaded via FK
    await supabase.from("workout_sessions").delete().eq("id", deleteSessionId);
    setSessions((prev) => prev.filter((s) => s.id !== deleteSessionId));
    setDeleteSessionId(null);
    setDeleting(false);
  }

  function formatDuration(minutes: number | null) {
    if (!minutes) return "-";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + "T12:00:00");
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return "Hoy";
    if (d.toDateString() === yesterday.toDateString()) return "Ayer";

    return d.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
    });
  }

  function applyQuickFilter(filter: string) {
    setActiveFilter(filter);
    const today = new Date();
    const toISO = (d: Date) => d.toISOString().split("T")[0];

    switch (filter) {
      case "hoy":
        setDateFrom(toISO(today));
        setDateTo(toISO(today));
        break;
      case "semana": {
        const dayOfWeek = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
        setDateFrom(toISO(monday));
        setDateTo(toISO(today));
        break;
      }
      case "mes": {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        setDateFrom(toISO(firstDay));
        setDateTo(toISO(today));
        break;
      }
      case "todo":
      default:
        setDateFrom("");
        setDateTo("");
        break;
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sesiones</h1>
          <p className="text-sm text-muted">Historial de entrenamientos</p>
        </div>
        <Button onClick={() => setModalOpen(true)} disabled={creating} loading={creating}>
          <Plus className="h-4 w-4" />
          Nueva Sesion
        </Button>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Quick filters */}
        <div className="flex flex-wrap gap-2">
          {([
            { key: "hoy", label: "Hoy" },
            { key: "semana", label: "Esta semana" },
            { key: "mes", label: "Este mes" },
            { key: "todo", label: "Todo" },
          ] as const).map((f) => (
            <button
              key={f.key}
              onClick={() => applyQuickFilter(f.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                activeFilter === f.key
                  ? "bg-primary text-white"
                  : "bg-card-bg border border-card-border text-muted hover:text-foreground hover:border-primary/40"
              }`}
            >
              {f.label}
            </button>
          ))}
          {(dateFrom || dateTo) && activeFilter === "" && (
            <button
              onClick={() => applyQuickFilter("todo")}
              className="flex items-center gap-1 rounded-full border border-card-border px-3 py-1.5 text-sm text-muted hover:text-danger hover:border-danger/40 cursor-pointer transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Limpiar
            </button>
          )}
        </div>

        {/* Date range */}
        <div className="flex gap-3">
          <Input
            label="Desde"
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setActiveFilter(""); }}
          />
          <Input
            label="Hasta"
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setActiveFilter(""); }}
          />
        </div>
      </div>

      {/* Today's routine banner */}
      {!loading && todayRoutine && (
        <Card>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted mb-0.5">Hoy te toca</p>
              <p className="font-semibold text-primary">{todayRoutine.name}</p>
            </div>
            <Button onClick={() => createSession(todayRoutine.id)} loading={creating}>
              <Play className="h-4 w-4" />
              Iniciar
            </Button>
          </div>
        </Card>
      )}

      {/* Sessions List */}
      {loading ? (
        <SessionSkeleton />
      ) : filteredSessions.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mx-auto">
              <Dumbbell className="h-8 w-8 text-primary" />
            </div>
            <p className="mt-4 text-lg font-medium text-foreground">
              No hay sesiones todavia
            </p>
            <p className="mt-1 text-sm text-muted">
              Crea tu primera sesion de entrenamiento
            </p>
            <Button className="mt-6" onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" />
              Nueva Sesion
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredSessions.map((session) => {
            return (
              <Card
                key={session.id}
                hover
                className="group"
                onClick={() => router.push(`/sessions/${session.id}`)}
              >
                <div className="flex items-center gap-3">
                  {/* Status icon */}
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      session.completed
                        ? "bg-[var(--success)]/15 text-[color:var(--success)]"
                        : "bg-[var(--warning)]/15 text-[color:var(--warning)]"
                    }`}
                  >
                    {session.completed ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <Clock className="h-5 w-5" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-foreground">
                        {session.routine?.name ?? "Sesión Libre"}
                      </span>
                      {!session.completed && (
                        <Badge color="yellow" size="sm">En progreso</Badge>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-sm text-muted">
                      <span>{formatDate(session.date)}</span>
                      {session.duration_minutes && (
                        <>
                          <span className="text-card-border">·</span>
                          <span className="flex items-center gap-1">
                            <Timer className="h-3 w-3" />
                            {formatDuration(session.duration_minutes)}
                          </span>
                        </>
                      )}
                      {session.completed && session.rating && (
                        <>
                          <span className="text-card-border">·</span>
                          <span className="flex items-center gap-0.5">
                            <Star className="h-3 w-3 fill-[var(--warning)] text-[color:var(--warning)]" />
                            <span className="text-xs">{session.rating}/5</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <button
                      onClick={(e) => { e.stopPropagation(); duplicateSession(session); }}
                      disabled={creating}
                      title="Repetir sesión"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-card-border hover:text-foreground cursor-pointer"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteSessionId(session.id); }}
                      title="Eliminar sesión"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger/15 hover:text-danger cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* New Session Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nueva Sesion"
      >
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Selecciona una rutina o inicia una sesion libre.
          </p>

          <button
            className="w-full rounded-lg border border-card-border bg-background p-4 text-left transition-colors hover:border-primary/50 cursor-pointer"
            onClick={() => createSession(null)}
            disabled={creating}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)]/15 text-[color:var(--accent)]">
                <Dumbbell className="h-5 w-5" />
              </div>
              <div>
                <div className="font-medium text-foreground">Sesion Libre</div>
                <div className="mt-0.5 text-sm text-muted">
                  Agrega ejercicios y series manualmente
                </div>
              </div>
            </div>
          </button>

          {routines.length > 0 && (
            <div className="border-t border-card-border pt-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">
                Tus Rutinas
              </p>
              <div className="max-h-60 space-y-2 overflow-y-auto">
                {routines.map((routine) => (
                  <button
                    key={routine.id}
                    className="w-full rounded-lg border border-card-border bg-background p-4 text-left transition-colors hover:border-primary/50 cursor-pointer"
                    onClick={() => createSession(routine.id)}
                    disabled={creating}
                  >
                    <div className="font-medium text-foreground">
                      {routine.name}
                    </div>
                    {routine.description && (
                      <div className="mt-1 text-sm text-muted">
                        {routine.description}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Delete session confirm */}
      <ConfirmDialog
        open={!!deleteSessionId}
        onClose={() => setDeleteSessionId(null)}
        onConfirm={handleDeleteSession}
        title="Eliminar sesión"
        message="¿Estás seguro? Se eliminarán todas las series registradas en esta sesión. Esta acción no se puede deshacer."
        confirmText="Eliminar"
        variant="danger"
      />
    </div>
  );
}
