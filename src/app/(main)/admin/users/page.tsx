"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import { Select } from "@/components/ui/Input";
import {
  Users,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Calendar,
  UserCog,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Search,
  TrendingUp,
  Ban,
  ShieldCheck,
} from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Link from "next/link";
import type {
  Profile,
  WorkoutSession,
  RoutineAssignment,
  Routine,
  UserRole,
} from "@/types/database";

interface UserWithStats extends Profile {
  lastSessionDate: string | null;
  totalSessions: number;
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getRoleLabel(role: string): string {
  if (role === "owner") return "Propietario";
  if (role === "trainer") return "Entrenador";
  return "Usuario";
}

function getRoleColor(role: string): "purple" | "blue" | "gray" {
  if (role === "owner") return "purple";
  if (role === "trainer") return "blue";
  return "gray";
}

function formatDateShortES(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
}

const DAY_NAMES = [
  "Lunes",
  "Martes",
  "Miercoles",
  "Jueves",
  "Viernes",
  "Sabado",
  "Domingo",
];

export default function AdminUsersPage() {
  const supabase = createClient();
  const router = useRouter();

  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [userRoutines, setUserRoutines] = useState<
    (RoutineAssignment & { routine?: Routine })[]
  >([]);
  const [userSessions, setUserSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [banTarget, setBanTarget] = useState<UserWithStats | null>(null);

  const isOwner = currentProfile?.role === "owner";

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-dismiss message
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase().trim();
    return users.filter(
      (u) =>
        (u.full_name && u.full_name.toLowerCase().includes(q)) ||
        u.email.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  async function loadUsers() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!prof || (prof.role !== "owner" && prof.role !== "trainer")) {
        router.push("/dashboard");
        return;
      }

      setCurrentProfile(prof as Profile);

      // Load all users
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (!profiles) return;

      // Load session counts and last session date per user
      const usersWithStats: UserWithStats[] = [];

      for (const p of profiles) {
        const { count } = await supabase
          .from("workout_sessions")
          .select("*", { count: "exact", head: true })
          .eq("user_id", p.id);

        const { data: lastSession } = await supabase
          .from("workout_sessions")
          .select("date")
          .eq("user_id", p.id)
          .order("date", { ascending: false })
          .limit(1);

        usersWithStats.push({
          ...(p as Profile),
          totalSessions: count || 0,
          lastSessionDate:
            lastSession && lastSession.length > 0
              ? lastSession[0].date
              : null,
        });
      }

      setUsers(usersWithStats);
    } catch (err) {
      console.error("Error loading users:", err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleExpand(userId: string) {
    if (expandedUser === userId) {
      setExpandedUser(null);
      return;
    }

    setExpandedUser(userId);
    setLoadingDetails(true);

    try {
      // Load user's routines
      const { data: assignments } = await supabase
        .from("routine_assignments")
        .select("*, routine:routines(*)")
        .eq("user_id", userId)
        .eq("active", true);

      if (assignments)
        setUserRoutines(
          assignments as (RoutineAssignment & { routine?: Routine })[]
        );

      // Load user's recent sessions
      const { data: sessions } = await supabase
        .from("workout_sessions")
        .select("*, routine:routines(name)")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(5);

      if (sessions) setUserSessions(sessions as WorkoutSession[]);
    } catch (err) {
      console.error("Error loading user details:", err);
    } finally {
      setLoadingDetails(false);
    }
  }

  async function handleRoleChange(userId: string, newRole: UserRole) {
    setMessage(null);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", userId);

      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      setMessage({ type: "success", text: "Rol actualizado correctamente." });
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Error al cambiar el rol." });
    }
  }

  async function handleBanToggle(user: UserWithStats) {
    const newBanned = !user.banned;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ banned: newBanned })
        .eq("id", user.id);

      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, banned: newBanned } : u))
      );
      setBanTarget(null);
      setMessage({
        type: "success",
        text: newBanned
          ? `${user.full_name || "Usuario"} ha sido baneado.`
          : `${user.full_name || "Usuario"} ha sido desbaneado.`,
      });
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Error al actualizar el estado del usuario." });
      setBanTarget(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <Users className="h-8 w-8 text-primary animate-pulse" />
          <p className="text-muted text-sm">Cargando usuarios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: "color-mix(in srgb, var(--info) 15%, transparent)" }}
          >
            <UserCog className="h-6 w-6" style={{ color: "var(--info)" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Gestion de Usuarios
            </h1>
            <p className="text-sm text-muted">
              {users.length} usuario{users.length !== 1 ? "s" : ""} registrado{users.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar por nombre o email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-[var(--input-border)] bg-input-bg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted outline-none transition-all duration-200 focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Message */}
      {message && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg border text-sm transition-all duration-300 ${
            message.type === "success"
              ? "border-[var(--success)]/25 text-[var(--success)]"
              : "bg-danger/10 border-danger/25 text-danger"
          }`}
          style={
            message.type === "success"
              ? { backgroundColor: "color-mix(in srgb, var(--success) 10%, transparent)" }
              : undefined
          }
        >
          {message.type === "success" ? (
            <CheckCircle className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      {/* Users List */}
      <div className="space-y-3">
        {filteredUsers.map((u) => (
          <Card key={u.id} className="p-0 overflow-hidden">
            {/* User Row */}
            <button
              onClick={() => toggleExpand(u.id)}
              className="w-full p-4 flex items-center justify-between hover:bg-[var(--hover-bg)] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center text-white font-medium text-sm shrink-0"
                  style={{ backgroundColor: "var(--accent)" }}
                >
                  {getInitials(u.full_name)}
                </div>
                <div className="text-left min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {u.full_name || "Sin nombre"}
                  </p>
                  <p className="text-xs text-muted truncate">{u.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {/* Stats on desktop */}
                <div className="hidden sm:flex items-center gap-4 text-xs text-muted mr-2">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5" />
                    {u.totalSessions} sesiones
                  </span>
                  <span>
                    {u.lastSessionDate
                      ? `Ultima: ${formatDateShortES(u.lastSessionDate)}`
                      : "Sin sesiones"}
                  </span>
                </div>
                {u.banned && (
                  <Badge color="red" size="sm">
                    Baneado
                  </Badge>
                )}
                <Badge color={getRoleColor(u.role)} size="sm">
                  {getRoleLabel(u.role)}
                </Badge>
                {expandedUser === u.id ? (
                  <ChevronUp className="h-4 w-4 text-muted" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted" />
                )}
              </div>
            </button>

            {/* Expanded Details */}
            {expandedUser === u.id && (
              <div className="border-t border-card-border p-4 bg-background space-y-4">
                {loadingDetails ? (
                  <p className="text-muted text-sm text-center py-4 animate-pulse">
                    Cargando detalles...
                  </p>
                ) : (
                  <>
                    {/* Mobile stats */}
                    <div className="sm:hidden flex items-center gap-4 text-xs text-muted">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3.5 w-3.5" />
                        {u.totalSessions} sesiones
                      </span>
                      <span>
                        {u.lastSessionDate
                          ? `Ultima: ${formatDateShortES(u.lastSessionDate)}`
                          : "Sin sesiones"}
                      </span>
                    </div>

                    {/* Assigned Routines */}
                    <div>
                      <h3 className="text-sm font-medium text-muted mb-2 flex items-center gap-1.5">
                        <Dumbbell className="h-4 w-4" />
                        Rutinas Asignadas
                      </h3>
                      {userRoutines.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {userRoutines.map((ra) => (
                            <div
                              key={ra.id}
                              className="px-3 py-1.5 rounded-lg bg-card-bg border border-card-border text-sm text-foreground"
                            >
                              {ra.routine?.name || "Rutina"}{" "}
                              {ra.routine?.day_of_week != null && (
                                <span className="text-muted">
                                  ({DAY_NAMES[ra.routine.day_of_week]})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted">
                          Sin rutinas asignadas.
                        </p>
                      )}
                    </div>

                    {/* Recent Sessions */}
                    <div>
                      <h3 className="text-sm font-medium text-muted mb-2 flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        Sesiones Recientes
                      </h3>
                      {userSessions.length > 0 ? (
                        <div className="space-y-1.5">
                          {userSessions.map((s) => (
                            <div
                              key={s.id}
                              className="flex items-center justify-between px-3 py-2 rounded-lg bg-card-bg border border-card-border text-sm"
                            >
                              <span className="text-foreground">
                                {(
                                  s.routine as unknown as { name: string }
                                )?.name || "Sesion libre"}{" "}
                                -{" "}
                                {formatDateShortES(s.date)}
                              </span>
                              <Badge
                                color={s.completed ? "green" : "yellow"}
                                size="sm"
                              >
                                {s.completed ? "Completada" : "En progreso"}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted">
                          Sin sesiones registradas.
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-card-border">
                      <Link href={`/progress?user=${u.id}`}>
                        <Button variant="secondary" size="sm">
                          <ExternalLink className="h-3.5 w-3.5" />
                          Ver Progreso
                        </Button>
                      </Link>

                      <Link href={`/routines?assign=${u.id}`}>
                        <Button variant="secondary" size="sm">
                          <Dumbbell className="h-3.5 w-3.5" />
                          Asignar Rutina
                        </Button>
                      </Link>

                      {/* Owner-only controls */}
                      {isOwner && u.id !== currentProfile?.id && (
                        <>
                          {/* Role change */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted">Rol:</span>
                            <Select
                              value={u.role}
                              onChange={(e) =>
                                handleRoleChange(
                                  u.id,
                                  e.target.value as UserRole
                                )
                              }
                              className="w-auto !py-1.5 text-xs"
                            >
                              <option value="user">Usuario</option>
                              <option value="trainer">Entrenador</option>
                              <option value="owner">Propietario</option>
                            </Select>
                          </div>

                          {/* Ban/Unban */}
                          {u.banned ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setBanTarget(u)}
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Desbanear
                            </Button>
                          ) : (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => setBanTarget(u)}
                            >
                              <Ban className="h-3.5 w-3.5" />
                              Banear
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Empty states */}
      {filteredUsers.length === 0 && searchQuery.trim() && (
        <Card>
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Search className="h-8 w-8 text-muted/40" />
            <p className="text-muted text-sm">
              No se encontraron usuarios para &quot;{searchQuery}&quot;
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery("")}
            >
              Limpiar busqueda
            </Button>
          </div>
        </Card>
      )}

      {users.length === 0 && !searchQuery.trim() && (
        <Card>
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Users className="h-8 w-8 text-muted/40" />
            <p className="text-muted text-sm">
              No hay usuarios registrados.
            </p>
          </div>
        </Card>
      )}

      {/* Ban/Unban confirm */}
      <ConfirmDialog
        open={!!banTarget}
        onClose={() => setBanTarget(null)}
        onConfirm={() => {
          if (banTarget) handleBanToggle(banTarget);
        }}
        title={banTarget?.banned ? "Desbanear usuario" : "Banear usuario"}
        message={
          banTarget?.banned
            ? `¿Desbanear a ${banTarget?.full_name || "este usuario"}? Podrá volver a acceder a la app.`
            : `¿Banear a ${banTarget?.full_name || "este usuario"}? No podrá acceder a la app hasta que lo desbanees.`
        }
        confirmText={banTarget?.banned ? "Desbanear" : "Banear"}
        variant={banTarget?.banned ? "primary" : "danger"}
      />
    </div>
  );
}
