"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Exercise,
  Profile,
  MuscleGroup,
  Equipment,
  ExerciseType,
} from "@/types/database";
import {
  MUSCLE_GROUPS,
  EQUIPMENT_TYPES,
  EXERCISE_TYPES,
} from "@/lib/constants";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Textarea, Select } from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import {
  Search,
  Plus,
  Dumbbell,
  ChevronDown,
  ChevronUp,
  Globe,
  User,
  Filter,
  X,
  Play,
  Pencil,
  Check,
  Loader2,
  Trophy,
  Calendar,
  History,
} from "lucide-react";

/* ─── Color Maps ─── */

const muscleGroupColor: Record<
  string,
  "green" | "blue" | "red" | "yellow" | "purple" | "gray"
> = {
  pecho: "blue",
  espalda: "green",
  hombros: "yellow",
  biceps: "purple",
  triceps: "purple",
  piernas: "red",
  gluteos: "red",
  abdominales: "yellow",
  antebrazos: "gray",
  pantorrillas: "gray",
  cuerpo_completo: "green",
};

const equipmentColor: Record<
  string,
  "green" | "blue" | "red" | "yellow" | "purple" | "gray"
> = {
  barra: "blue",
  mancuerna: "purple",
  maquina: "gray",
  cable: "yellow",
  peso_corporal: "green",
  banda: "red",
  kettlebell: "purple",
  otro: "gray",
};

function getLabelFor(
  value: string,
  list: readonly { value: string; label: string }[]
) {
  return list.find((item) => item.value === value)?.label ?? value;
}

/* ─── Skeleton ─── */

function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-[var(--hover-bg)] ${className}`}
    />
  );
}

function ExercisesSkeleton() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <SkeletonBlock className="h-8 w-40" />
          <SkeletonBlock className="h-4 w-28" />
        </div>
        <SkeletonBlock className="h-10 w-44 rounded-lg" />
      </div>

      {/* Filters */}
      <Card className="space-y-4">
        <SkeletonBlock className="h-10 w-full rounded-lg" />
        <div className="flex flex-col sm:flex-row gap-3">
          <SkeletonBlock className="h-10 flex-1 rounded-lg" />
          <SkeletonBlock className="h-10 flex-1 rounded-lg" />
          <SkeletonBlock className="h-10 flex-1 rounded-lg" />
        </div>
      </Card>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}>
            <div className="space-y-3">
              <SkeletonBlock className="h-5 w-3/4" />
              <div className="flex gap-2">
                <SkeletonBlock className="h-6 w-16 rounded-full" />
                <SkeletonBlock className="h-6 w-16 rounded-full" />
                <SkeletonBlock className="h-6 w-16 rounded-full" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Component ─── */

export default function ExercisesPage() {
  const supabase = createClient();

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exerciseHistory, setExerciseHistory] = useState<Map<string, {
    entries: { date: string; sets: number; reps: number; maxWeight: number }[];
    prWeight: number;
    pr1RM: number;
    loading: boolean;
  }>>(new Map());

  // Filters
  const [search, setSearch] = useState("");
  const [filterMuscle, setFilterMuscle] = useState("");
  const [filterEquipment, setFilterEquipment] = useState("");
  const [filterType, setFilterType] = useState("");

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Form state
  const [form, setForm] = useState({
    name: "",
    muscle_group: "pecho" as MuscleGroup,
    secondary_muscle_group: "" as MuscleGroup | "",
    exercise_type: "compuesto" as ExerciseType,
    equipment: "barra" as Equipment,
    instructions: "",
    video_url: "",
    is_global: false,
  });

  // Edit mode
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVideoUrl, setEditVideoUrl] = useState("");
  const [savingVideo, setSavingVideo] = useState(false);

  const isStaff =
    profile?.role === "trainer" || profile?.role === "owner";
  const hasActiveFilters = !!(search || filterMuscle || filterEquipment || filterType);

  useEffect(() => {
    fetchProfile();
    fetchExercises();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    if (data) setProfile(data as Profile);
  }

  async function fetchExercises() {
    setLoading(true);
    const { data } = await supabase
      .from("exercises")
      .select("*")
      .order("name");
    if (data) setExercises(data as Exercise[]);
    setLoading(false);
  }

  async function loadExerciseHistory(exerciseId: string) {
    if (exerciseHistory.has(exerciseId)) return;

    setExerciseHistory((prev) => new Map(prev).set(exerciseId, {
      entries: [], prWeight: 0, pr1RM: 0, loading: true,
    }));

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: sets } = await supabase
      .from("workout_sets")
      .select("*, session:workout_sessions!inner(date, user_id, completed)")
      .eq("exercise_id", exerciseId)
      .eq("session.user_id", user.id)
      .eq("session.completed", true)
      .eq("completed", true)
      .order("session(date)", { ascending: false });

    if (!sets || sets.length === 0) {
      setExerciseHistory((prev) => new Map(prev).set(exerciseId, {
        entries: [], prWeight: 0, pr1RM: 0, loading: false,
      }));
      return;
    }

    // Group by session date
    const byDate = new Map<string, { sets: number; reps: number; maxWeight: number }>();
    let prWeight = 0;
    let pr1RM = 0;

    for (const s of sets as any[]) {
      const date = s.session.date;
      const existing = byDate.get(date) ?? { sets: 0, reps: 0, maxWeight: 0 };
      existing.sets += 1;
      existing.reps += s.reps;
      existing.maxWeight = Math.max(existing.maxWeight, s.weight_kg);
      byDate.set(date, existing);

      prWeight = Math.max(prWeight, s.weight_kg);
      // Epley formula for estimated 1RM
      if (s.reps > 0 && s.weight_kg > 0) {
        const e1rm = s.reps === 1 ? s.weight_kg : s.weight_kg * (1 + s.reps / 30);
        pr1RM = Math.max(pr1RM, e1rm);
      }
    }

    const entries = Array.from(byDate.entries())
      .slice(0, 5)
      .map(([date, data]) => ({ date, ...data }));

    setExerciseHistory((prev) => new Map(prev).set(exerciseId, {
      entries,
      prWeight: Math.round(prWeight * 10) / 10,
      pr1RM: Math.round(pr1RM * 10) / 10,
      loading: false,
    }));
  }

  const filtered = useMemo(() => {
    return exercises.filter((ex) => {
      const matchesSearch =
        !search || ex.name.toLowerCase().includes(search.toLowerCase());
      const matchesMuscle =
        !filterMuscle || ex.muscle_group === filterMuscle;
      const matchesEquipment =
        !filterEquipment || ex.equipment === filterEquipment;
      const matchesType =
        !filterType || ex.exercise_type === filterType;
      return matchesSearch && matchesMuscle && matchesEquipment && matchesType;
    });
  }, [exercises, search, filterMuscle, filterEquipment, filterType]);

  function clearFilters() {
    setSearch("");
    setFilterMuscle("");
    setFilterEquipment("");
    setFilterType("");
  }

  function getYouTubeId(url: string): string | null {
    const match = url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/
    );
    return match ? match[1] : null;
  }

  async function handleSaveVideo(exerciseId: string) {
    setSavingVideo(true);
    const { error } = await supabase
      .from("exercises")
      .update({ video_url: editVideoUrl.trim() || null })
      .eq("id", exerciseId);
    if (!error) {
      setExercises((prev) =>
        prev.map((ex) =>
          ex.id === exerciseId
            ? { ...ex, video_url: editVideoUrl.trim() || null }
            : ex
        )
      );
      setEditingId(null);
      setEditVideoUrl("");
    }
    setSavingVideo(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!form.name.trim()) {
      setFormError("El nombre es obligatorio");
      return;
    }

    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setFormError("No autenticado");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("exercises").insert({
      name: form.name.trim(),
      muscle_group: form.muscle_group,
      secondary_muscle_group: form.secondary_muscle_group || null,
      exercise_type: form.exercise_type,
      equipment: form.equipment,
      instructions: form.instructions.trim() || null,
      video_url: form.video_url.trim() || null,
      is_global: isStaff ? form.is_global : false,
      created_by: user.id,
    });

    if (error) {
      setFormError(error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setModalOpen(false);
    setForm({
      name: "",
      muscle_group: "pecho",
      secondary_muscle_group: "",
      exercise_type: "compuesto",
      equipment: "barra",
      instructions: "",
      video_url: "",
      is_global: false,
    });
    fetchExercises();
  }

  if (loading) {
    return <ExercisesSkeleton />;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ─── Header ─── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ejercicios</h1>
          <p className="mt-1 text-sm text-muted">
            {filtered.length} ejercicio{filtered.length !== 1 ? "s" : ""}{" "}
            {hasActiveFilters && "encontrados"}
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Agregar Ejercicio
        </Button>
      </div>

      {/* ─── Search & Filters ─── */}
      <Card>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            placeholder="Buscar ejercicio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filter row */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <div className="flex-1">
            <Select
              label="Grupo muscular"
              value={filterMuscle}
              onChange={(e) => setFilterMuscle(e.target.value)}
            >
              <option value="">Todos</option>
              {MUSCLE_GROUPS.map((mg) => (
                <option key={mg.value} value={mg.value}>
                  {mg.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex-1">
            <Select
              label="Equipamiento"
              value={filterEquipment}
              onChange={(e) => setFilterEquipment(e.target.value)}
            >
              <option value="">Todos</option>
              {EQUIPMENT_TYPES.map((eq) => (
                <option key={eq.value} value={eq.value}>
                  {eq.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex-1">
            <Select
              label="Tipo"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="">Todos</option>
              {EXERCISE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Active filters indicator */}
        {hasActiveFilters && (
          <div className="mt-3 flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted" />
            <span className="text-xs text-muted">Filtros activos</span>
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary cursor-pointer transition-colors"
            >
              <X className="h-3 w-3" />
              Limpiar
            </button>
          </div>
        )}
      </Card>

      {/* ─── Exercise Grid ─── */}
      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <div className="inline-flex items-center justify-center p-4 rounded-full bg-[var(--hover-bg)] mb-4">
            <Dumbbell className="h-8 w-8 text-muted" />
          </div>
          <p className="text-foreground font-medium">
            No se encontraron ejercicios
          </p>
          <p className="text-muted text-sm mt-1 max-w-sm">
            {hasActiveFilters
              ? "Intenta ajustar los filtros o buscar con otros terminos."
              : "Agrega tu primer ejercicio para empezar a construir tus rutinas."}
          </p>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="mt-3 gap-1"
            >
              <X className="h-3.5 w-3.5" />
              Limpiar filtros
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((exercise) => {
            const isExpanded = expandedId === exercise.id;
            return (
              <Card
                key={exercise.id}
                className="cursor-pointer transition-all duration-200 hover:border-primary/30 flex flex-col"
                onClick={() => {
                  const newId = isExpanded ? null : exercise.id;
                  setExpandedId(newId);
                  if (newId) loadExerciseHistory(newId);
                }}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-foreground leading-snug">
                    {exercise.name}
                  </h3>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {exercise.is_global ? (
                      <span
                        className="text-[var(--info)]"
                        title="Ejercicio global"
                      >
                        <Globe className="h-4 w-4" />
                      </span>
                    ) : (
                      <span
                        className="text-muted"
                        title="Ejercicio personal"
                      >
                        <User className="h-4 w-4" />
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted" />
                    )}
                  </div>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <Badge
                    color={
                      muscleGroupColor[exercise.muscle_group] ?? "gray"
                    }
                  >
                    {getLabelFor(exercise.muscle_group, MUSCLE_GROUPS)}
                  </Badge>
                  <Badge
                    color={
                      equipmentColor[exercise.equipment] ?? "gray"
                    }
                  >
                    {getLabelFor(exercise.equipment, EQUIPMENT_TYPES)}
                  </Badge>
                  <Badge
                    color={
                      exercise.exercise_type === "compuesto"
                        ? "green"
                        : "blue"
                    }
                  >
                    {getLabelFor(exercise.exercise_type, EXERCISE_TYPES)}
                  </Badge>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-4 space-y-3 border-t border-card-border pt-4">
                    {exercise.secondary_muscle_group && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted">
                          Secundario:
                        </span>
                        <Badge
                          color={
                            muscleGroupColor[
                              exercise.secondary_muscle_group
                            ] ?? "gray"
                          }
                        >
                          {getLabelFor(
                            exercise.secondary_muscle_group,
                            MUSCLE_GROUPS
                          )}
                        </Badge>
                      </div>
                    )}

                    {/* Video */}
                    {exercise.video_url && getYouTubeId(exercise.video_url) ? (
                      <div>
                        <p className="text-xs font-medium text-muted mb-2">
                          Video de ejemplo
                        </p>
                        <div className="relative w-full overflow-hidden rounded-lg" style={{ paddingBottom: "56.25%" }}>
                          <iframe
                            className="absolute inset-0 h-full w-full"
                            src={`https://www.youtube.com/embed/${getYouTubeId(exercise.video_url)}`}
                            title={exercise.name}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      </div>
                    ) : exercise.video_url ? (
                      <div>
                        <p className="text-xs font-medium text-muted mb-1">Video</p>
                        <a
                          href={exercise.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                        >
                          <Play className="h-3.5 w-3.5" />
                          Ver video
                        </a>
                      </div>
                    ) : null}

                    {/* Edit video - for trainers/owners or exercise creator */}
                    {(isStaff || exercise.created_by === profile?.id) && (
                      <div>
                        {editingId === exercise.id ? (
                          <div className="flex items-end gap-2">
                            <div className="flex-1">
                              <Input
                                label="URL de YouTube"
                                placeholder="https://www.youtube.com/watch?v=..."
                                value={editVideoUrl}
                                onChange={(e) => setEditVideoUrl(e.target.value)}
                              />
                            </div>
                            <Button
                              size="sm"
                              loading={savingVideo}
                              onClick={() => handleSaveVideo(exercise.id)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingId(null);
                                setEditVideoUrl("");
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingId(exercise.id);
                              setEditVideoUrl(exercise.video_url || "");
                            }}
                            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-primary transition-colors cursor-pointer"
                          >
                            <Pencil className="h-3 w-3" />
                            {exercise.video_url ? "Cambiar video" : "Agregar video"}
                          </button>
                        )}
                      </div>
                    )}

                    {exercise.instructions ? (
                      <div>
                        <p className="text-xs font-medium text-muted mb-1">
                          Instrucciones
                        </p>
                        <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">
                          {exercise.instructions}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm italic text-muted">
                        Sin instrucciones
                      </p>
                    )}

                    {/* Exercise History */}
                    <div className="border-t border-card-border pt-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <History className="h-3.5 w-3.5 text-primary" />
                        <p className="text-xs font-medium text-muted">Tu Historial</p>
                      </div>
                      {(() => {
                        const history = exerciseHistory.get(exercise.id);
                        if (!history || history.loading) {
                          return (
                            <div className="flex items-center gap-2 py-3">
                              <Loader2 className="h-4 w-4 animate-spin text-muted" />
                              <span className="text-xs text-muted">Cargando historial...</span>
                            </div>
                          );
                        }
                        if (history.entries.length === 0) {
                          return (
                            <p className="text-xs text-muted italic py-2">
                              Aun no has registrado este ejercicio
                            </p>
                          );
                        }
                        return (
                          <div className="space-y-2">
                            {/* PR section */}
                            <div className="flex items-center gap-3 rounded-lg bg-[var(--warning)]/10 px-3 py-2">
                              <Trophy className="h-4 w-4 text-[color:var(--warning)]" />
                              <div className="flex gap-4 text-xs">
                                <span className="text-foreground">
                                  <span className="font-semibold">{history.prWeight} kg</span>{" "}
                                  <span className="text-muted">max peso</span>
                                </span>
                                {history.pr1RM > 0 && (
                                  <span className="text-foreground">
                                    <span className="font-semibold">{history.pr1RM} kg</span>{" "}
                                    <span className="text-muted">1RM est.</span>
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* Last sessions */}
                            <div className="space-y-1">
                              {history.entries.map((entry) => (
                                <div
                                  key={entry.date}
                                  className="flex items-center justify-between rounded-lg px-3 py-1.5 text-xs hover:bg-[var(--hover-bg)]"
                                >
                                  <span className="flex items-center gap-1.5 text-muted">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(entry.date + "T12:00:00").toLocaleDateString("es-ES", {
                                      day: "numeric",
                                      month: "short",
                                    })}
                                  </span>
                                  <span className="text-foreground font-medium">
                                    {entry.sets}x{entry.reps} &middot; {entry.maxWeight} kg
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="flex items-center gap-1.5 pt-1">
                      {exercise.is_global ? (
                        <Badge color="blue">
                          <Globe className="h-3 w-3 mr-1" />
                          Global
                        </Badge>
                      ) : (
                        <Badge color="gray">
                          <User className="h-3 w-3 mr-1" />
                          Personal
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ─── Create Modal ─── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Agregar Ejercicio"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Nombre"
            placeholder="Ej: Press de banca"
            value={form.name}
            onChange={(e) =>
              setForm((f) => ({ ...f, name: e.target.value }))
            }
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Grupo muscular"
              value={form.muscle_group}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  muscle_group: e.target.value as MuscleGroup,
                }))
              }
            >
              {MUSCLE_GROUPS.map((mg) => (
                <option key={mg.value} value={mg.value}>
                  {mg.label}
                </option>
              ))}
            </Select>

            <Select
              label="Musculo secundario"
              value={form.secondary_muscle_group}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  secondary_muscle_group: e.target.value as
                    | MuscleGroup
                    | "",
                }))
              }
            >
              <option value="">Ninguno</option>
              {MUSCLE_GROUPS.map((mg) => (
                <option key={mg.value} value={mg.value}>
                  {mg.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Tipo"
              value={form.exercise_type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  exercise_type: e.target.value as ExerciseType,
                }))
              }
            >
              {EXERCISE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>

            <Select
              label="Equipamiento"
              value={form.equipment}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  equipment: e.target.value as Equipment,
                }))
              }
            >
              {EQUIPMENT_TYPES.map((eq) => (
                <option key={eq.value} value={eq.value}>
                  {eq.label}
                </option>
              ))}
            </Select>
          </div>

          <Textarea
            label="Instrucciones"
            placeholder="Descripcion del ejercicio, tecnica, consejos..."
            value={form.instructions}
            onChange={(e) =>
              setForm((f) => ({ ...f, instructions: e.target.value }))
            }
          />

          <Input
            label="Video de YouTube (opcional)"
            placeholder="https://www.youtube.com/watch?v=..."
            value={form.video_url}
            onChange={(e) =>
              setForm((f) => ({ ...f, video_url: e.target.value }))
            }
            helperText="Pega un link de YouTube para mostrar como ejemplo del ejercicio"
          />

          {isStaff && (
            <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-[var(--hover-bg)] transition-colors">
              <input
                type="checkbox"
                checked={form.is_global}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    is_global: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-card-border bg-card-bg text-primary accent-primary"
              />
              <div>
                <span className="text-sm text-foreground">
                  Ejercicio global
                </span>
                <p className="text-xs text-muted">
                  Visible para todos los usuarios
                </p>
              </div>
            </label>
          )}

          {formError && (
            <p className="text-sm text-danger">{formError}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              Crear Ejercicio
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
