'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { DAY_NAMES, MUSCLE_GROUPS, EQUIPMENT_TYPES, EXERCISE_TYPES } from '@/lib/constants';
import type { MuscleGroup, Equipment, ExerciseType } from '@/types/database';
import Modal from '@/components/ui/Modal';
import type { Exercise } from '@/types/database';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Textarea, Select } from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import {
  ArrowLeft,
  Plus,
  Search,
  X,
  ChevronUp,
  ChevronDown,
  Loader2,
  Dumbbell,
  GripVertical,
} from 'lucide-react';

interface ExerciseConfig {
  exercise: Exercise;
  target_sets: number;
  target_reps: number;
  target_weight_kg: number | null;
  rest_seconds: number;
  notes: string;
}

export default function NewRoutinePage() {
  const router = useRouter();
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<string>('');
  const [exercises, setExercises] = useState<ExerciseConfig[]>([]);
  const [nameError, setNameError] = useState<string | null>(null);

  // Exercise search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Exercise[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Quick create exercise modal
  const [showCreateExercise, setShowCreateExercise] = useState(false);
  const [savingExercise, setSavingExercise] = useState(false);
  const [createExError, setCreateExError] = useState('');
  const [newEx, setNewEx] = useState({
    name: '',
    muscle_group: 'pecho' as MuscleGroup,
    exercise_type: 'compuesto' as ExerciseType,
    equipment: 'barra' as Equipment,
  });

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUserId(user.id);
      setAuthLoading(false);
    }
    checkAuth();
  }, []);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const { data, error: err } = await supabase
          .from('exercises')
          .select('*')
          .ilike('name', `%${searchQuery}%`)
          .limit(10);
        if (err) throw err;
        const addedIds = new Set(exercises.map((e) => e.exercise.id));
        setSearchResults(
          ((data ?? []) as Exercise[]).filter((e) => !addedIds.has(e.id))
        );
      } catch {
        // silently fail search
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery, exercises]);

  function addExercise(exercise: Exercise) {
    setExercises((prev) => [
      ...prev,
      {
        exercise,
        target_sets: 3,
        target_reps: 10,
        target_weight_kg: null,
        rest_seconds: 60,
        notes: '',
      },
    ]);
    setSearchQuery('');
    setSearchResults([]);
  }

  function removeExercise(index: number) {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  }

  function updateExercise(index: number, field: keyof ExerciseConfig, value: unknown) {
    setExercises((prev) =>
      prev.map((e, i) => (i === index ? { ...e, [field]: value } : e))
    );
  }

  function moveExercise(index: number, direction: 'up' | 'down') {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= exercises.length) return;
    const updated = [...exercises];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setExercises(updated);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    setNameError(null);
    if (!name.trim()) {
      setNameError('El nombre es obligatorio');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { data: routine, error: routineErr } = await supabase
        .from('routines')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          day_of_week: dayOfWeek !== '' ? parseInt(dayOfWeek) : null,
          created_by: userId,
        })
        .select()
        .single();

      if (routineErr) throw routineErr;

      if (exercises.length > 0) {
        const routineExercises = exercises.map((ex, index) => ({
          routine_id: routine.id,
          exercise_id: ex.exercise.id,
          order_index: index,
          target_sets: ex.target_sets,
          target_reps: ex.target_reps,
          target_weight_kg: ex.target_weight_kg,
          rest_seconds: ex.rest_seconds,
          notes: ex.notes.trim() || null,
        }));

        const { error: exErr } = await supabase
          .from('routine_exercises')
          .insert(routineExercises);

        if (exErr) throw exErr;
      }

      router.push('/routines');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la rutina');
    } finally {
      setSaving(false);
    }
  }

  const muscleLabel = (value: string) =>
    MUSCLE_GROUPS.find((m) => m.value === value)?.label ?? value;

  async function handleCreateExercise(e: React.FormEvent) {
    e.preventDefault();
    if (!newEx.name.trim()) {
      setCreateExError('El nombre es obligatorio');
      return;
    }
    if (!userId) return;

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
        created_by: userId,
      })
      .select()
      .single();

    if (err || !data) {
      setCreateExError(err?.message || 'Error al crear el ejercicio');
      setSavingExercise(false);
      return;
    }

    // Auto-add the new exercise to the routine
    addExercise(data as Exercise);
    setShowCreateExercise(false);
    setNewEx({ name: '', muscle_group: 'pecho', exercise_type: 'compuesto', equipment: 'barra' });
    setSavingExercise(false);
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/routines')}
          className="rounded-lg p-2 text-muted transition-colors hover:bg-card-bg hover:text-foreground cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Crear Rutina</h1>
          <p className="mt-0.5 text-sm text-muted">
            Define los ejercicios y configuracion de la rutina
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic info */}
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            Informacion General
          </h2>
          <div className="space-y-4">
            <Input
              label="Nombre"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              placeholder="Ej: Pecho y Triceps"
              error={nameError ?? undefined}
              required
            />
            <Textarea
              label="Descripcion (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripcion opcional de la rutina..."
            />
            <Select
              label="Dia de la semana"
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(e.target.value)}
            >
              <option value="">Sin dia asignado</option>
              {DAY_NAMES.map((day, i) => (
                <option key={i} value={i}>
                  {day}
                </option>
              ))}
            </Select>
          </div>
        </Card>

        {/* Exercises */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Ejercicios
              {exercises.length > 0 && (
                <span className="ml-2 text-sm font-normal text-muted">
                  ({exercises.length})
                </span>
              )}
            </h2>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowSearch(!showSearch)}
            >
              {showSearch ? (
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
          </div>

          {/* Search */}
          {showSearch && (
            <div className="mb-4 rounded-lg border border-card-border bg-background p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar ejercicios..."
                  className="w-full rounded-lg border border-card-border bg-card-bg py-2 pl-10 pr-3 text-sm text-foreground placeholder:text-muted outline-none focus:border-primary"
                  autoFocus
                />
              </div>
              {searchLoading && (
                <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Buscando...
                </div>
              )}
              {searchResults.length > 0 && (
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                  {searchResults.map((ex) => (
                    <li key={ex.id}>
                      <button
                        type="button"
                        onClick={() => addExercise(ex)}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-card-bg cursor-pointer"
                      >
                        <span>{ex.name}</span>
                        <Badge color="gray">{muscleLabel(ex.muscle_group)}</Badge>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {searchQuery.trim() && !searchLoading && searchResults.length === 0 && (
                <p className="mt-2 text-xs text-muted">
                  No se encontraron ejercicios
                </p>
              )}

              {/* Quick create button */}
              <button
                type="button"
                onClick={() => {
                  setNewEx((prev) => ({
                    ...prev,
                    name: searchQuery.trim(),
                  }));
                  setShowCreateExercise(true);
                }}
                className="mt-2 flex w-full items-center gap-2 rounded-lg border border-dashed border-primary/40 px-3 py-2.5 text-sm text-primary transition-colors hover:bg-primary/5 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                {searchQuery.trim()
                  ? `Crear "${searchQuery.trim()}" como ejercicio nuevo`
                  : 'Crear ejercicio nuevo'}
              </button>
            </div>
          )}

          {/* Exercise list */}
          {exercises.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div
                className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"
              >
                <Dumbbell className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm text-muted">
                Agrega ejercicios a esta rutina
              </p>
              <p className="mt-1 text-xs text-muted">
                Usa el boton &quot;Agregar&quot; para buscar y agregar ejercicios
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {exercises.map((ex, index) => (
                <div
                  key={`${ex.exercise.id}-${index}`}
                  className="rounded-lg border border-card-border bg-background p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted" />
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-xs font-medium"
                      >
                        {index + 1}
                      </span>
                      <span className="font-medium text-foreground">
                        {ex.exercise.name}
                      </span>
                      <Badge color="gray">
                        {muscleLabel(ex.exercise.muscle_group)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveExercise(index, 'up')}
                        disabled={index === 0}
                        className="rounded p-1 text-muted transition-colors hover:bg-card-bg hover:text-foreground disabled:opacity-30 cursor-pointer"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveExercise(index, 'down')}
                        disabled={index === exercises.length - 1}
                        className="rounded p-1 text-muted transition-colors hover:bg-card-bg hover:text-foreground disabled:opacity-30 cursor-pointer"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeExercise(index)}
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
                      value={ex.target_sets}
                      onChange={(e) =>
                        updateExercise(index, 'target_sets', e.target.value === '' ? '' as unknown as number : parseInt(e.target.value) || 0)
                      }
                      onBlur={(e) => {
                        const v = parseInt(e.target.value);
                        if (!v || v < 1) updateExercise(index, 'target_sets', 1);
                      }}
                    />
                    <Input
                      label="Reps"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={ex.target_reps}
                      onChange={(e) =>
                        updateExercise(index, 'target_reps', e.target.value === '' ? '' as unknown as number : parseInt(e.target.value) || 0)
                      }
                      onBlur={(e) => {
                        const v = parseInt(e.target.value);
                        if (!v || v < 1) updateExercise(index, 'target_reps', 1);
                      }}
                    />
                    <Input
                      label="Peso (kg)"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.5}
                      value={ex.target_weight_kg ?? ''}
                      onChange={(e) =>
                        updateExercise(
                          index,
                          'target_weight_kg',
                          e.target.value ? parseFloat(e.target.value) : null
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
                      value={ex.rest_seconds}
                      onChange={(e) =>
                        updateExercise(index, 'rest_seconds', e.target.value === '' ? '' as unknown as number : parseInt(e.target.value) || 0)
                      }
                      onBlur={(e) => {
                        const v = parseInt(e.target.value);
                        if (!v || v < 0) updateExercise(index, 'rest_seconds', 90);
                      }}
                    />
                  </div>

                  <div className="mt-3">
                    <Input
                      label="Notas (opcional)"
                      value={ex.notes}
                      onChange={(e) => updateExercise(index, 'notes', e.target.value)}
                      placeholder="Notas opcionales..."
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push('/routines')}
          >
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Crear Rutina
          </Button>
        </div>
      </form>

      {/* Quick Create Exercise Modal */}
      <Modal
        open={showCreateExercise}
        onClose={() => {
          setShowCreateExercise(false);
          setCreateExError('');
        }}
        title="Crear Ejercicio Rápido"
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

          {createExError && (
            <p className="text-sm text-danger">{createExError}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowCreateExercise(false);
                setCreateExError('');
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={savingExercise}>
              Crear y Agregar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
