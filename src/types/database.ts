export type UserRole = 'owner' | 'trainer' | 'user';

export type MuscleGroup =
  | 'pecho'
  | 'espalda'
  | 'hombros'
  | 'biceps'
  | 'triceps'
  | 'piernas'
  | 'gluteos'
  | 'abdominales'
  | 'antebrazos'
  | 'pantorrillas'
  | 'cuerpo_completo';

export type ExerciseType = 'compuesto' | 'aislado';
export type Equipment = 'barra' | 'mancuerna' | 'maquina' | 'cable' | 'peso_corporal' | 'banda' | 'kettlebell' | 'otro';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  birth_date: string | null;
  goal: string | null;
  banned: boolean;
  created_at: string;
}

export interface Exercise {
  id: string;
  name: string;
  muscle_group: MuscleGroup;
  secondary_muscle_group: MuscleGroup | null;
  exercise_type: ExerciseType;
  equipment: Equipment;
  instructions: string | null;
  video_url: string | null;
  created_by: string;
  is_global: boolean;
  created_at: string;
}

export interface Routine {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  day_of_week: number | null; // 0=lunes, 6=domingo
  created_at: string;
}

export interface RoutineExercise {
  id: string;
  routine_id: string;
  exercise_id: string;
  order_index: number;
  target_sets: number;
  target_reps: number;
  target_weight_kg: number | null;
  rest_seconds: number;
  notes: string | null;
  exercise?: Exercise;
}

export interface RoutineAssignment {
  id: string;
  routine_id: string;
  user_id: string;
  assigned_by: string;
  active: boolean;
  created_at: string;
  routine?: Routine;
  profile?: Profile;
}

export interface WorkoutSession {
  id: string;
  user_id: string;
  routine_id: string | null;
  date: string;
  duration_minutes: number | null;
  notes: string | null;
  completed: boolean;
  rating: number | null; // 1-5 difficulty scale
  created_at: string;
  routine?: Routine;
}

export interface WorkoutSet {
  id: string;
  session_id: string;
  exercise_id: string;
  set_number: number;
  reps: number;
  weight_kg: number;
  rpe: number | null; // 1-10
  completed: boolean;
  notes: string | null;
  exercise?: Exercise;
}

export interface TrainerFeedback {
  id: string;
  session_id: string;
  trainer_id: string;
  message: string;
  created_at: string;
  trainer?: Profile;
}

export interface BodyMeasurement {
  id: string;
  user_id: string;
  date: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  arm_cm: number | null;
  leg_cm: number | null;
  notes: string | null;
  created_at: string;
}

export interface ProgressPhoto {
  id: string;
  user_id: string;
  photo_url: string;
  date: string;
  category: 'frente' | 'espalda' | 'lateral' | 'otro';
  weight_kg: number | null;
  body_fat_pct: number | null;
  notes: string | null;
  created_at: string;
}

export interface Invitation {
  id: string;
  code: string;
  created_by: string;
  role: UserRole;
  used_by: string | null;
  expires_at: string;
  created_at: string;
}
