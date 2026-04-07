import { Dumbbell } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      {/* Subtle radial gradient overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, var(--primary) 0%, transparent 60%)',
          opacity: 0.07,
        }}
      />

      {/* Branding */}
      <div className="relative z-10 mb-8 flex flex-col items-center gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Dumbbell className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            MisRepes
          </h1>
        </div>
        <p className="text-sm text-muted">Tu progreso, tu fuerza</p>
      </div>

      {/* Card container */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-card-border bg-card-bg p-8 shadow-xl shadow-black/5">
        {children}
      </div>

      {/* Footer */}
      <p className="relative z-10 mt-8 text-xs text-muted">
        MisRepes &copy; 2026
      </p>
    </div>
  );
}
