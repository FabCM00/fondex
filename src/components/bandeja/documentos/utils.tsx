import Image from "next/image";
import {
  CheckCircle2,
  Clock3,
  Circle,
  Image as ImageIcon,
  type LucideIcon,
} from "lucide-react";

export const API = "/api/usuario/documentos";
export const VALID_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];
export const MAX_SIZE_MB = 10;

export const COMMUNICATIONS_URL =
  (process.env.NEXT_PUBLIC_URL_COMMUNICATIONS_APP ??
    "https://connect.truora.com") +
  "/#/engagement/?navbarTab=assigned&statusTab=open";

export type DocStatus = "pendiente" | "revision" | "validado";

export interface Documento {
  id: string;
  name: string;
  size: number;
  contentType: string;
  uploadedAt: string;
  /** Tipo de crédito (carpeta). Texto libre: etiqueta legible. */
  category: string;
  status: DocStatus;
}

// ─── Categorías (carpetas por tipo de crédito) ────────────────────────────────

export const DEFAULT_CATEGORY = "Documentos generales";

/** Opción especial del selector para escribir una categoría propia. */
export const CUSTOM_CATEGORY_ID = "otro";

/**
 * Opciones rápidas del selector de carga. `full` es la etiqueta que se guarda y
 * que titula la carpeta; `label` es el texto corto del botón.
 */
export interface CategoryPreset {
  id: string;
  label: string;
  full: string;
}

export const CATEGORY_PRESETS: CategoryPreset[] = [
  { id: "vivienda", label: "Vivienda", full: "Crédito Vivienda" },
  { id: "vehiculo", label: "Vehículo", full: "Crédito Vehículo" },
  { id: "general", label: "General", full: DEFAULT_CATEGORY },
];

/** Orden preferido de carpetas; las personalizadas van después (alfabéticas). */
export const CATEGORY_ORDER = CATEGORY_PRESETS.map((p) => p.full);

// ─── Estados de validación ────────────────────────────────────────────────────

export const STATUS_CONFIG: Record<
  DocStatus,
  { label: string; badge: string; dot: string; icon: LucideIcon }
> = {
  validado: {
    label: "Validado",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    icon: CheckCircle2,
  },
  revision: {
    label: "En revisión",
    badge: "bg-[#F29A2E]/10 text-[#b46f12] border-[#F29A2E]/30",
    dot: "bg-[#F29A2E]",
    icon: Clock3,
  },
  pendiente: {
    label: "Pendiente",
    badge: "bg-[#0D0D0D]/[0.04] text-[#0D0D0D]/55 border-[#0D0D0D]/12",
    dot: "bg-[#0D0D0D]/25",
    icon: Circle,
  },
};

/** Orden en que se ofrecen los estados en el menú contextual. */
export const STATUS_OPTIONS: DocStatus[] = ["pendiente", "revision", "validado"];

// ─── Helpers de presentación ──────────────────────────────────────────────────

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Etiqueta corta del tipo de archivo: "PDF", "JPG", "PNG"… */
export function fileExtLabel(contentType: string): string {
  if (contentType === "application/pdf") return "PDF";
  if (contentType === "image/png") return "PNG";
  if (contentType === "image/jpeg") return "JPG";
  return "Archivo";
}

/** Nombre legible: sin la extensión (el tipo ya se muestra en la metadata). */
export function displayName(name: string): string {
  return name.replace(/\.[a-zA-Z0-9]+$/, "");
}

/** Construye la URL del endpoint que sirve el archivo (ver inline / descargar). */
export function fileUrl(
  cedula: string,
  doc: Documento,
  mode: "view" | "download",
): string {
  return `${API}/download?cedula=${encodeURIComponent(cedula)}&id=${encodeURIComponent(doc.id)}&mode=${mode}`;
}

/** Miniatura del archivo: usa el ícono PDF para PDFs e ImageIcon para imágenes. */
export function FileThumb({ contentType }: { contentType: string }) {
  if (contentType === "application/pdf") {
    return (
      <Image
        src="/PDF_icon.svg.png"
        alt="PDF"
        width={24}
        height={29}
        className="h-6 w-auto select-none object-contain"
      />
    );
  }
  return <ImageIcon className="h-5 w-5 text-[#012340]" aria-hidden />;
}
