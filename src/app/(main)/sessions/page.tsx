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
  Calendar,
  Dumbbell,
  Copy,
  Timer,
  X,
  Star,
  Trash2,
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
    return d.toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  const ratingLabels = ["", "Muy facil", "Facil", "Normal", "Dificil", "Muy dificil"];

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
      <Card>
        {/* Quick filter buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          {([
            { key: "hoy", label: "Hoy" },
            { key: "semana", label: "Esta semana" },
            { key: "mes", label: "Este mes" },
            { key: "todo", label: "Todo" },
          ] as const).map((f) => (
            <button
              key={f.key}
              onClick={() => applyQuickFilter(f.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                activeFilter === f.key
                  ? "bg-primary text-white"
                  : "bg-[var(--hover-bg)] text-muted hover:text-foreground hover:bg-card-border"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="Desde"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setActiveFilter("");
              }}
            />
          </div>
          <div className="flex-1">
            <Input
              label="Hasta"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setActiveFilter("");
              }}
            />
          </div>
          {(dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => applyQuickFilter("todo")}
            >
              <X className="h-4 w-4" />
              Limpiar
            </Button>
          )}
        </div>
      </Card>

      {/* Sessions List */}
      {loading ? (
        <SessionSkeleton />
      ) : filteredSessions.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
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
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredSessions.map((session) => {
            const completedColor = session.completed
              ? "bg-[var(--success)]/15 text-[color:var(--success)]"
              : "bg-[var(--warning)]/15 text-[color:var(--warning)]";

            return (
              <Card
                key={session.id}
                hover
                className="group"
                onClick={() => router.push(`/sessions/${session.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${completedColor}`}
                    >
                      {session.completed ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        <Clock className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {session.routine?.name ?? "Sesion Libre"}
                        </span>
                        <Badge color={session.completed ? "green" : "yellow"} size="sm">
                          {session.completed ? "Completada" : "En progreso"}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(session.date)}
                        </span>
                        {session.duration_minutes && (
                          <span className="flex items-center gap-1">
                            <Timer className="h-3.5 w-3.5" />
                            {formatDuration(session.duration_minutes)}
                          </span>
                        )}
                        {session.completed && session.rating && (
                          <span className="flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 fill-[var(--warning)] text-[color:var(--warning)]" />
                            <span className="text-xs">{ratingLabels[session.rating]}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateSession(session);
                    }}
                    disabled={creating}
                    title="Duplicar sesion"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteSessionId(session.id);
                    }}
                    title="Eliminar sesion"
                  >
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
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
