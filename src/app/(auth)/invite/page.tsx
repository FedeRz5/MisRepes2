'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ArrowRight, Ticket } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

export default function InvitePage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();

      const { data: invitation, error: invError } = await supabase
        .from('invitations')
        .select('id, code, used_by, expires_at')
        .eq('code', code.trim())
        .single();

      if (invError || !invitation) {
        setError('Código de invitación no encontrado.');
        return;
      }

      if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
        setError('Este código de invitación ha expirado.');
        return;
      }

      router.push(`/register?code=${encodeURIComponent(invitation.code)}`);
    } catch {
      setError('Ocurrió un error inesperado. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Ticket className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Código de Invitación
        </h1>
        <p className="mt-1 text-sm text-muted">
          Ingresa tu código de invitación para comenzar el registro.
        </p>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger animate-in fade-in slide-in-from-top-1 duration-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleValidate} className="space-y-4">
        <Input
          label="Código"
          id="code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          placeholder="Ingresa tu código"
          autoComplete="off"
          autoFocus
        />

        <div className="pt-1">
          <Button
            type="submit"
            loading={loading}
            fullWidth
            size="lg"
          >
            {loading ? (
              'Validando...'
            ) : (
              <>
                Continuar
                <ArrowRight className="h-4 w-4" />
              </>
            )}
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
