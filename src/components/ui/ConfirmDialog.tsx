"use client";

import { useCallback, useState } from "react";
import { AlertTriangle, Info } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

type Variant = "danger" | "primary";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: Variant;
}

const iconMap: Record<Variant, typeof AlertTriangle> = {
  danger: AlertTriangle,
  primary: Info,
};

const iconColorMap: Record<Variant, string> = {
  danger: "var(--danger)",
  primary: "var(--info)",
};

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Eliminar",
  cancelText = "Cancelar",
  variant = "danger",
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  const Icon = iconMap[variant];

  const handleConfirm = useCallback(async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  }, [onConfirm]);

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="flex flex-col items-center gap-4 text-center">
        {/* Icon */}
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{
            backgroundColor: `color-mix(in srgb, ${iconColorMap[variant]} 15%, transparent)`,
          }}
        >
          <Icon
            className="h-6 w-6"
            style={{ color: iconColorMap[variant] }}
            aria-hidden="true"
          />
        </div>

        {/* Message */}
        <p className="text-sm text-muted">{message}</p>
      </div>

      {/* Actions */}
      <div className="mt-6 flex items-center justify-end gap-3">
        <Button
          variant="secondary"
          size="md"
          onClick={onClose}
          disabled={loading}
        >
          {cancelText}
        </Button>
        <Button
          variant={variant === "danger" ? "danger" : "primary"}
          size="md"
          loading={loading}
          onClick={handleConfirm}
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
}
