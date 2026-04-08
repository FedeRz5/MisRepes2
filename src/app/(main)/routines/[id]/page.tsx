'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DAY_NAMES, MUSCLE_GROUPS, EQUIPMENT_TYPES, EXERCISE_TYPES } from '@/lib/constants';
import type {
  Profile,
  Routine,
  RoutineExercise,
  RoutineAssignment,
  Exercise,
  MuscleGroup,
  Equipment,
  ExerciseType,
} from '@/types/database';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Textarea, Select } from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  UserPlus,
  Play,
  Loader2,
  Dumbbell,
  Clock,
  X,
  Save,
  Weight,
  Plus,
  Search,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

interface EditableExercise {
  routineExerciseId: string | null; // null = nuevo, no guardado aún
  exercise: Exercise;
  target_sets: number;
  target_reps: number;
  target_weight_kg: number | null;
  rest_seconds: number;
  notes: string;
}

export default function RoutineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: routineId } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [routineExercises, setRoutineExercises] = useState<RoutineExercise[]>([]);
  const [assignments, setAssignments] = useState<RoutineAssignment[]>([]);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDay, setEditDay] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Remove assignment confirm
  const [removeAssignmentId, setRemoveAssignmentId] = useState<string | null>(null);

  // Assign
  const [selectedUserId, setSelectedUserId] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Start session
  const [startingSession, setStartingSession] = useState(false);

  // Tab (solo para owner/trainer)
  const [activeTab, setActiveTab] = useState<'entrenar' | 'usuarios'>('entrenar');

  // Edit exercises
  const [editExercises, setEditExercises] = useState<EditableExercise[]>([]);
  const [showExSearch, setShowExSearch] = useState(false);
  const [exSearchQuery, setExSearchQuery] = useState('');
  const [exSearchResults, setExSearchResults] = useState<Exercise[]>([]);
  const [exSearchLoading, setExSearchLoading] = useState(false);

  // Quick create exercise modal (dentro de edición de rutina)
  const [showCreateExercise, setShowCreateExercise] = useState(false);
  const [savingExercise, setSavingExercise] = useState(false);
  const [createExError, setCreateExError] = useState('');
  const [newEx, setNewEx] = useState({
    name: '',
    muscle_group: 'pecho' as MuscleGroup,
    exercise_type: 'compuesto' as ExerciseType,
    equipment: 'barra' as Equipment,
  });

  const isOwnerOrStaff =
    profile?.role === 'owner' || profile?.role === 'trainer';
  const isCreator = profile && routine && profile.id === routine.created_by;
  const canManage = isOwnerOrStaff || isCreator;

  const muscleLabel = (value: string) =>
    MUSCLE_GROUPS.find((m) => m.value === value)?.label ?? value;

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (!prof) return;
      const typedProfile = prof as Profile;
      setProfile(typedProfile);

      // Load routine
      const { data: routineData, error: routineErr } = await supabase
        .from('routines')
        .select('*')
        .eq('id', routineId)
        .single();
      if (routineErr) throw routineErr;
      const typedRoutine = routineData as Routine;
      setRoutine(typedRoutine);
      setEditName(typedRoutine.name);
      setEditDescription(typedRoutine.description ?? '');
      setEditDay(
        typedRoutine.day_of_week !== null ? String(typedRoutine.day_of_week) : ''
      );

      // Load exercises
      const { data: exData, error: exErr } = await supabase
        .from('routine_exercises')
        .select('*, exercise:exercises(*)')
        .eq('routine_id', routineId)
        .order('order_index', { ascending: true });
      if (exErr) throw exErr;
      setRoutineExercises((exData ?? []) as RoutineExercise[]);

      // Staff or creator data
      const canSeeAssignments =
        typedProfile.role === 'owner' ||
        typedProfile.role === 'trainer' ||
        typedProfile.id === typedRoutine.created_by;

      if (canSeeAssignments) {
        const { data: assignData } = await supabase
          .from('routine_assignments')
          .select('*, profile:profiles!user_id(*)')
          .eq('routine_id', routineId)
          .eq('active', true);
        setAssignments((assignData ?? []) as RoutineAssignment[]);

        if (
          typedProfile.role === 'owner' ||
          typedProfile.role === 'trainer'
        ) {
          const { data: usersData } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'user')
            .order('full_name');
          setAllUsers((usersData ?? []) as Profile[]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar la rutina');
    } finally {
      setLoading(false);
    }
  }, [routineId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Debounced exercise search when editing
  useEffect(() => {
    if (!exSearchQuery.trim()) {
      setExSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setExSearchLoading(true);
      try {
        const addedIds = new Set(editExercises.map((e) => e.exercise.id));
        const { data } = await supabase
          .from('exercises')
          .select('*')
          .ilike('name', `%${exSearchQuery}%`)
          .limit(10);
        setExSearchResults(
          ((data ?? []) as Exercise[]).filter((e) => !addedIds.has(e.id))
        );
      } finally {
        setExSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [exSearchQuery, editExercises]);

  async function handleCreateExercise(e: React.FormEvent) {
    e.preventDefault();
    if (!newEx.name.trim()) {
      setCreateExError('El nombre es obligatorio');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setSavingExercise(true);
    setCreateExError('');

    const { data, error: err } = await supabase
      .from('exercises')
      .insert({
        name: newEx.name.trim(),
        muscle_group: newEx.muscle_group,
        exercise_type: newEx.exercise_type,
        equipment: newEx.equipment,
        is_global: false,
        created_by: user.id,
      })
      .select()
      .single();

    if (err || !data) {
      setCreateExError(err?.message || 'Error al crear el ejercicio');
      setSavingExercise(false);
      return;
    }

    // Agregar el ejercicio nuevo directamente a la lista de edición
    setEditExercises((prev) => [
      ...prev,
      {
        routineExerciseId: null,
        exercise: data as Exercise,
        target_sets: 3,
        target_reps: 10,
        target_weight_kg: null,
        rest_seconds: 60,
        notes: '',
      },
    ]);

    setShowCreateExercise(false);
    setNewEx({ name: '', muscle_group: 'pecho', exercise_type: 'compuesto', equipment: 'barra' });
    setExSearchQuery('');
    setSavingExercise(false);
  }

  async function handleSaveEdit() {
    if (!editName.trim()) return;
    setSavingEdit(true);
    setError(null);

    try {
      // 1. Save routine metadata
      const { error: err } = await supabase
        .from('routines')
        .update({
          name: editName.trim(),
          description: editDescription.trim() || null,
          day_of_week: editDay !== '' ? parseInt(editDay) : null,
        })
        .eq('id', routineId);
      if (err) throw err;

      // 2. Delete exercises that were removed
      const keptIds = new Set(
        editExercises.filter((e) => e.routineExerciseId).map((e) => e.routineExerciseId!)
      );
      const toDelete = routineExercises
        .filter((re) => !keptIds.has(re.id))
        .map((re) => re.id);
      if (toDelete.length > 0) {
        await supabase.from('routine_exercises').delete().in('id', toDelete);
      }

      // 3. Update existing exercises (order + config)
      for (let i = 0; i < editExercises.length; i++) {
        const ex = editExercises[i];
        if (ex.routineExerciseId) {
          await supabase
            .from('routine_exercises')
            .update({
              order_index: i,
              target_sets: ex.target_sets,
              target_reps: ex.target_reps,
              target_weight_kg: ex.target_weight_kg,
              rest_seconds: ex.rest_seconds,
              notes: ex.notes.trim() || null,
            })
            .eq('id', ex.routineExerciseId);
        }
      }

      // 4. Insert new exercises
      const insertRows = editExercises
        .filter((ex) => !ex.routineExerciseId)
        .map((ex) => ({
          routine_id: routineId,
          exercise_id: ex.exercise.id,
          order_index: editExercises.indexOf(ex),
          target_sets: ex.target_sets,
          target_reps: ex.target_reps,
          target_weight_kg: ex.target_weight_kg,
          rest_seconds: ex.rest_seconds,
          notes: ex.notes.trim() || null,
        }));
      if (insertRows.length > 0) {
        await supabase.from('routine_exercises').insert(insertRows);
      }

      // 5. Reload and close edit mode
      await loadData();
      setEditing(false);
      setShowExSearch(false);
      setExSearchQuery('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await supabase
        .from('routine_exercises')
        .delete()
        .eq('routine_id', routineId);

      await supabase
        .from('routine_assignments')
        .delete()
        .eq('routine_id', routineId);

      const { error: err } = await supabase
        .from('routines')
        .delete()
        .eq('id', routineId);

      if (err) throw err;
      router.push('/routines');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
      setDeleting(false);
      setShowDeleteModal(false);
    }
  }

  async function handleAssign() {
    if (!selectedUserId || !profile) return;
    setAssigning(true);
    setError(null);

    try {
      const { error: err } = await supabase
        .from('routine_assignments')
        .insert({
          routine_id: routineId,
          user_id: selectedUserId,
          assigned_by: profile.id,
          active: true,
        });

      if (err) throw err;
      setSelectedUserId('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al asignar');
    } finally {
      setAssigning(false);
    }
  }

  async function handleRemoveAssignment(assignmentId: string) {
    try {
      await supabase
        .from('routine_assignments')
        .update({ active: false })
        .eq('id', assignmentId);
      setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
    } catch {
      // silent
    }
  }

  async function handleStartSession() {
    if (!profile) return;
    setStartingSession(true);
    setError(null);

    try {
      const { data: session, error: err } = await supabase
        .from('workout_sessions')
        .insert({
          user_id: profile.id,
          routine_id: routineId,
          date: new Date().toISOString().split('T')[0],
          completed: false,
        })
        .select()
        .single();

      if (err) throw err;
      router.push(`/sessions/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesion');
      setStartingSession(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-lg bg-card-bg" />
          <div className="flex-1">
            <div className="h-7 w-48 animate-pulse rounded bg-card-bg" />
            <div className="mt-2 h-4 w-72 animate-pulse rounded bg-card-bg" />
          </div>
        </div>
        {/* Exercises skeleton */}
        <div className="rounded-xl border border-card-border bg-card-bg p-5">
          <div className="mb-4 h-6 w-32 animate-pulse rounded bg-background" />
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="mb-3 rounded-lg border border-card-border bg-background p-4"
            >
              <div className="h-5 w-40 animate-pulse rounded bg-card-bg" />
              <div className="mt-2 h-4 w-32 animate-pulse rounded bg-card-bg" />
            </div>
          ))}
        </div>
        {/* Action skeleton */}
        <div className="rounded-xl border border-card-border bg-card-bg p-5">
          <div className="flex items-center justify-between">
            <div className="h-5 w-24 animate-pulse rounded bg-background" />
            <div className="h-10 w-36 animate-pulse rounded-lg bg-background" />
          </div>
        </div>
      </div>
    );
  }

  if (error && !routine) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push('/routines')}
          className="flex items-center gap-1 text-sm text-muted hover:text-foreground cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      </div>
    );
  }

  if (!routine) return null;

  const assignedUserIds = new Set(assignments.map((a) => a.user_id));
  const availableUsers = allUsers.filter((u) => !assignedUserIds.has(u.id));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => router.push('/routines')}
          className="mt-1 rounded-lg p-2 text-muted transition-colors hover:bg-card-bg hover:text-foreground cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          {!editing ? (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-foreground">
                  {routine.name}
                </h1>
                {routine.day_of_week !== null && (
                  <Badge color="blue">{DAY_NAMES[routine.day_of_week]}</Badge>
                )}
              </div>
              {routine.description && (
                <p className="mt-1 text-sm text-muted">
                  {routine.description}
                </p>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <Input
                label="Nombre"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
              <Textarea
                label="Descripcion"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
              <Select
                label="Dia"
                value={editDay}
                onChange={(e) => setEditDay(e.target.value)}
              >
                <option value="">Sin dia</option>
                {DAY_NAMES.map((d, i) => (
                  <option key={i} value={i}>
                    {d}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canManage && !editing && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEditExercises(
                    routineExercises.map((re) => ({
                      routineExerciseId: re.id,
                      exercise: re.exercise!,
                      target_sets: re.target_sets,
                      target_reps: re.target_reps,
                      target_weight_kg: re.target_weight_kg,
                      rest_seconds: re.rest_seconds,
                      notes: re.notes ?? '',
                    }))
                  );
                  setEditing(true);
                }}
              >
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowDeleteModal(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          {editing && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setEditName(routine.name);
                  setEditDescription(routine.description ?? '');
                  setEditDay(
                    routine.day_of_week !== null
                      ? String(routine.day_of_week)
                      : ''
                  );
                  setEditExercises([]);
                  setShowExSearch(false);
                  setExSearchQuery('');
                }}
              >
                Cancelar
              </Button>
              <Button size="sm" loading={savingEdit} onClick={handleSaveEdit}>
                <Save className="h-4 w-4" />
                Guardar
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Exercises */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Ejercicios
            <span className="ml-2 text-sm font-normal text-muted">
              ({editing ? editExercises.length : routineExercises.length})
            </span>
          </h2>
          {editing && canManage && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowExSearch(!showExSearch)}
            >
              {showExSearch ? (
                <>
                  <X className="h-4 w-4" />
                  Cerrar
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Agregar
                </>
              )}
            </Button>
          )}
        </div>

        {/* Exercise search panel (only in edit mode) */}
        {editing && showExSearch && (
          <div className="mb-4 rounded-lg border border-card-border bg-background p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={exSearchQuery}
                onChange={(e) => setExSearchQuery(e.target.value)}
                placeholder="Buscar ejercicios..."
                className="w-full rounded-lg border border-card-border bg-card-bg py-2 pl-10 pr-3 text-sm text-foreground placeholder:text-muted outline-none focus:border-primary"
                autoFocus
              />
            </div>
            {exSearchLoading && (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                <Loader2 className="h-3 w-3 animate-spin" />
                Buscando...
              </div>
            )}
            {exSearchResults.length > 0 && (
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {exSearchResults.map((ex) => (
                  <li key={ex.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditExercises((prev) => [
                          ...prev,
                          {
                            routineExerciseId: null,
                            exercise: ex,
                            target_sets: 3,
                            target_reps: 10,
                            target_weight_kg: null,
                            rest_seconds: 60,
                            notes: '',
                          },
                        ]);
                        setExSearchQuery('');
                        setExSearchResults([]);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-card-bg cursor-pointer"
                    >
                      <span>{ex.name}</span>
                      <Badge color="gray">{muscleLabel(ex.muscle_group)}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {exSearchQuery.trim() && !exSearchLoading && exSearchResults.length === 0 && (
              <p className="mt-2 text-xs text-muted">
                No se encontraron ejercicios
              </p>
            )}
            {/* Botón crear ejercicio nuevo */}
            <button
              type="button"
              onClick={() => {
                setNewEx((prev) => ({ ...prev, name: exSearchQuery.trim() }));
                setShowCreateExercise(true);
              }}
              className="mt-2 flex w-full items-center gap-2 rounded-lg border border-dashed border-primary/40 px-3 py-2.5 text-sm text-primary transition-colors hover:bg-primary/5 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              {exSearchQuery.trim()
                ? `Crear "${exSearchQuery.trim()}" como ejercicio nuevo`
                : 'Crear ejercicio nuevo'}
            </button>
          </div>
        )}

        {/* Exercise list — read-only or editable */}
        {(editing ? editExercises.length === 0 : routineExercises.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Dumbbell className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm text-muted">
              {editing
                ? 'Usá "Agregar" para sumar ejercicios a la rutina'
                : 'Esta rutina no tiene ejercicios todavia'}
            </p>
          </div>
        ) : editing ? (
          /* ── EDIT MODE: editable exercise list ── */
          <div className="space-y-3">
            {editExercises.map((ex, index) => (
              <div
                key={`${ex.exercise.id}-${index}`}
                className="rounded-lg border border-card-border bg-background p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-white text-xs font-medium">
                      {index + 1}
                    </span>
                    <span className="font-medium text-foreground truncate">
                      {ex.exercise.name}
                    </span>
                    <Badge color="gray">{muscleLabel(ex.exercise.muscle_group)}</Badge>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 ml-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (index === 0) return;
                        setEditExercises((prev) => {
                          const next = [...prev];
                          [next[index - 1], next[index]] = [next[index], next[index - 1]];
                          return next;
                        });
                      }}
                      disabled={index === 0}
                      className="rounded p-1 text-muted transition-colors hover:bg-card-bg hover:text-foreground disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (index === editExercises.length - 1) return;
                        setEditExercises((prev) => {
                          const next = [...prev];
                          [next[index], next[index + 1]] = [next[index + 1], next[index]];
                          return next;
                        });
                      }}
                      disabled={index === editExercises.length - 1}
                      className="rounded p-1 text-muted transition-colors hover:bg-card-bg hover:text-foreground disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditExercises((prev) => prev.filter((_, i) => i !== index))
                      }
                      className="rounded p-1 text-muted transition-colors hover:bg-danger/20 hover:text-danger cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Input
                    label="Series"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={ex.target_sets === 0 ? '' : ex.target_sets}
                    onChange={(e) =>
                      setEditExercises((prev) =>
                        prev.map((item, i) =>
                          i === index
                            ? { ...item, target_sets: parseInt(e.target.value) || 1 }
                            : item
                        )
                      )
                    }
                  />
                  <Input
                    label="Reps"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={ex.target_reps === 0 ? '' : ex.target_reps}
                    onChange={(e) =>
                      setEditExercises((prev) =>
                        prev.map((item, i) =>
                          i === index
                            ? { ...item, target_reps: parseInt(e.target.value) || 1 }
                            : item
                        )
                      )
                    }
                  />
                  <Input
                    label="Peso (kg)"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.5}
                    value={ex.target_weight_kg ?? ''}
                    onChange={(e) =>
                      setEditExercises((prev) =>
                        prev.map((item, i) =>
                          i === index
                            ? {
                                ...item,
                                target_weight_kg: e.target.value
                                  ? parseFloat(e.target.value)
                                  : null,
                              }
                            : item
                        )
                      )
                    }
                    placeholder="--"
                  />
                  <Input
                    label="Descanso (s)"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={5}
                    value={ex.rest_seconds === 0 ? '' : ex.rest_seconds}
                    onChange={(e) =>
                      setEditExercises((prev) =>
                        prev.map((item, i) =>
                          i === index
                            ? { ...item, rest_seconds: parseInt(e.target.value) || 0 }
                            : item
                        )
                      )
                    }
                  />
                </div>

                <div className="mt-3">
                  <Input
                    label="Notas (opcional)"
                    value={ex.notes}
                    onChange={(e) =>
                      setEditExercises((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, notes: e.target.value } : item
                        )
                      )
                    }
                    placeholder="Notas opcionales..."
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ── VIEW MODE: read-only exercise list ── */
          <div className="space-y-3">
            {routineExercises.map((re, index) => (
              <div
                key={re.id}
                className="rounded-lg border border-card-border bg-background p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-white text-sm font-semibold">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">
                        {re.exercise?.name ?? 'Ejercicio'}
                      </span>
                      {re.exercise && (
                        <Badge color="gray">
                          {muscleLabel(re.exercise.muscle_group)}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Dumbbell className="h-3.5 w-3.5" />
                        {re.target_sets} x {re.target_reps}
                      </span>
                      {re.target_weight_kg !== null && (
                        <span className="flex items-center gap-1.5">
                          <Weight className="h-3.5 w-3.5" />
                          {re.target_weight_kg} kg
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {re.rest_seconds}s descanso
                      </span>
                    </div>
                    {re.notes && (
                      <p className="mt-1.5 text-xs text-muted italic">
                        {re.notes}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Tabs — solo para owner/trainer, usuario normal ve directo el botón */}
      {!editing && canManage && isOwnerOrStaff ? (
        <Card padding="none">
          {/* Tab nav */}
          <div className="flex border-b border-card-border">
            <button
              onClick={() => setActiveTab('entrenar')}
              className={`flex flex-1 items-center justify-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'entrenar'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              <Play className="h-4 w-4" />
              Para mí
            </button>
            <button
              onClick={() => setActiveTab('usuarios')}
              className={`flex flex-1 items-center justify-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'usuarios'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              <UserPlus className="h-4 w-4" />
              Usuarios
              {assignments.length > 0 && (
                <span className={`flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-xs font-bold ${
                  activeTab === 'usuarios' ? 'bg-primary text-white' : 'bg-card-border text-muted'
                }`}>
                  {assignments.length}
                </span>
              )}
            </button>
          </div>

          {/* Tab: Entrenar */}
          {activeTab === 'entrenar' && (
            <div className="flex items-center justify-between gap-4 p-5">
              <div>
                <h3 className="font-semibold text-foreground">Iniciar entrenamiento</h3>
                <p className="mt-0.5 text-sm text-muted">
                  Empezá una sesión con esta rutina
                </p>
              </div>
              <Button loading={startingSession} onClick={handleStartSession}>
                <Play className="h-4 w-4" />
                Iniciar
              </Button>
            </div>
          )}

          {/* Tab: Usuarios */}
          {activeTab === 'usuarios' && (
            <div className="p-5 space-y-4">
              {/* Assign form */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <Select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                  >
                    <option value="">Seleccionar usuario...</option>
                    {availableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.email})
                      </option>
                    ))}
                  </Select>
                </div>
                <Button
                  onClick={handleAssign}
                  loading={assigning}
                  disabled={!selectedUserId}
                >
                  Asignar
                </Button>
              </div>

              {/* Current assignments */}
              {assignments.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                    Asignaciones activas
                  </p>
                  {assignments.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-xl border border-card-border bg-background px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {a.profile?.full_name ?? 'Usuario'}
                        </p>
                        <p className="text-xs text-muted">{a.profile?.email}</p>
                      </div>
                      <button
                        onClick={() => setRemoveAssignmentId(a.id)}
                        className="rounded-lg p-1.5 text-muted transition-colors hover:bg-danger/15 hover:text-danger cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">
                  Ningún usuario tiene esta rutina asignada.
                </p>
              )}
            </div>
          )}
        </Card>
      ) : !editing ? (
        /* Usuario normal: solo ve el botón de entrenar */
        <Card>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-foreground">Entrenar</h3>
              <p className="mt-0.5 text-sm text-muted">
                Iniciá una sesión con esta rutina
              </p>
            </div>
            <Button loading={startingSession} onClick={handleStartSession}>
              <Play className="h-4 w-4" />
              Iniciar
            </Button>
          </div>
        </Card>
      ) : null}

      {/* Quick Create Exercise Modal */}
      <Modal
        open={showCreateExercise}
        onClose={() => { setShowCreateExercise(false); setCreateExError(''); }}
        title="Crear Ejercicio"
        size="sm"
      >
        <form onSubmit={handleCreateExercise} className="space-y-4">
          <Input
            label="Nombre"
            placeholder="Ej: Curl concentrado"
            value={newEx.name}
            onChange={(e) => setNewEx((prev) => ({ ...prev, name: e.target.value }))}
            autoFocus
            required
          />
          <Select
            label="Grupo muscular"
            value={newEx.muscle_group}
            onChange={(e) => setNewEx((prev) => ({ ...prev, muscle_group: e.target.value as MuscleGroup }))}
          >
            {MUSCLE_GROUPS.map((mg) => (
              <option key={mg.value} value={mg.value}>{mg.label}</option>
            ))}
          </Select>
          <Select
            label="Equipamiento"
            value={newEx.equipment}
            onChange={(e) => setNewEx((prev) => ({ ...prev, equipment: e.target.value as Equipment }))}
          >
            {EQUIPMENT_TYPES.map((eq) => (
              <option key={eq.value} value={eq.value}>{eq.label}</option>
            ))}
          </Select>
          <Select
            label="Tipo"
            value={newEx.exercise_type}
            onChange={(e) => setNewEx((prev) => ({ ...prev, exercise_type: e.target.value as ExerciseType }))}
          >
            {EXERCISE_TYPES.map((et) => (
              <option key={et.value} value={et.value}>{et.label}</option>
            ))}
          </Select>
          {createExError && <p className="text-sm text-danger">{createExError}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => { setShowCreateExercise(false); setCreateExError(''); }}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={savingExercise}>
              Crear y Agregar
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete routine confirm */}
      <ConfirmDialog
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Eliminar rutina"
        message={`¿Estás seguro de que quieres eliminar la rutina "${routine.name}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
      />

      {/* Remove assignment confirm */}
      <ConfirmDialog
        open={!!removeAssignmentId}
        onClose={() => setRemoveAssignmentId(null)}
        onConfirm={() => {
          if (removeAssignmentId) {
            handleRemoveAssignment(removeAssignmentId);
            setRemoveAssignmentId(null);
          }
        }}
        title="Quitar asignación"
        message="¿Estás seguro de que quieres quitar esta asignación? El usuario ya no tendrá acceso a esta rutina."
        confirmText="Quitar"
        variant="danger"
      />
    </div>
  );
}
