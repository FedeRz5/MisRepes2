'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, AlertCircle, LogIn, Ban } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [banned, setBanned] = useState(false);

  useEffect(() => {
    if (searchParams.get('banned') === '1') {
      setBanned(true);
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        return;
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
          Iniciar Sesión
        </h1>
        <p className="mt-1 text-sm text-muted">
          Ingresa tus credenciales para acceder a tu cuenta.
        </p>
      </div>

      {banned && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          <Ban className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Tu cuenta ha sido suspendida. Contacta al administrador para más información.</span>
        </div>
      )}

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger animate-in fade-in slide-in-from-top-1 duration-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
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

        <div className="relative">
          <Input
            label="Contraseña"
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            autoComplete="current-password"
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

        <div className="pt-1">
          <Button
            type="submit"
            loading={loading}
            fullWidth
            size="lg"
          >
            <LogIn className="h-4 w-4" />
            {loading ? 'Ingresando...' : 'Ingresar'}
          </Button>
        </div>
      </form>

      <div className="mt-6 flex items-center justify-center gap-1 text-sm">
        <span className="text-muted">¿No tienes cuenta?</span>
        <Link
          href="/register"
          className="font-medium text-primary transition-colors hover:text-primary-hover hover:underline"
        >
          Regístrate
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-center text-muted">Cargando...</div>}>
      <LoginForm />
    </Suspense>
  );
}
