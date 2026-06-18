import { FileText, Image as ImageIcon } from "lucide-react";

export const API = "/api/usuario/documentos";
export const VALID_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];
export const MAX_SIZE_MB = 10;

export const COMMUNICATIONS_URL =
  (process.env.NEXT_PUBLIC_URL_COMMUNICATIONS_APP ??
    "https://connect.truora.com") +
  "/#/engagement/?navbarTab=assigned&statusTab=open";

export interface Documento {
  id: string;
  name: string;
  size: number;
  contentType: string;
  uploadedAt: string;
}

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

/** Construye la URL del endpoint que sirve el archivo (ver inline / descargar). */
export function fileUrl(
  cedula: string,
  doc: Documento,
  mode: "view" | "download",
): string {
  return `${API}/download?cedula=${encodeURIComponent(cedula)}&id=${encodeURIComponent(doc.id)}&mode=${mode}`;
}

export function FileTypeIcon({ contentType }: { contentType: string }) {
  return contentType.startsWith("image/") ? (
    <ImageIcon className="h-5 w-5 text-[#012340]" aria-hidden />
  ) : (
    <FileText className="h-5 w-5 text-[#012340]" aria-hidden />
  );
}
