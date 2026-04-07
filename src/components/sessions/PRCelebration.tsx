"use client";

import { useEffect, useRef } from "react";
import { Trophy, X } from "lucide-react";

/* ═══════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════ */

interface PRCelebrationProps {
  exerciseName: string;
  newWeight: number;
  previousWeight: number | null; // null if first time
  type: "weight" | "1rm"; // what kind of PR
  estimated1RM?: number;
  onDismiss: () => void;
}

/* ═══════════════════════════════════════════════════════
   Confetti colors mapped to theme variables
   ═══════════════════════════════════════════════════════ */

const CONFETTI_COLORS = [
  "var(--primary)",
  "var(--success)",
  "var(--warning)",
  "var(--info)",
  "var(--accent)",
];

function generateConfettiPieces(count: number) {
  const pieces: {
    left: number;
    delay: number;
    duration: number;
    color: string;
    size: number;
    isCircle: boolean;
    initialRotation: number;
  }[] = [];
  for (let i = 0; i < count; i++) {
    pieces.push({
      left: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 2.5 + Math.random() * 2,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 6 + Math.random() * 8,
      isCircle: Math.random() > 0.5,
      initialRotation: Math.random() * 360,
    });
  }
  return pieces;
}

const confettiPieces = generateConfettiPieces(24);

/* ═══════════════════════════════════════════════════════
   PR Celebration Component
   ═══════════════════════════════════════════════════════ */

export default function PRCelebration({
  exerciseName,
  newWeight,
  previousWeight,
  type,
  estimated1RM,
  onDismiss,
}: PRCelebrationProps) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-dismiss after 4 seconds
  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, 4000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onDismiss]);

  // Vibrate celebration pattern
  useEffect(() => {
    try {
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100, 50, 200, 100, 400]);
      }
    } catch {
      // Vibration not available
    }
  }, []);

  const improvement =
    previousWeight != null ? newWeight - previousWeight : null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      onClick={onDismiss}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Escape" || e.key === "Enter") onDismiss();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Confetti */}
      {confettiPieces.map((piece, i) => (
        <div
          key={i}
          className="pointer-events-none absolute top-0"
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.size,
            backgroundColor: piece.color,
            borderRadius: piece.isCircle ? "50%" : "2px",
            transform: `rotate(${piece.initialRotation}deg)`,
            animation: `pr-confetti-fall ${piece.duration}s ${piece.delay}s ease-in both`,
          }}
        />
      ))}

      {/* Card */}
      <div
        className="relative z-10 mx-4 w-full max-w-sm overflow-hidden rounded-2xl border border-card-border bg-card-bg shadow-2xl"
        style={{
          animation: "pr-card-enter 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dismiss button */}
        <button
          onClick={onDismiss}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-muted transition-colors hover:bg-card-border hover:text-foreground cursor-pointer"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center px-6 py-8 text-center">
          {/* Trophy icon */}
          <div
            className="mb-4 flex h-20 w-20 items-center justify-center rounded-full"
            style={{
              backgroundColor: "color-mix(in srgb, var(--warning) 20%, transparent)",
              animation: "pr-trophy-bounce 0.6s ease-out both, pr-trophy-glow 2s ease-in-out infinite alternate",
            }}
          >
            <Trophy
              className="h-10 w-10"
              style={{
                color: "var(--warning)",
                filter: "drop-shadow(0 0 8px var(--warning))",
              }}
            />
          </div>

          {/* Title */}
          <h2
            className="mb-1 text-2xl font-black uppercase tracking-tight text-foreground"
            style={{
              animation: "pr-text-reveal 0.4s 0.2s ease-out both",
            }}
          >
            NUEVO RECORD PERSONAL!
          </h2>

          {/* Exercise name */}
          <p
            className="mb-4 text-sm font-medium text-muted"
            style={{
              animation: "pr-text-reveal 0.4s 0.3s ease-out both",
            }}
          >
            {exerciseName}
          </p>

          {/* New weight - huge */}
          <div
            className="mb-3"
            style={{
              animation: "pr-weight-pop 0.5s 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
            }}
          >
            <span
              className="text-5xl font-black tabular-nums"
              style={{ color: "var(--primary)" }}
            >
              {newWeight}
            </span>
            <span
              className="ml-1 text-2xl font-bold"
              style={{ color: "var(--primary)" }}
            >
              kg
            </span>
          </div>

          {/* Previous vs New comparison */}
          {previousWeight != null && improvement != null && (
            <div
              className="mb-3 rounded-xl px-4 py-2.5"
              style={{
                backgroundColor: "color-mix(in srgb, var(--success) 10%, transparent)",
                animation: "pr-text-reveal 0.4s 0.5s ease-out both",
              }}
            >
              <span className="text-sm text-muted">
                Anterior:{" "}
                <span className="font-semibold text-foreground">
                  {previousWeight} kg
                </span>
              </span>
              <span className="mx-2 text-muted">&rarr;</span>
              <span className="text-sm text-muted">
                Nuevo:{" "}
                <span className="font-semibold text-foreground">
                  {newWeight} kg
                </span>
              </span>
              <span
                className="ml-2 text-sm font-bold"
                style={{ color: "var(--success)" }}
              >
                (+{improvement} kg)
              </span>
            </div>
          )}

          {/* 1RM estimated */}
          {type === "1rm" && estimated1RM != null && (
            <p
              className="mb-3 text-sm text-muted"
              style={{
                animation: "pr-text-reveal 0.4s 0.55s ease-out both",
              }}
            >
              1RM Estimado:{" "}
              <span className="font-bold text-foreground">
                {estimated1RM.toFixed(1)} kg
              </span>
            </p>
          )}

          {/* Motivational text */}
          <p
            className="mt-2 text-lg font-bold"
            style={{
              color: "var(--warning)",
              animation: "pr-text-reveal 0.4s 0.6s ease-out both",
            }}
          >
            Segui asi!
          </p>
        </div>
      </div>

      {/* CSS Keyframes */}
      <style>{`
        @keyframes pr-confetti-fall {
          0% {
            transform: translateY(-10vh) rotate(0deg);
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) rotate(720deg);
            opacity: 0;
          }
        }

        @keyframes pr-trophy-bounce {
          0% {
            transform: scale(0) rotate(-15deg);
          }
          50% {
            transform: scale(1.2) rotate(5deg);
          }
          70% {
            transform: scale(0.9) rotate(-3deg);
          }
          100% {
            transform: scale(1) rotate(0deg);
          }
        }

        @keyframes pr-trophy-glow {
          0% {
            box-shadow: 0 0 20px color-mix(in srgb, var(--warning) 20%, transparent);
          }
          100% {
            box-shadow: 0 0 40px color-mix(in srgb, var(--warning) 40%, transparent),
                        0 0 80px color-mix(in srgb, var(--warning) 15%, transparent);
          }
        }

        @keyframes pr-card-enter {
          0% {
            opacity: 0;
            transform: scale(0.8) translateY(20px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes pr-text-reveal {
          0% {
            opacity: 0;
            transform: translateY(10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pr-weight-pop {
          0% {
            opacity: 0;
            transform: scale(0.3);
          }
          60% {
            transform: scale(1.15);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
