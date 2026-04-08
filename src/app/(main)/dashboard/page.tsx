"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { DAY_NAMES } from "@/lib/constants";
import {
  Dumbbell,
  Flame,
  TrendingUp,
  Calendar,
  Play,
  MessageSquare,
  Users,
  Activity,
  ChevronRight,
  Clock,
} from "lucide-react";
import Link from "next/link";
import type {
  Profile,
  WorkoutSession,
  RoutineAssignment,
  Routine,
  TrainerFeedback,
} from "@/types/database";

function getTodayDayOfWeek(): number {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

function getWeekBounds(): { start: string; end: string } {
  const now = new Date();
  const jsDay = now.getDay();
  const diff = jsDay === 0 ? 6 : jsDay - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return {
    start: monday.toISOString().split("T")[0],
    end: sunday.toISOString().split("T")[0],
  };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatTodayLong(): string {
  return new Date().toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/* ─── Skeleton Components ─── */

function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-[var(--hover-bg)] ${className}`}
    />
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Welcome skeleton */}
      <div className="space-y-2">
        <SkeletonBlock className="h-8 w-64" />
        <SkeletonBlock className="h-5 w-48" />
      </div>

      {/* Hero card skeleton */}
      <Card>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <SkeletonBlock className="h-5 w-5 rounded" />
            <SkeletonBlock className="h-6 w-36" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-2">
              <SkeletonBlock className="h-7 w-56" />
              <SkeletonBlock className="h-4 w-72" />
            </div>
            <SkeletonBlock className="h-12 w-48 rounded-xl" />
          </div>
        </div>
      </Card>

      {/* Stats skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <div className="flex items-center gap-3">
              <SkeletonBlock className="h-11 w-11 rounded-lg" />
              <div className="space-y-2">
                <SkeletonBlock className="h-7 w-16" />
                <SkeletonBlock className="h-3 w-28" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Recent sessions skeleton */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <SkeletonBlock className="h-6 w-44" />
          <SkeletonBlock className="h-8 w-24 rounded-lg" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 rounded-lg border border-card-border"
            >
              <div className="flex items-center gap-3">
                <SkeletonBlock className="h-9 w-9 rounded-lg" />
                <div className="space-y-2">
                  <SkeletonBlock className="h-4 w-36" />
                  <SkeletonBlock className="h-3 w-24" />
                </div>
              </div>
              <SkeletonBlock className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ─── Main Component ─── */

export default function DashboardPage() {
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [todayRoutine, setTodayRoutine] = useState<
    (RoutineAssignment & { routine: Routine }) | null
  >(null);
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
  const [weekSessions, setWeekSessions] = useState<WorkoutSession[]>([]);
  const [weekVolume, setWeekVolume] = useState(0);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState<
    (TrainerFeedback & { trainer?: Profile })[]
  >([]);
  const [trainerActivity, setTrainerActivity] = useState<
    (WorkoutSession & { profile?: Profile })[]
  >([]);
  const [allAssignments, setAllAssignments] = useState<
    (RoutineAssignment & { routine: Routine })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDashboard() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (prof) setProfile(prof as Profile);

      const todayIdx = getTodayDayOfWeek();
      const { start: weekStart, end: weekEnd } = getWeekBounds();

      // Load today's routine assignment
      const { data: assignments } = await supabase
        .from("routine_assignments")
        .select("*, routine:routines(*)")
        .eq("user_id", user.id)
        .eq("active", true);

      if (assignments) {
        setAllAssignments(
          assignments as (RoutineAssignment & { routine: Routine })[]
        );
        const todayAssignment = assignments.find(
          (a: RoutineAssignment & { routine: Routine }) =>
            a.routine?.day_of_week === todayIdx
        );
        if (todayAssignment)
          setTodayRoutine(
            todayAssignment as RoutineAssignment & { routine: Routine }
          );
      }

      // Load recent sessions
      const { data: sessions } = await supabase
        .from("workout_sessions")
        .select("*, routine:routines(name)")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(5);
      if (sessions) setRecentSessions(sessions as WorkoutSession[]);

      // Week sessions for stats
      const { data: wSessions } = await supabase
        .from("workout_sessions")
        .select("*")
        .eq("user_id", user.id)
        .gte("date", weekStart)
        .lte("date", weekEnd);
      if (wSessions) setWeekSessions(wSessions as WorkoutSession[]);

      // Week volume
      if (wSessions && wSessions.length > 0) {
        const sessionIds = wSessions.map(
          (s: WorkoutSession) => s.id
        );
        const { data: sets } = await supabase
          .from("workout_sets")
          .select("weight_kg, reps")
          .in("session_id", sessionIds);
        if (sets) {
          const vol = sets.reduce(
            (sum: number, s: { weight_kg: number; reps: number }) =>
              sum + s.weight_kg * s.reps,
            0
          );
          setWeekVolume(vol);
        }
      }

      // Calculate streak
      const { data: allSessions } = await supabase
        .from("workout_sessions")
        .select("date")
        .eq("user_id", user.id)
        .eq("completed", true)
        .order("date", { ascending: false })
        .limit(60);

      if (allSessions && allSessions.length > 0) {
        const uniqueDates = [
          ...new Set(
            allSessions.map((s: { date: string }) => s.date)
          ),
        ].sort((a, b) => (b > a ? 1 : -1));
        let count = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        for (let i = 0; i < uniqueDates.length; i++) {
          const expected = new Date(today);
          expected.setDate(today.getDate() - i);
          const expStr = expected.toISOString().split("T")[0];
          if (uniqueDates[i] === expStr) {
            count++;
          } else {
            break;
          }
        }
        setStreak(count);
      }

      // Trainer feedback
      if (sessions && sessions.length > 0) {
        const sessionIds = sessions.map(
          (s: WorkoutSession) => s.id
        );
        const { data: fb } = await supabase
          .from("trainer_feedback")
          .select("*, trainer:profiles!trainer_id(*)")
          .in("session_id", sessionIds)
          .order("created_at", { ascending: false })
          .limit(3);
        if (fb)
          setFeedback(
            fb as (TrainerFeedback & { trainer?: Profile })[]
          );
      }

      // Trainer/owner activity
      if (prof && (prof.role === "trainer" || prof.role === "owner")) {
        const { data: activity } = await supabase
          .from("workout_sessions")
          .select(
            "*, routine:routines(name), profile:profiles!user_id(*)"
          )
          .order("date", { ascending: false })
          .limit(10);
        if (activity)
          setTrainerActivity(
            activity as (WorkoutSession & { profile?: Profile })[]
          );
      }
    } catch (err) {
      console.error("Error loading dashboard:", err);
      setError("Error al cargar el dashboard. Recarga la página.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-danger">{error}</p>
        <Button onClick={() => { setError(null); setLoading(true); loadDashboard(); }}>
          Reintentar
        </Button>
      </div>
    );
  }

  const todayDayName = DAY_NAMES[getTodayDayOfWeek()];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ─── Welcome ─── */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Hola, {profile?.full_name?.split(" ")[0] || "Atleta"}
        </h1>
        <p className="text-muted mt-1">
          {todayDayName}, {formatTodayLong()}
        </p>
      </div>

      {/* ─── Today's Routine Hero ─── */}
      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-primary/15">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              Hoy te toca
            </h2>
          </div>

          {todayRoutine ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-xl font-bold text-primary truncate">
                  {todayRoutine.routine.name}
                </h3>
                {todayRoutine.routine.description && (
                  <p className="text-muted text-sm mt-1 line-clamp-2">
                    {todayRoutine.routine.description}
                  </p>
                )}
              </div>
              <Link
                href={`/sessions/new?routine=${todayRoutine.routine_id}`}
                className="shrink-0"
              >
                <Button size="lg" className="gap-2 w-full sm:w-auto">
                  <Play className="h-5 w-5" />
                  Iniciar Entrenamiento
                </Button>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="font-medium text-foreground">Día libre</p>
                <p className="text-sm text-muted mt-0.5">
                  Sin rutina asignada para hoy. Podés hacer una sesión libre.
                </p>
              </div>
              <Link href="/sessions" className="shrink-0">
                <Button variant="secondary" size="lg" className="w-full sm:w-auto gap-2">
                  <Play className="h-5 w-5" />
                  Sesión libre
                </Button>
              </Link>
            </div>
          )}
        </div>
      </Card>

      {/* ─── Stats Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[var(--success)]/10">
              <Activity className="h-5 w-5 text-[var(--success)]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {weekSessions.length}
              </p>
              <p className="text-xs text-muted">Sesiones esta semana</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[var(--warning)]/10">
              <Flame className="h-5 w-5 text-[var(--warning)]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {streak} {streak === 1 ? "dia" : "dias"}
              </p>
              <p className="text-xs text-muted">Racha consecutiva</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[var(--info)]/10">
              <TrendingUp className="h-5 w-5 text-[var(--info)]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {weekVolume >= 1000
                  ? `${(weekVolume / 1000).toFixed(1)}t`
                  : `${Math.round(weekVolume)} kg`}
              </p>
              <p className="text-xs text-muted">Volumen semanal</p>
            </div>
          </div>
        </Card>
      </div>

      {/* ─── Weekly Calendar ─── */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">Tu semana</h2>
          <span className="text-xs text-muted">
            {weekSessions.filter(s => s.completed).length} de{" "}
            {allAssignments.length} entrenamientos
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {(() => {
            const now = new Date();
            const jsDay = now.getDay();
            const diff = jsDay === 0 ? 6 : jsDay - 1;
            const monday = new Date(now);
            monday.setDate(now.getDate() - diff);
            monday.setHours(0, 0, 0, 0);
            const todayIdx = getTodayDayOfWeek();

            return DAY_NAMES.map((dayName, i) => {
              const dayDate = new Date(monday);
              dayDate.setDate(monday.getDate() + i);
              const dateStr = dayDate.toISOString().split("T")[0];
              const isToday = i === todayIdx;
              const isPast = dayDate < new Date(now.toDateString());
              const assignment = allAssignments.find((a) => a.routine?.day_of_week === i);
              const trained = weekSessions.some((s) => s.date === dateStr && s.completed);

              const dayContent = (
                <div
                  className={`flex flex-col items-center gap-1 rounded-xl p-2 transition-colors ${
                    isToday
                      ? "bg-primary text-white"
                      : trained
                      ? "bg-[var(--success)]/15 text-[color:var(--success)]"
                      : assignment
                      ? "bg-card-bg border border-card-border text-foreground hover:border-primary/40"
                      : "bg-transparent text-muted"
                  }`}
                >
                  <span className={`text-[10px] font-semibold uppercase ${isToday ? "text-white/70" : "text-inherit opacity-60"}`}>
                    {dayName.slice(0, 2)}
                  </span>
                  <span className={`text-base font-bold leading-none ${isToday ? "text-white" : ""}`}>
                    {dayDate.getDate()}
                  </span>
                  <div className="h-1.5 w-1.5 rounded-full">
                    {trained ? (
                      <div className="h-1.5 w-1.5 rounded-full bg-[color:var(--success)]" />
                    ) : assignment && !isPast ? (
                      <div className="h-1.5 w-1.5 rounded-full bg-primary/50" />
                    ) : (
                      <div className="h-1.5 w-1.5 rounded-full" />
                    )}
                  </div>
                </div>
              );

              return (
                <div key={i}>
                  {assignment && !trained ? (
                    <Link href={`/sessions/new?routine=${assignment.routine_id}`}>
                      {dayContent}
                    </Link>
                  ) : (
                    dayContent
                  )}
                </div>
              );
            });
          })()}
        </div>
        {/* Legend */}
        <div className="mt-3 flex items-center gap-4 text-xs text-muted border-t border-card-border pt-3">
          <span className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-[var(--success)]/50" />
            Completado
          </span>
          <span className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-primary/30" />
            Planificado
          </span>
        </div>
      </Card>

      {/* ─── Recent Sessions ─── */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            Sesiones Recientes
          </h2>
          <Link href="/sessions">
            <Button variant="ghost" size="sm" className="gap-1">
              Ver todas
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {recentSessions.length > 0 ? (
          <div className="space-y-2">
            {recentSessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-3 rounded-lg bg-background border border-card-border transition-colors hover:bg-[var(--hover-bg)]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-card-bg border border-card-border shrink-0">
                    <Dumbbell className="h-4 w-4 text-muted" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {(session.routine as unknown as { name: string })
                        ?.name || "Sesion libre"}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <span>{formatDate(session.date)}</span>
                      {session.duration_minutes && (
                        <>
                          <span className="text-card-border">·</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {session.duration_minutes} min
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <Badge
                  color={session.completed ? "green" : "yellow"}
                  className="shrink-0 ml-2"
                >
                  {session.completed ? "Completada" : "En progreso"}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center p-3 rounded-full bg-[var(--hover-bg)] mb-3">
              <Dumbbell className="h-6 w-6 text-muted" />
            </div>
            <p className="text-muted text-sm">
              Aun no tienes sesiones registradas.
            </p>
            <p className="text-muted text-xs mt-1">
              Inicia tu primer entrenamiento para ver tu progreso aqui.
            </p>
          </div>
        )}
      </Card>

      {/* ─── Trainer Feedback ─── */}
      {feedback.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-[var(--accent)]/15">
              <MessageSquare className="h-4 w-4 text-[var(--accent)]" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              Feedback de tu Entrenador
            </h2>
          </div>
          <div className="space-y-3">
            {feedback.map((fb) => (
              <div
                key={fb.id}
                className="p-3 rounded-lg bg-background border border-card-border"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-[var(--accent)]">
                    {fb.trainer?.full_name || "Entrenador"}
                  </span>
                  <span className="text-xs text-muted">
                    {new Date(fb.created_at).toLocaleDateString("es-ES", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
                <p className="text-sm text-foreground leading-relaxed">
                  {fb.message}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ─── Trainer/Owner: User Activity ─── */}
      {profile &&
        (profile.role === "trainer" || profile.role === "owner") && (
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-[var(--info)]/15">
                <Users className="h-4 w-4 text-[var(--info)]" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">
                Actividad de Usuarios
              </h2>
            </div>

            {trainerActivity.length > 0 ? (
              <div className="space-y-2">
                {trainerActivity.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-background border border-card-border transition-colors hover:bg-[var(--hover-bg)]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-card-bg border border-card-border shrink-0">
                        <Dumbbell className="h-4 w-4 text-muted" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {(session.profile as unknown as Profile)
                            ?.full_name || "Usuario"}
                        </p>
                        <p className="text-xs text-muted">
                          {(
                            session.routine as unknown as { name: string }
                          )?.name || "Sesion libre"}{" "}
                          · {formatDate(session.date)}
                        </p>
                      </div>
                    </div>
                    <Badge
                      color={session.completed ? "green" : "yellow"}
                      className="shrink-0 ml-2"
                    >
                      {session.completed ? "Completada" : "En progreso"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted text-sm text-center py-6">
                No hay actividad reciente de usuarios.
              </p>
            )}
          </Card>
        )}
    </div>
  );
}
