"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Textarea, Select } from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import {
  Camera,
  Upload,
  Trash2,
  Scale,
  Calendar,
  Filter,
  ArrowLeftRight,
  ImageIcon,
  CheckCircle,
  AlertCircle,
  X,
} from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { ProgressPhoto } from "@/types/database";

const CATEGORIES = [
  { value: "frente", label: "Frente" },
  { value: "espalda", label: "Espalda" },
  { value: "lateral", label: "Lateral" },
  { value: "otro", label: "Otro" },
] as const;

const CATEGORY_COLORS: Record<string, "green" | "blue" | "purple" | "gray"> = {
  frente: "green",
  espalda: "blue",
  lateral: "purple",
  otro: "gray",
};

function formatDateES(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ProgressPhotosPage() {
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Upload form
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadDate, setUploadDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [category, setCategory] = useState<string>("frente");
  const [weightKg, setWeightKg] = useState("");
  const [bodyFatPct, setBodyFatPct] = useState("");
  const [notes, setNotes] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Gallery
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [viewingPhoto, setViewingPhoto] = useState<ProgressPhoto | null>(null);

  // Delete confirm
  const [photoToDelete, setPhotoToDelete] = useState<ProgressPhoto | null>(null);

  // Comparison
  const [compareMode, setCompareMode] = useState(false);
  const [compareA, setCompareA] = useState<string>("");
  const [compareB, setCompareB] = useState<string>("");

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);

  async function loadData() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data } = await supabase
        .from("progress_photos")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      if (data) setPhotos(data as ProgressPhoto[]);
    } catch (err) {
      console.error("Error loading progress photos:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleFileSelect(file: File) {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      setMessage({ type: "error", text: "Solo se permiten imágenes (JPG, PNG, WebP)." });
      return;
    }
    if (file.size > maxSize) {
      setMessage({ type: "error", text: "La imagen no puede superar los 10MB." });
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) handleFileSelect(file);
  }

  function clearSelectedFile() {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile || !userId) return;

    setUploading(true);
    setMessage(null);

    try {
      const ext = selectedFile.name.split(".").pop() || "jpg";
      const timestamp = Date.now();
      const filePath = `${userId}/${timestamp}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("progress-photos")
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("progress-photos")
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase
        .from("progress_photos")
        .insert({
          user_id: userId,
          photo_url: urlData.publicUrl,
          date: uploadDate,
          category,
          weight_kg: weightKg ? parseFloat(weightKg) : null,
          body_fat_pct: bodyFatPct ? parseFloat(bodyFatPct) : null,
          notes: notes || null,
        });

      if (insertError) throw insertError;

      setMessage({ type: "success", text: "Foto subida correctamente." });
      clearSelectedFile();
      setWeightKg("");
      setBodyFatPct("");
      setNotes("");
      setCategory("frente");
      setUploadDate(new Date().toISOString().split("T")[0]);
      loadData();
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Error al subir la foto." });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(photo: ProgressPhoto) {
    try {
      // Extract file path from URL
      const url = new URL(photo.photo_url);
      const pathParts = url.pathname.split("/storage/v1/object/public/progress-photos/");
      if (pathParts[1]) {
        await supabase.storage
          .from("progress-photos")
          .remove([decodeURIComponent(pathParts[1])]);
      }

      const { error } = await supabase
        .from("progress_photos")
        .delete()
        .eq("id", photo.id);

      if (error) throw error;

      setMessage({ type: "success", text: "Foto eliminada." });
      setViewingPhoto(null);
      loadData();
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Error al eliminar la foto." });
    }
  }

  const filteredPhotos = useMemo(() => {
    if (filterCategory === "all") return photos;
    return photos.filter((p) => p.category === filterCategory);
  }, [photos, filterCategory]);

  // Unique dates for comparison selectors
  const uniqueDates = useMemo(() => {
    const dates = [...new Set(photos.map((p) => p.date))];
    return dates.sort((a, b) => b.localeCompare(a));
  }, [photos]);

  const comparePhotoA = useMemo(
    () => (compareA ? photos.find((p) => p.date === compareA) : null),
    [photos, compareA]
  );
  const comparePhotoB = useMemo(
    () => (compareB ? photos.find((p) => p.date === compareB) : null),
    [photos, compareB]
  );

  // Weight chart data
  const weightData = useMemo(() => {
    return photos
      .filter((p) => p.weight_kg !== null)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((p) => ({ date: p.date, weight: p.weight_kg as number }));
  }, [photos]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <Camera className="h-8 w-8 text-primary animate-pulse" />
          <p className="text-muted text-sm">Cargando progreso...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Progreso Corporal
        </h1>
        <p className="text-muted text-sm mt-1">
          Registra tu transformacion con fotos y seguimiento de peso
        </p>
      </div>

      {/* Feedback Message */}
      {message && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg border text-sm transition-all duration-300 ${
            message.type === "success"
              ? "border-[var(--success)]/25 text-[var(--success)]"
              : "bg-danger/10 border-danger/25 text-danger"
          }`}
          style={
            message.type === "success"
              ? {
                  backgroundColor:
                    "color-mix(in srgb, var(--success) 10%, transparent)",
                }
              : undefined
          }
        >
          {message.type === "success" ? (
            <CheckCircle className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      {/* Upload Section */}
      <Card>
        <div className="flex items-center gap-2 mb-5">
          <Upload className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">
            Subir Foto de Progreso
          </h2>
        </div>

        <form onSubmit={handleUpload} className="space-y-4">
          {/* Drop zone / preview */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !selectedFile && fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all duration-200 ${
              selectedFile
                ? "border-primary/40 bg-primary/5 p-2"
                : dragOver
                  ? "border-primary bg-primary/10 cursor-pointer py-12"
                  : "border-card-border hover:border-primary/40 hover:bg-primary/5 cursor-pointer py-12"
            }`}
          >
            {selectedFile && previewUrl ? (
              <div className="relative w-full max-w-xs mx-auto">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full rounded-lg object-contain max-h-64"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearSelectedFile();
                  }}
                  className="absolute top-2 right-2 rounded-full bg-background/80 backdrop-blur-sm p-1.5 text-muted hover:text-foreground transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <Camera className="h-10 w-10 text-muted/50 mb-3" />
                <p className="text-sm font-medium text-foreground">
                  Arrastra una foto o haz clic para seleccionar
                </p>
                <p className="text-xs text-muted mt-1">
                  JPG, PNG o WebP
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileInputChange}
            />
          </div>

          {/* Form fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Input
              label="Fecha"
              type="date"
              value={uploadDate}
              onChange={(e) => setUploadDate(e.target.value)}
            />
            <Select
              label="Categoria"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
            <Input
              label="Peso (kg)"
              type="number"
              step="0.1"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="75.0"
            />
            <Input
              label="Grasa corporal (%)"
              type="number"
              step="0.1"
              value={bodyFatPct}
              onChange={(e) => setBodyFatPct(e.target.value)}
              placeholder="15.0"
            />
          </div>

          <Textarea
            label="Notas (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observaciones sobre tu progreso..."
            rows={2}
          />

          <div className="flex justify-end">
            <Button
              type="submit"
              loading={uploading}
              disabled={!selectedFile}
            >
              <Upload className="h-4 w-4" />
              Subir Foto
            </Button>
          </div>
        </form>
      </Card>

      {/* Weight Chart */}
      {weightData.length >= 2 && (
        <Card>
          <div className="flex items-center gap-2 mb-5">
            <Scale className="h-5 w-5" style={{ color: "var(--info)" }} />
            <h2 className="text-lg font-semibold text-foreground">
              Evolucion de Peso
            </h2>
          </div>
          <WeightChart data={weightData} />
        </Card>
      )}

      {/* Comparison Section */}
      {photos.length >= 2 && (
        <Card>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <ArrowLeftRight
                className="h-5 w-5"
                style={{ color: "var(--accent)" }}
              />
              <h2 className="text-lg font-semibold text-foreground">
                Comparacion
              </h2>
            </div>
            <Button
              variant={compareMode ? "primary" : "secondary"}
              size="sm"
              onClick={() => setCompareMode(!compareMode)}
            >
              {compareMode ? "Cerrar" : "Comparar"}
            </Button>
          </div>

          {compareMode && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Antes"
                  value={compareA}
                  onChange={(e) => setCompareA(e.target.value)}
                >
                  <option value="">Seleccionar fecha</option>
                  {uniqueDates.map((d) => (
                    <option key={d} value={d}>
                      {formatDateES(d)}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Despues"
                  value={compareB}
                  onChange={(e) => setCompareB(e.target.value)}
                >
                  <option value="">Seleccionar fecha</option>
                  {uniqueDates.map((d) => (
                    <option key={d} value={d}>
                      {formatDateES(d)}
                    </option>
                  ))}
                </Select>
              </div>

              {comparePhotoA && comparePhotoB && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="text-center">
                        <Badge color="gray" size="sm">
                          Antes
                        </Badge>
                      </div>
                      <div className="rounded-lg overflow-hidden border border-card-border aspect-[3/4]">
                        <img
                          src={comparePhotoA.photo_url}
                          alt="Antes"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-xs text-muted text-center">
                        {formatDateES(comparePhotoA.date)}
                        {comparePhotoA.weight_kg &&
                          ` - ${comparePhotoA.weight_kg} kg`}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <div className="text-center">
                        <Badge color="green" size="sm">
                          Despues
                        </Badge>
                      </div>
                      <div className="rounded-lg overflow-hidden border border-card-border aspect-[3/4]">
                        <img
                          src={comparePhotoB.photo_url}
                          alt="Despues"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-xs text-muted text-center">
                        {formatDateES(comparePhotoB.date)}
                        {comparePhotoB.weight_kg &&
                          ` - ${comparePhotoB.weight_kg} kg`}
                      </p>
                    </div>
                  </div>

                  {comparePhotoA.weight_kg && comparePhotoB.weight_kg && (
                    <div className="text-center p-3 rounded-lg bg-background border border-card-border">
                      <p className="text-sm text-muted">Diferencia de peso</p>
                      <p
                        className="text-lg font-bold"
                        style={{
                          color:
                            comparePhotoB.weight_kg - comparePhotoA.weight_kg <=
                            0
                              ? "var(--success)"
                              : "var(--warning)",
                        }}
                      >
                        {(
                          comparePhotoB.weight_kg - comparePhotoA.weight_kg
                        ).toFixed(1)}{" "}
                        kg
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Gallery */}
      <Card>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Galeria</h2>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="text-sm bg-background border border-card-border rounded-lg px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="all">Todas</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredPhotos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredPhotos.map((photo) => (
              <button
                key={photo.id}
                onClick={() => setViewingPhoto(photo)}
                className="group relative rounded-xl overflow-hidden border border-card-border aspect-[3/4] transition-all duration-200 hover:border-primary/40 hover:shadow-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <img
                  src={photo.photo_url}
                  alt={`Progreso ${photo.category} - ${photo.date}`}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/90 font-medium">
                      {formatDateES(photo.date)}
                    </span>
                    <Badge
                      color={CATEGORY_COLORS[photo.category] || "gray"}
                      size="sm"
                    >
                      {CATEGORIES.find((c) => c.value === photo.category)
                        ?.label || photo.category}
                    </Badge>
                  </div>
                  {photo.weight_kg && (
                    <p className="text-xs text-white/70 mt-1">
                      {photo.weight_kg} kg
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Camera className="h-10 w-10 text-muted/30" />
            <p className="text-muted text-sm">No hay fotos de progreso.</p>
            <p className="text-muted/70 text-xs">
              Sube tu primera foto para comenzar el seguimiento visual.
            </p>
          </div>
        )}
      </Card>

      {/* Full-size photo modal */}
      <Modal
        open={!!viewingPhoto}
        onClose={() => setViewingPhoto(null)}
        title="Foto de Progreso"
        size="lg"
      >
        {viewingPhoto && (
          <div className="space-y-4">
            <div className="rounded-lg overflow-hidden border border-card-border">
              <img
                src={viewingPhoto.photo_url}
                alt={`Progreso ${viewingPhoto.category}`}
                className="w-full max-h-[60vh] object-contain bg-background"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                color={CATEGORY_COLORS[viewingPhoto.category] || "gray"}
              >
                {CATEGORIES.find((c) => c.value === viewingPhoto.category)
                  ?.label || viewingPhoto.category}
              </Badge>
              <span className="flex items-center gap-1.5 text-sm text-muted">
                <Calendar className="h-3.5 w-3.5" />
                {formatDateES(viewingPhoto.date)}
              </span>
              {viewingPhoto.weight_kg && (
                <span className="flex items-center gap-1.5 text-sm text-muted">
                  <Scale className="h-3.5 w-3.5" />
                  {viewingPhoto.weight_kg} kg
                </span>
              )}
              {viewingPhoto.body_fat_pct && (
                <span className="text-sm text-muted">
                  {viewingPhoto.body_fat_pct}% grasa
                </span>
              )}
            </div>
            {viewingPhoto.notes && (
              <p className="text-sm text-muted bg-background rounded-lg p-3 border border-card-border">
                {viewingPhoto.notes}
              </p>
            )}
            <div className="flex justify-end">
              <Button
                variant="danger"
                size="sm"
                onClick={() => setPhotoToDelete(viewingPhoto)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete photo confirm */}
      <ConfirmDialog
        open={!!photoToDelete}
        onClose={() => setPhotoToDelete(null)}
        onConfirm={() => {
          if (photoToDelete) {
            handleDelete(photoToDelete);
            setPhotoToDelete(null);
          }
        }}
        title="Eliminar foto"
        message="¿Estás seguro de que quieres eliminar esta foto? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        variant="danger"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Weight Chart Component                                              */
/* ------------------------------------------------------------------ */

function WeightChart({
  data,
}: {
  data: { date: string; weight: number }[];
}) {
  if (data.length < 2) return null;

  const width = 600;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };

  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const weights = data.map((d) => d.weight);
  const minW = Math.floor(Math.min(...weights) - 1);
  const maxW = Math.ceil(Math.max(...weights) + 1);
  const rangeW = maxW - minW || 1;

  const xScale = (i: number) =>
    padding.left + (i / (data.length - 1)) * chartW;
  const yScale = (w: number) =>
    padding.top + chartH - ((w - minW) / rangeW) * chartH;

  const pathD = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(i)} ${yScale(d.weight)}`)
    .join(" ");

  // Area fill
  const areaD = `${pathD} L ${xScale(data.length - 1)} ${padding.top + chartH} L ${xScale(0)} ${padding.top + chartH} Z`;

  // Y-axis labels (5 ticks)
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const val = minW + (rangeW * i) / 4;
    return { val: Math.round(val * 10) / 10, y: yScale(val) };
  });

  // X-axis labels (show first, mid, last)
  const xIndices =
    data.length <= 5
      ? data.map((_, i) => i)
      : [0, Math.floor(data.length / 2), data.length - 1];

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ minWidth: 300 }}
      >
        {/* Grid lines */}
        {yTicks.map((t, i) => (
          <line
            key={i}
            x1={padding.left}
            x2={width - padding.right}
            y1={t.y}
            y2={t.y}
            className="stroke-card-border"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        ))}

        {/* Area */}
        <path d={areaD} fill="var(--primary)" opacity={0.1} />

        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots */}
        {data.map((d, i) => (
          <circle
            key={i}
            cx={xScale(i)}
            cy={yScale(d.weight)}
            r={4}
            fill="var(--primary)"
            stroke="var(--card-bg)"
            strokeWidth={2}
          />
        ))}

        {/* Y-axis labels */}
        {yTicks.map((t, i) => (
          <text
            key={i}
            x={padding.left - 8}
            y={t.y}
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-muted text-[11px]"
          >
            {t.val}
          </text>
        ))}

        {/* X-axis labels */}
        {xIndices.map((idx) => {
          const d = data[idx];
          const shortDate = new Date(d.date + "T00:00:00").toLocaleDateString(
            "es-ES",
            { day: "numeric", month: "short" }
          );
          return (
            <text
              key={idx}
              x={xScale(idx)}
              y={height - 8}
              textAnchor="middle"
              className="fill-muted text-[10px]"
            >
              {shortDate}
            </text>
          );
        })}

        {/* Axis labels */}
        <text
          x={8}
          y={padding.top + chartH / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          transform={`rotate(-90, 8, ${padding.top + chartH / 2})`}
          className="fill-muted text-[11px]"
        >
          kg
        </text>
      </svg>
    </div>
  );
}
