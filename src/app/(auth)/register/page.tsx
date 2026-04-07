'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, AlertCircle, UserPlus, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

function getPasswordStrength(password: string): {
  level: 'weak' | 'medium' | 'strong';
  label: string;
  percent: number;
  color: string;
} {
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) {
    return { level: 'weak', label: 'Débil', percent: 33, color: 'bg-danger' };
  }
  if (score <= 3) {
    return { level: 'medium', label: 'Media', percent: 66, color: 'bg-warning' };
  }
  return { level: 'strong', label: 'Fuerte', percent: 100, color: 'bg-success' };
}

function RegisterForm() {
  const searchParams = useSearchParams();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [invitationCode, setInvitationCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const passwordStrength = useMemo(
    () => (password.length > 0 ? getPasswordStrength(password) : null),
    [password]
  );

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      setInvitationCode(code);
    }
  }, [searchParams]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();

      // Step 1: Validate the invitation code
      const { data: invitation, error: invError } = await supabase
        .from('invitations')
        .select('*')
        .eq('code', invitationCode)
        .single();

      if (invError || !invitation) {
        setError('Código de invitación no encontrado.');
        return;
      }

      // Check if invitation is expired
      if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
        setError('El código de invitación ha expirado.');
        return;
      }

      // Step 2: Sign up with Supabase auth
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (!authData.user) {
        setError('Error al crear la cuenta. Intenta de nuevo.');
        return;
      }

      // Step 3: Update the profile with the role from the invitation
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role: invitation.role })
        .eq('id', authData.user.id);

      if (profileError) {
        console.error('Error updating profile:', profileError);
        // Non-blocking: account created, role will default to 'user'
      }

      window.location.href = '/dashboard';
    } catch {
      setError('Ocurrió un error inesperado. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Crear Cuenta
        </h1>
        <p className="mt-1 text-sm text-muted">
          Completa tus datos para registrarte.
        </p>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger animate-in fade-in slide-in-from-top-1 duration-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleRegister} className="space-y-4">
        <Input
          label="Nombre Completo"
          id="fullName"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          placeholder="Juan Pérez"
          autoComplete="name"
        />

        <Input
          label="Email"
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="tu@email.com"
          autoComplete="email"
        />

        <div>
          <div className="relative">
            <Input
              label="Contraseña"
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              autoComplete="new-password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-[34px] text-muted transition-colors hover:text-foreground"
              tabIndex={-1}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Password strength indicator */}
          {passwordStrength && (
            <div className="mt-2 space-y-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-card-border">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${passwordStrength.color}`}
                  style={{ width: `${passwordStrength.percent}%` }}
                />
              </div>
              <p className="text-xs text-muted">
                Seguridad:{' '}
                <span
                  className={
                    passwordStrength.level === 'weak'
                      ? 'text-danger'
                      : passwordStrength.level === 'medium'
                        ? 'text-warning'
                        : 'text-success'
                  }
                >
                  {passwordStrength.label}
                </span>
              </p>
            </div>
          )}
        </div>

        <Input
          label="Código de Invitación"
          id="invitationCode"
          type="text"
          value={invitationCode}
          onChange={(e) => setInvitationCode(e.target.value)}
          required
          placeholder="ABC123"
          autoComplete="off"
        />

        <div className="pt-1">
          <Button
            type="submit"
            loading={loading}
            fullWidth
            size="lg"
          >
            <UserPlus className="h-4 w-4" />
            {loading ? 'Creando cuenta...' : 'Registrarse'}
          </Button>
        </div>
      </form>

      <div className="mt-6 flex items-center justify-center gap-1 text-sm">
        <span className="text-muted">¿Ya tienes cuenta?</span>
        <Link
          href="/login"
          className="font-medium text-primary transition-colors hover:text-primary-hover hover:underline"
        >
          Inicia Sesión
        </Link>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12 text-muted">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          <span className="text-sm">Cargando...</span>
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
