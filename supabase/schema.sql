-- ============================================
-- GYM APP - Schema completo
-- Correr esto en Supabase SQL Editor
-- ============================================

-- Perfiles de usuario
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text not null default '',
  role text not null default 'user' check (role in ('owner', 'trainer', 'user')),
  avatar_url text,
  weight_kg numeric,
  height_cm numeric,
  birth_date date,
  goal text,
  created_at timestamptz default now()
);

-- Ejercicios
create table public.exercises (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  muscle_group text not null,
  secondary_muscle_group text,
  exercise_type text not null default 'compuesto' check (exercise_type in ('compuesto', 'aislado')),
  equipment text not null default 'barra',
  instructions text,
  created_by uuid references public.profiles(id),
  is_global boolean default false,
  created_at timestamptz default now()
);

-- Rutinas
create table public.routines (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  created_by uuid references public.profiles(id) not null,
  day_of_week smallint check (day_of_week >= 0 and day_of_week <= 6),
  created_at timestamptz default now()
);

-- Ejercicios dentro de una rutina
create table public.routine_exercises (
  id uuid default gen_random_uuid() primary key,
  routine_id uuid references public.routines(id) on delete cascade not null,
  exercise_id uuid references public.exercises(id) not null,
  order_index smallint not null default 0,
  target_sets smallint not null default 3,
  target_reps smallint not null default 10,
  target_weight_kg numeric,
  rest_seconds smallint not null default 90,
  notes text
);

-- Asignación de rutinas a usuarios
create table public.routine_assignments (
  id uuid default gen_random_uuid() primary key,
  routine_id uuid references public.routines(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  assigned_by uuid references public.profiles(id) not null,
  active boolean default true,
  created_at timestamptz default now(),
  unique(routine_id, user_id)
);

-- Sesiones de entrenamiento
create table public.workout_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  routine_id uuid references public.routines(id),
  date date not null default current_date,
  duration_minutes smallint,
  notes text,
  completed boolean default false,
  created_at timestamptz default now()
);

-- Series realizadas
create table public.workout_sets (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.workout_sessions(id) on delete cascade not null,
  exercise_id uuid references public.exercises(id) not null,
  set_number smallint not null,
  reps smallint not null,
  weight_kg numeric not null default 0,
  rpe smallint check (rpe >= 1 and rpe <= 10),
  completed boolean default true,
  notes text
);

-- Feedback del entrenador
create table public.trainer_feedback (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.workout_sessions(id) on delete cascade not null,
  trainer_id uuid references public.profiles(id) not null,
  message text not null,
  created_at timestamptz default now()
);

-- Medidas corporales
create table public.body_measurements (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null default current_date,
  weight_kg numeric,
  body_fat_pct numeric,
  chest_cm numeric,
  waist_cm numeric,
  arm_cm numeric,
  leg_cm numeric,
  notes text,
  created_at timestamptz default now()
);

-- Invitaciones
create table public.invitations (
  id uuid default gen_random_uuid() primary key,
  code text not null unique,
  created_by uuid references public.profiles(id) not null,
  role text not null default 'user' check (role in ('trainer', 'user')),
  used_by uuid references public.profiles(id),
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.routines enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.routine_assignments enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_sets enable row level security;
alter table public.trainer_feedback enable row level security;
alter table public.body_measurements enable row level security;
alter table public.invitations enable row level security;

-- Profiles: usuarios ven su perfil, trainers/owners ven todos
create policy "Users view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Trainers view all profiles" on public.profiles
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('trainer', 'owner'))
  );

create policy "Users update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Exercises: todos ven globales + los suyos, todos pueden crear
create policy "View exercises" on public.exercises
  for select using (is_global or created_by = auth.uid());

create policy "Users create exercises" on public.exercises
  for insert with check (auth.uid() IS NOT NULL);

create policy "Trainers update exercises" on public.exercises
  for update using (
    created_by = auth.uid() or
    exists (select 1 from public.profiles where id = auth.uid() and role = 'owner')
  );

create policy "Owner delete exercises" on public.exercises
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'owner')
  );

-- Routines: trainers/owners crean, usuarios ven las asignadas
create policy "View own or assigned routines" on public.routines
  for select using (
    created_by = auth.uid() or
    exists (select 1 from public.routine_assignments where routine_id = id and user_id = auth.uid()) or
    exists (select 1 from public.profiles where id = auth.uid() and role in ('trainer', 'owner'))
  );

create policy "Trainers create routines" on public.routines
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('trainer', 'owner'))
  );

create policy "Trainers update own routines" on public.routines
  for update using (
    created_by = auth.uid() or
    exists (select 1 from public.profiles where id = auth.uid() and role = 'owner')
  );

create policy "Trainers delete own routines" on public.routines
  for delete using (
    created_by = auth.uid() or
    exists (select 1 from public.profiles where id = auth.uid() and role = 'owner')
  );

-- Routine exercises: mismas reglas que routines
create policy "View routine exercises" on public.routine_exercises
  for select using (
    exists (select 1 from public.routines where id = routine_id and (
      created_by = auth.uid() or
      exists (select 1 from public.routine_assignments where routine_id = routine_exercises.routine_id and user_id = auth.uid()) or
      exists (select 1 from public.profiles where id = auth.uid() and role in ('trainer', 'owner'))
    ))
  );

create policy "Trainers manage routine exercises" on public.routine_exercises
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('trainer', 'owner'))
  );

-- Routine assignments
create policy "View own assignments" on public.routine_assignments
  for select using (
    user_id = auth.uid() or
    assigned_by = auth.uid() or
    exists (select 1 from public.profiles where id = auth.uid() and role in ('trainer', 'owner'))
  );

create policy "Trainers assign routines" on public.routine_assignments
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('trainer', 'owner'))
  );

create policy "Trainers update assignments" on public.routine_assignments
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('trainer', 'owner'))
  );

-- Workout sessions: usuarios ven las suyas, trainers ven todas
create policy "View own sessions" on public.workout_sessions
  for select using (
    user_id = auth.uid() or
    exists (select 1 from public.profiles where id = auth.uid() and role in ('trainer', 'owner'))
  );

create policy "Users create sessions" on public.workout_sessions
  for insert with check (user_id = auth.uid());

create policy "Users update own sessions" on public.workout_sessions
  for update using (user_id = auth.uid());

-- Workout sets
create policy "View own sets" on public.workout_sets
  for select using (
    exists (select 1 from public.workout_sessions where id = session_id and (
      user_id = auth.uid() or
      exists (select 1 from public.profiles where id = auth.uid() and role in ('trainer', 'owner'))
    ))
  );

create policy "Users create sets" on public.workout_sets
  for insert with check (
    exists (select 1 from public.workout_sessions where id = session_id and user_id = auth.uid())
  );

create policy "Users update own sets" on public.workout_sets
  for update using (
    exists (select 1 from public.workout_sessions where id = session_id and user_id = auth.uid())
  );

create policy "Users delete own sets" on public.workout_sets
  for delete using (
    exists (select 1 from public.workout_sessions where id = session_id and user_id = auth.uid())
  );

-- Trainer feedback
create policy "View feedback on own sessions" on public.trainer_feedback
  for select using (
    trainer_id = auth.uid() or
    exists (select 1 from public.workout_sessions where id = session_id and user_id = auth.uid()) or
    exists (select 1 from public.profiles where id = auth.uid() and role = 'owner')
  );

create policy "Trainers create feedback" on public.trainer_feedback
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('trainer', 'owner'))
  );

-- Body measurements
create policy "View own measurements" on public.body_measurements
  for select using (
    user_id = auth.uid() or
    exists (select 1 from public.profiles where id = auth.uid() and role in ('trainer', 'owner'))
  );

create policy "Users manage own measurements" on public.body_measurements
  for all using (user_id = auth.uid());

-- Invitations
create policy "Owner manages invitations" on public.invitations
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'owner')
  );

create policy "View invitation by code" on public.invitations
  for select using (true);

-- ============================================
-- Trigger: crear perfil automáticamente al registrar usuario
-- ============================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- Ejercicios precargados (globales)
-- ============================================

insert into public.exercises (name, muscle_group, secondary_muscle_group, exercise_type, equipment, is_global, created_by) values
  ('Press Banca', 'pecho', 'triceps', 'compuesto', 'barra', true, null),
  ('Press Banca Inclinado', 'pecho', 'hombros', 'compuesto', 'barra', true, null),
  ('Press Banca con Mancuernas', 'pecho', 'triceps', 'compuesto', 'mancuerna', true, null),
  ('Aperturas con Mancuernas', 'pecho', null, 'aislado', 'mancuerna', true, null),
  ('Cruces en Polea', 'pecho', null, 'aislado', 'cable', true, null),
  ('Fondos en Paralelas', 'pecho', 'triceps', 'compuesto', 'peso_corporal', true, null),
  ('Sentadilla', 'piernas', 'gluteos', 'compuesto', 'barra', true, null),
  ('Prensa de Piernas', 'piernas', 'gluteos', 'compuesto', 'maquina', true, null),
  ('Extensión de Cuádriceps', 'piernas', null, 'aislado', 'maquina', true, null),
  ('Curl Femoral', 'piernas', null, 'aislado', 'maquina', true, null),
  ('Sentadilla Búlgara', 'piernas', 'gluteos', 'compuesto', 'mancuerna', true, null),
  ('Peso Muerto', 'espalda', 'piernas', 'compuesto', 'barra', true, null),
  ('Peso Muerto Rumano', 'piernas', 'espalda', 'compuesto', 'barra', true, null),
  ('Dominadas', 'espalda', 'biceps', 'compuesto', 'peso_corporal', true, null),
  ('Remo con Barra', 'espalda', 'biceps', 'compuesto', 'barra', true, null),
  ('Remo con Mancuerna', 'espalda', 'biceps', 'compuesto', 'mancuerna', true, null),
  ('Jalón al Pecho', 'espalda', 'biceps', 'compuesto', 'cable', true, null),
  ('Remo en Polea Baja', 'espalda', null, 'compuesto', 'cable', true, null),
  ('Press Militar', 'hombros', 'triceps', 'compuesto', 'barra', true, null),
  ('Press con Mancuernas (Hombro)', 'hombros', 'triceps', 'compuesto', 'mancuerna', true, null),
  ('Elevaciones Laterales', 'hombros', null, 'aislado', 'mancuerna', true, null),
  ('Elevaciones Frontales', 'hombros', null, 'aislado', 'mancuerna', true, null),
  ('Pájaros', 'hombros', 'espalda', 'aislado', 'mancuerna', true, null),
  ('Curl con Barra', 'biceps', null, 'aislado', 'barra', true, null),
  ('Curl con Mancuernas', 'biceps', null, 'aislado', 'mancuerna', true, null),
  ('Curl Martillo', 'biceps', 'antebrazos', 'aislado', 'mancuerna', true, null),
  ('Curl en Polea', 'biceps', null, 'aislado', 'cable', true, null),
  ('Tríceps en Polea', 'triceps', null, 'aislado', 'cable', true, null),
  ('Extensión de Tríceps sobre Cabeza', 'triceps', null, 'aislado', 'mancuerna', true, null),
  ('Fondos para Tríceps', 'triceps', null, 'aislado', 'peso_corporal', true, null),
  ('Press Francés', 'triceps', null, 'aislado', 'barra', true, null),
  ('Hip Thrust', 'gluteos', 'piernas', 'compuesto', 'barra', true, null),
  ('Elevación de Pantorrillas', 'pantorrillas', null, 'aislado', 'maquina', true, null),
  ('Crunch Abdominal', 'abdominales', null, 'aislado', 'peso_corporal', true, null),
  ('Plancha', 'abdominales', null, 'aislado', 'peso_corporal', true, null),
  ('Encogimientos de Hombros', 'espalda', null, 'aislado', 'mancuerna', true, null);
