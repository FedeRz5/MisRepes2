"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import { Select } from "@/components/ui/Input";
import {
  Shield,
  Link as LinkIcon,
  Copy,
  Users,
  Activity,
  CheckCircle,
  AlertCircle,
  Clock,
  Check,
  Zap,
} from "lucide-react";
import type { Profile, Invitation, UserRole } from "@/types/database";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function getExpirationDate(days: number): string {
  if (days === 0) {
    // "Permanente" - 100 years
    const d = new Date();
    d.setFullYear(d.getFullYear() + 100);
    return d.toISOString();
  }
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function getInvitationStatus(
  inv: Invitation
): { label: string; color: "green" | "red" | "gray" | "yellow" } {
  if (inv.used_by) return { label: "Usada", color: "gray" };
  if (new Date(inv.expires_at) < new Date())
    return { label: "Expirada", color: "red" };
  return { label: "Activa", color: "green" };
}

function formatDateES(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdminPage() {
  const supabase = createClient();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Generation form
  const [invRole, setInvRole] = useState<UserRole>("user");
  const [invExpDays, setInvExpDays] = useState("7");
  const [generatedCode, setGeneratedCode] = useState("");

  // Stats
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [activeThisWeek, setActiveThisWeek] = useState(0);

  useEffect(() => {
    loadAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-dismiss message
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);

  async function loadAdmin() {
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

      if (!prof || prof.role !== "owner") {
        router.push("/dashboard");
        return;
      }

      setProfile(prof as Profile);

      // Load invitations
      const { data: invs } = await supabase
        .from("invitations")
        .select("*")
        .order("created_at", { ascending: false });
      if (invs) setInvitations(invs as Invitation[]);

      // Stats
      const { count: usersCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });
      setTotalUsers(usersCount || 0);

      const { count: sessionsCount } = await supabase
        .from("workout_sessions")
        .select("*", { count: "exact", head: true });
      setTotalSessions(sessionsCount || 0);

      // Active users this week
      const now = new Date();
      const jsDay = now.getDay();
      const diff = jsDay === 0 ? 6 : jsDay - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diff);
      const weekStart = monday.toISOString().split("T")[0];

      const { data: activeSessions } = await supabase
        .from("workout_sessions")
        .select("user_id")
        .gte("date", weekStart);

      if (activeSessions) {
        const uniqueUsers = new Set(
          activeSessions.map((s: { user_id: string }) => s.user_id)
        );
        setActiveThisWeek(uniqueUsers.size);
      }
    } catch (err) {
      console.error("Error loading admin:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!profile) return;
    setGenerating(true);
    setMessage(null);
    setGeneratedCode("");
    setCopied(false);

    try {
      const code = generateCode();
      const expiresAt = getExpirationDate(parseInt(invExpDays));

      const { error } = await supabase.from("invitations").insert({
        code,
        created_by: profile.id,
        role: invRole,
        expires_at: expiresAt,
      });

      if (error) throw error;

      setGeneratedCode(code);
      setMessage({
        type: "success",
        text: "Invitacion generada correctamente.",
      });
      loadAdmin();
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Error al generar la invitacion." });
    } finally {
      setGenerating(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setMessage({ type: "success", text: "Copiado al portapapeles." });
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <Shield className="h-8 w-8 animate-pulse" style={{ color: "var(--accent)" }} />
          <p className="text-muted text-sm">Cargando panel de administracion...</p>
        </div>
      </div>
    );
  }

  const fullURL = generatedCode
    ? `${window.location.origin}/register?code=${generatedCode}`
    : "";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="p-2 rounded-lg"
          style={{ backgroundColor: "color-mix(in srgb, var(--accent) 15%, transparent)" }}
        >
          <Shield className="h-6 w-6" style={{ color: "var(--accent)" }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Panel de Administracion
          </h1>
          <p className="text-sm text-muted">
            Gestiona usuarios, invitaciones y estadisticas
          </p>
        </div>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-lg"
              style={{ backgroundColor: "color-mix(in srgb, var(--info) 15%, transparent)" }}
            >
              <Users className="h-5 w-5" style={{ color: "var(--info)" }} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground tabular-nums">{totalUsers}</p>
              <p className="text-xs text-muted">Total Usuarios</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-lg"
              style={{ backgroundColor: "color-mix(in srgb, var(--success) 15%, transparent)" }}
            >
              <Activity className="h-5 w-5" style={{ color: "var(--success)" }} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground tabular-nums">{totalSessions}</p>
              <p className="text-xs text-muted">Total Sesiones</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-lg"
              style={{ backgroundColor: "color-mix(in srgb, var(--warning) 15%, transparent)" }}
            >
              <Zap className="h-5 w-5" style={{ color: "var(--warning)" }} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground tabular-nums">{activeThisWeek}</p>
              <p className="text-xs text-muted">Activos esta semana</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Generate Invitation */}
      <Card>
        <div className="flex items-center gap-2 mb-5">
          <LinkIcon className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">
            Generar Invitacion
          </h2>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="w-full sm:w-auto sm:min-w-[160px]">
            <Select
              label="Rol"
              value={invRole}
              onChange={(e) => setInvRole(e.target.value as UserRole)}
            >
              <option value="user">Usuario</option>
              <option value="trainer">Entrenador</option>
            </Select>
          </div>

          <div className="w-full sm:w-auto sm:min-w-[160px]">
            <Select
              label="Expiracion"
              value={invExpDays}
              onChange={(e) => setInvExpDays(e.target.value)}
            >
              <option value="1">1 dia</option>
              <option value="7">7 dias</option>
              <option value="30">30 dias</option>
              <option value="0">Permanente</option>
            </Select>
          </div>

          <Button onClick={handleGenerate} loading={generating}>
            <LinkIcon className="h-4 w-4" />
            Generar
          </Button>
        </div>

        {/* Generated Code Display */}
        {generatedCode && (
          <div className="mt-5 p-4 rounded-lg bg-background border border-card-border space-y-3">
            {/* Code */}
            <div>
              <p className="text-xs text-muted mb-1.5">Codigo de invitacion</p>
              <div className="flex items-center gap-2">
                <code
                  className="flex-1 text-lg font-mono font-bold tracking-widest px-4 py-2.5 rounded-lg border border-card-border bg-card-bg text-foreground text-center"
                >
                  {generatedCode}
                </code>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => copyToClipboard(generatedCode)}
                >
                  {copied ? (
                    <Check className="h-4 w-4" style={{ color: "var(--success)" }} />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Full URL */}
            <div>
              <p className="text-xs text-muted mb-1.5">Enlace completo</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs px-3 py-2 rounded-lg border border-card-border bg-card-bg text-muted overflow-x-auto whitespace-nowrap">
                  {fullURL}
                </code>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => copyToClipboard(fullURL)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Invitations List */}
      <Card>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted" />
            <h2 className="text-lg font-semibold text-foreground">
              Invitaciones
            </h2>
          </div>
          <Badge color="gray" size="sm">
            {invitations.length} total
          </Badge>
        </div>

        {invitations.length > 0 ? (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border text-muted">
                  <th className="text-left py-2.5 pr-3 font-medium">Codigo</th>
                  <th className="text-left py-2.5 px-3 font-medium">Rol</th>
                  <th className="text-left py-2.5 px-3 font-medium">Estado</th>
                  <th className="text-left py-2.5 px-3 font-medium hidden sm:table-cell">
                    Expira
                  </th>
                  <th className="text-left py-2.5 px-3 font-medium hidden md:table-cell">
                    Creada
                  </th>
                  <th className="text-right py-2.5 pl-3 font-medium">Accion</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv, i) => {
                  const status = getInvitationStatus(inv);
                  return (
                    <tr
                      key={inv.id}
                      className={`text-foreground ${
                        i < invitations.length - 1
                          ? "border-b border-card-border/50"
                          : ""
                      }`}
                    >
                      <td className="py-2.5 pr-3">
                        <code className="text-xs font-mono bg-background px-2 py-0.5 rounded border border-card-border/50">
                          {inv.code}
                        </code>
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          color={inv.role === "trainer" ? "blue" : "gray"}
                          size="sm"
                        >
                          {inv.role === "trainer" ? "Entrenador" : "Usuario"}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge color={status.color} size="sm" dot>
                          {status.label}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-muted text-xs hidden sm:table-cell">
                        {formatDateES(inv.expires_at)}
                      </td>
                      <td className="py-2.5 px-3 text-muted text-xs hidden md:table-cell">
                        {formatDateES(inv.created_at)}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        {status.label === "Activa" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              copyToClipboard(
                                `${window.location.origin}/register?code=${inv.code}`
                              )
                            }
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <LinkIcon className="h-8 w-8 text-muted/40" />
            <p className="text-muted text-sm">
              No hay invitaciones generadas.
            </p>
            <p className="text-muted/70 text-xs">
              Genera tu primera invitacion para agregar usuarios al sistema.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
