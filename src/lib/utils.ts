// Role helpers
export function isStaff(role?: string): boolean {
  return role === 'trainer' || role === 'owner';
}

export function isOwner(role?: string): boolean {
  return role === 'owner';
}

// Initials
export function getInitials(name?: string | null): string {
  if (!name) return '??';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// Date formatting
export function formatDateES(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  });
}

export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return formatDateShort(dateStr);
}

// YouTube
export function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return match ? match[1] : null;
}

// Volume formatting
export function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${Math.round(kg)} kg`;
}

// File validation
export function validateImageFile(file: File, maxSizeMB: number = 5): string | null {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) return 'Solo se permiten imágenes (JPG, PNG, WebP, GIF).';
  if (file.size > maxSizeMB * 1024 * 1024) return `La imagen no puede superar los ${maxSizeMB}MB.`;
  return null;
}
