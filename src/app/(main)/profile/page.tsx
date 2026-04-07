"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Textarea, Select } from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import {
  User,
  Ruler,
  Save,
  Plus,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Scale,
  Calendar,
  Camera,
  Loader2,
  Trash2,
  TrendingUp,
} from "lucide-react";
import type { Profile, BodyMeasurement } from "@/types/database";

const GOALS = [
  { value: "", label: "Seleccionar objetivo" },
  { value: "Fuerza", label: "Fuerza" },
  { value: "Hipertrofia", label: "Hipertrofia" },
  { value: "Pérdida de grasa", label: "Pérdida de grasa" },
  { value: "Resistencia", label: "Resistencia" },
  { value: "General", label: "General" },
];

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDateES(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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

export default function ProfilePage() {
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingMeasurement, setSavingMeasurement] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Profile form
  const [fullName, setFullName] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [goal, setGoal] = useState("");

  // Measurement form
  const [showMeasurementForm, setShowMeasurementForm] = useState(false);
  const [mWeight, setMWeight] = useState("");
  const [mBodyFat, setMBodyFat] = useState("");
  const [mChest, setMChest] = useState("");
  const [mWaist, setMWaist] = useState("");
  const [mArm, setMArm] = useState("");
  const [mLeg, setMLeg] = useState("");
  const [mNotes, setMNotes] = useState("");

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-dismiss message after 4s
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);

  async function loadProfile() {
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

      if (prof) {
        const p = prof as Profile;
        setProfile(p);
        setFullName(p.full_name || "");
        setWeightKg(p.weight_kg?.toString() || "");
        setHeightCm(p.height_cm?.toString() || "");
        setBirthDate(p.birth_date || "");
        setGoal(p.goal || "");
      }

      const { data: ms } = await supabase
        .from("body_measurements")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      if (ms) setMeasurements(ms as BodyMeasurement[]);
    } catch (err) {
      console.error("Error loading profile:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          weight_kg: weightKg ? parseFloat(weightKg) : null,
          height_cm: heightCm ? parseFloat(heightCm) : null,
          birth_date: birthDate || null,
          goal: goal || null,
        })
        .eq("id", profile.id);

      if (error) throw error;
      setMessage({ type: "success", text: "Perfil actualizado correctamente." });
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Error al guardar el perfil." });
    } finally {
      setSaving(false);
    }
  }

  async function handleAddMeasurement(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSavingMeasurement(true);
    setMessage(null);

    try {
      const { error } = await supabase.from("body_measurements").insert({
        user_id: profile.id,
        date: new Date().toISOString().split("T")[0],
        weight_kg: mWeight ? parseFloat(mWeight) : null,
        body_fat_pct: mBodyFat ? parseFloat(mBodyFat) : null,
        chest_cm: mChest ? parseFloat(mChest) : null,
        waist_cm: mWaist ? parseFloat(mWaist) : null,
        arm_cm: mArm ? parseFloat(mArm) : null,
        leg_cm: mLeg ? parseFloat(mLeg) : null,
        notes: mNotes || null,
      });

      if (error) throw error;

      setMessage({ type: "success", text: "Medida registrada correctamente." });
      setMWeight("");
      setMBodyFat("");
      setMChest("");
      setMWaist("");
      setMArm("");
      setMLeg("");
      setMNotes("");
      setShowMeasurementForm(false);
      loadProfile();
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Error al guardar la medida." });
    } finally {
      setSavingMeasurement(false);
    }
  }

  async function handleRemoveAvatar() {
    if (!profile || !profile.avatar_url) return;
    setUploadingAvatar(true);
    setMessage(null);

    try {
      // Remove file from storage
      const url = new URL(profile.avatar_url.split("?")[0]);
      const pathParts = url.pathname.split("/storage/v1/object/public/avatars/");
      if (pathParts[1]) {
        await supabase.storage.from("avatars").remove([decodeURIComponent(pathParts[1])]);
      }

      // Clear avatar_url in profile
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", profile.id);

      if (error) throw error;

      setProfile({ ...profile, avatar_url: null });
      setMessage({ type: "success", text: "Foto de perfil eliminada." });

      // Force header to refresh
      window.dispatchEvent(new CustomEvent("avatar-updated"));
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Error al eliminar la foto." });
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

    if (!allowedTypes.includes(file.type)) {
      setMessage({ type: "error", text: "Solo se permiten imágenes (JPG, PNG, WebP, GIF)." });
      return;
    }
    if (file.size > maxSize) {
      setMessage({ type: "error", text: "La imagen no puede superar los 5MB." });
      return;
    }

    setUploadingAvatar(true);
    setMessage(null);

    try {
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `${profile.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", profile.id);

      if (updateError) throw updateError;

      setProfile({ ...profile, avatar_url: avatarUrl });
      setMessage({ type: "success", text: "Foto de perfil actualizada." });

      // Force header to refresh
      window.dispatchEvent(new CustomEvent("avatar-updated"));
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Error al subir la foto de perfil." });
    } finally {
      setUploadingAvatar(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <User className="h-8 w-8 text-primary animate-pulse" />
          <p className="text-muted text-sm">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Feedback Message */}
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

      {/* Profile Header */}
      {profile && (
        <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-6">
          {/* Avatar */}
          <div className="relative group shrink-0">
            <div
              className="h-20 w-20 rounded-full flex items-center justify-center text-2xl font-bold text-white overflow-hidden"
              style={{ backgroundColor: "var(--accent)" }}
            >
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name || "Avatar"}
                  className="h-full w-full object-cover"
                />
              ) : (
                getInitials(profile.full_name)
              )}
            </div>
            <label
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
              aria-label="Cambiar foto de perfil"
            >
              {uploadingAvatar ? (
                <Loader2 className="h-6 w-6 text-white animate-spin" />
              ) : (
                <Camera className="h-6 w-6 text-white" />
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
                disabled={uploadingAvatar}
              />
            </label>
            {profile.avatar_url && (
              <button
                onClick={handleRemoveAvatar}
                disabled={uploadingAvatar}
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-danger text-white shadow-md transition-transform hover:scale-110 cursor-pointer disabled:opacity-50"
                title="Eliminar foto"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col items-center sm:items-start gap-1.5">
            <h1 className="text-2xl font-bold text-foreground">
              {profile.full_name || "Sin nombre"}
            </h1>
            <p className="text-sm text-muted">{profile.email}</p>
            <div className="flex items-center gap-3 mt-1">
              <Badge color={getRoleColor(profile.role)}>
                {getRoleLabel(profile.role)}
              </Badge>
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <Calendar className="h-3.5 w-3.5" />
                Miembro desde{" "}
                {new Date(profile.created_at).toLocaleDateString("es-ES", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Profile Form */}
      <Card>
        <div className="flex items-center gap-2 mb-5">
          <User className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">
            Datos Personales
          </h2>
        </div>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <Input
            label="Nombre completo"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Tu nombre"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Peso (kg)"
              type="number"
              step="0.1"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="75.0"
            />
            <Input
              label="Altura (cm)"
              type="number"
              step="0.1"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              placeholder="175"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Fecha de nacimiento"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
            <Select
              label="Objetivo"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            >
              {GOALS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={saving}>
              <Save className="h-4 w-4" />
              Guardar Cambios
            </Button>
          </div>
        </form>
      </Card>

      {/* Body Measurements */}
      <Card>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Ruler className="h-5 w-5" style={{ color: "var(--info)" }} />
            <h2 className="text-lg font-semibold text-foreground">
              Medidas Corporales
            </h2>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowMeasurementForm(!showMeasurementForm)}
          >
            {showMeasurementForm ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {showMeasurementForm ? "Cerrar" : "Agregar Medida"}
          </Button>
        </div>

        {/* Expandable Measurement Form */}
        <div
          className={`overflow-hidden transition-all duration-300 ${
            showMeasurementForm ? "max-h-[600px] opacity-100 mb-5" : "max-h-0 opacity-0"
          }`}
        >
          <form
            onSubmit={handleAddMeasurement}
            className="p-4 rounded-lg bg-background border border-card-border space-y-4"
          >
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-muted" />
              <h3 className="text-sm font-medium text-muted">
                Registrar nueva medida
              </h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Input
                label="Peso (kg)"
                type="number"
                step="0.1"
                value={mWeight}
                onChange={(e) => setMWeight(e.target.value)}
                placeholder="75.0"
              />
              <Input
                label="Grasa corporal (%)"
                type="number"
                step="0.1"
                value={mBodyFat}
                onChange={(e) => setMBodyFat(e.target.value)}
                placeholder="15.0"
              />
              <Input
                label="Pecho (cm)"
                type="number"
                step="0.1"
                value={mChest}
                onChange={(e) => setMChest(e.target.value)}
                placeholder="100"
              />
              <Input
                label="Cintura (cm)"
                type="number"
                step="0.1"
                value={mWaist}
                onChange={(e) => setMWaist(e.target.value)}
                placeholder="80"
              />
              <Input
                label="Brazo (cm)"
                type="number"
                step="0.1"
                value={mArm}
                onChange={(e) => setMArm(e.target.value)}
                placeholder="35"
              />
              <Input
                label="Pierna (cm)"
                type="number"
                step="0.1"
                value={mLeg}
                onChange={(e) => setMLeg(e.target.value)}
                placeholder="55"
              />
            </div>
            <Textarea
              label="Notas"
              value={mNotes}
              onChange={(e) => setMNotes(e.target.value)}
              placeholder="Observaciones opcionales..."
              rows={2}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                type="button"
                size="sm"
                onClick={() => setShowMeasurementForm(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" size="sm" loading={savingMeasurement}>
                <Save className="h-3.5 w-3.5" />
                Guardar Medida
              </Button>
            </div>
          </form>
        </div>

        {/* Measurements History Table */}
        {measurements.length > 0 ? (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border text-muted">
                  <th className="text-left py-2.5 pr-3 font-medium">Fecha</th>
                  <th className="text-right py-2.5 px-3 font-medium">Peso</th>
                  <th className="text-right py-2.5 px-3 font-medium">Grasa %</th>
                  <th className="text-right py-2.5 px-3 font-medium hidden sm:table-cell">
                    Pecho
                  </th>
                  <th className="text-right py-2.5 px-3 font-medium hidden sm:table-cell">
                    Cintura
                  </th>
                  <th className="text-right py-2.5 px-3 font-medium hidden md:table-cell">
                    Brazo
                  </th>
                  <th className="text-right py-2.5 pl-3 font-medium hidden md:table-cell">
                    Pierna
                  </th>
                </tr>
              </thead>
              <tbody>
                {measurements.map((m, i) => (
                  <tr
                    key={m.id}
                    className={`text-foreground ${
                      i < measurements.length - 1 ? "border-b border-card-border/50" : ""
                    }`}
                  >
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      {formatDateES(m.date)}
                    </td>
                    <td className="text-right py-2.5 px-3 tabular-nums">
                      {m.weight_kg ? `${m.weight_kg} kg` : "-"}
                    </td>
                    <td className="text-right py-2.5 px-3 tabular-nums">
                      {m.body_fat_pct ? `${m.body_fat_pct}%` : "-"}
                    </td>
                    <td className="text-right py-2.5 px-3 hidden sm:table-cell tabular-nums">
                      {m.chest_cm ? `${m.chest_cm} cm` : "-"}
                    </td>
                    <td className="text-right py-2.5 px-3 hidden sm:table-cell tabular-nums">
                      {m.waist_cm ? `${m.waist_cm} cm` : "-"}
                    </td>
                    <td className="text-right py-2.5 px-3 hidden md:table-cell tabular-nums">
                      {m.arm_cm ? `${m.arm_cm} cm` : "-"}
                    </td>
                    <td className="text-right py-2.5 pl-3 hidden md:table-cell tabular-nums">
                      {m.leg_cm ? `${m.leg_cm} cm` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Ruler className="h-8 w-8 text-muted/40" />
            <p className="text-muted text-sm">
              No hay medidas registradas.
            </p>
            <p className="text-muted/70 text-xs">
              Agrega tu primera medida para hacer seguimiento de tu progreso.
            </p>
          </div>
        )}
      </Card>

      {/* Weight Chart */}
      {(() => {
        const weightData = [...measurements]
          .reverse()
          .filter((m) => m.weight_kg !== null)
          .map((m) => ({ date: m.date, weight: m.weight_kg! }));

        if (weightData.length < 2) return null;

        const weights = weightData.map((d) => d.weight);
        const minW = Math.min(...weights);
        const maxW = Math.max(...weights);
        const padding = Math.max((maxW - minW) * 0.15, 0.5);
        const yMin = minW - padding;
        const yMax = maxW + padding;

        const chartW = 600;
        const chartH = 200;
        const padL = 50;
        const padR = 20;
        const padT = 20;
        const padB = 40;
        const plotW = chartW - padL - padR;
        const plotH = chartH - padT - padB;

        const points = weightData.map((d, i) => {
          const x = padL + (i / (weightData.length - 1)) * plotW;
          const y = padT + plotH - ((d.weight - yMin) / (yMax - yMin)) * plotH;
          return { x, y, ...d };
        });

        const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

        // Y-axis labels (5 ticks)
        const yTicks = Array.from({ length: 5 }, (_, i) => {
          const val = yMin + ((yMax - yMin) * i) / 4;
          const y = padT + plotH - (i / 4) * plotH;
          return { val: Math.round(val * 10) / 10, y };
        });

        return (
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">
                Progreso de Peso
              </h2>
            </div>
            <div className="overflow-x-auto -mx-5 px-5">
              <svg
                viewBox={`0 0 ${chartW} ${chartH}`}
                className="w-full"
                style={{ minWidth: "300px", maxHeight: "250px" }}
              >
                {/* Grid lines */}
                {yTicks.map((tick) => (
                  <g key={tick.val}>
                    <line
                      x1={padL}
                      x2={chartW - padR}
                      y1={tick.y}
                      y2={tick.y}
                      stroke="var(--card-border)"
                      strokeWidth="1"
                      strokeDasharray="4,4"
                    />
                    <text
                      x={padL - 8}
                      y={tick.y + 4}
                      textAnchor="end"
                      fill="var(--muted)"
                      fontSize="11"
                      fontFamily="inherit"
                    >
                      {tick.val}
                    </text>
                  </g>
                ))}

                {/* Line */}
                <path
                  d={linePath}
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Area under line */}
                <path
                  d={`${linePath} L${points[points.length - 1].x},${padT + plotH} L${points[0].x},${padT + plotH} Z`}
                  fill="var(--primary)"
                  opacity="0.08"
                />

                {/* Data points */}
                {points.map((p, i) => (
                  <g key={i}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="4"
                      fill="var(--primary)"
                      stroke="var(--card-bg)"
                      strokeWidth="2"
                    />
                    {/* Date labels (show first, last, and every ~3rd) */}
                    {(i === 0 || i === points.length - 1 || (points.length <= 8) || (i % Math.ceil(points.length / 5) === 0)) && (
                      <text
                        x={p.x}
                        y={chartH - 8}
                        textAnchor="middle"
                        fill="var(--muted)"
                        fontSize="10"
                        fontFamily="inherit"
                      >
                        {new Date(p.date + "T12:00:00").toLocaleDateString("es-ES", {
                          day: "numeric",
                          month: "short",
                        })}
                      </text>
                    )}
                  </g>
                ))}

                {/* Y-axis label */}
                <text
                  x="14"
                  y={padT + plotH / 2}
                  textAnchor="middle"
                  fill="var(--muted)"
                  fontSize="11"
                  fontFamily="inherit"
                  transform={`rotate(-90, 14, ${padT + plotH / 2})`}
                >
                  kg
                </text>
              </svg>
            </div>
          </Card>
        );
      })()}
    </div>
  );
}
