'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DAY_NAMES, MUSCLE_GROUPS } from '@/lib/constants';
import type {
  Profile,
  Routine,
  RoutineExercise,
  RoutineAssignment,
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
} from 'lucide-react';

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

  async function handleSaveEdit() {
    if (!editName.trim()) return;
    setSavingEdit(true);
    setError(null);

    try {
      const { error: err } = await supabase
        .from('routines')
        .update({
          name: editName.trim(),
          description: editDescription.trim() || null,
          day_of_week: editDay !== '' ? parseInt(editDay) : null,
        })
        .eq('id', routineId);

      if (err) throw err;

      setRoutine((prev) =>
        prev
          ? {
              ...prev,
              name: editName.trim(),
              description: editDescription.trim() || null,
              day_of_week: editDay !== '' ? parseInt(editDay) : null,
            }
          : null
      );
      setEditing(false);
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
                onClick={() => setEditing(true)}
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
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Ejercicios
          <span className="ml-2 text-sm font-normal text-muted">
            ({routineExercises.length})
          </span>
        </h2>

        {routineExercises.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div
              className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"
            >
              <Dumbbell className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm text-muted">
              Esta rutina no tiene ejercicios todavia
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {routineExercises.map((re, index) => (
              <div
                key={re.id}
                className="rounded-lg border border-card-border bg-background p-4"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-white text-sm font-semibold"
                  >
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

      {/* Start session */}
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-foreground">Entrenar</h3>
            <p className="text-sm text-muted">
              Inicia una sesion con esta rutina
            </p>
          </div>
          <Button loading={startingSession} onClick={handleStartSession}>
            <Play className="h-4 w-4" />
            Iniciar Sesion
          </Button>
        </div>
      </Card>

      {/* Assignments (staff or creator) */}
      {canManage && isOwnerOrStaff && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            <UserPlus className="mb-0.5 mr-2 inline h-5 w-5" />
            Asignar a Usuario
          </h2>

          {/* Assign form */}
          <div className="mb-4 flex gap-3">
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
              <h3 className="text-sm font-medium text-muted">
                Asignaciones activas
              </h3>
              {assignments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border border-card-border bg-background px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {a.profile?.full_name ?? 'Usuario'}
                    </p>
                    <p className="text-xs text-muted">
                      {a.profile?.email}
                    </p>
                  </div>
                  <button
                    onClick={() => setRemoveAssignmentId(a.id)}
                    className="rounded p-1.5 text-muted transition-colors hover:bg-danger/20 hover:text-danger cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">
              Esta rutina no esta asignada a ningun usuario
            </p>
          )}
        </Card>
      )}

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
