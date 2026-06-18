"use client";

import { Download, Eye, Plus, Trash2 } from "lucide-react";
import { memo } from "react";

import { Button } from "@/components/ui/button";
import {
  FileTypeIcon,
  fileUrl,
  formatDate,
  formatFileSize,
  type Documento,
} from "./utils";

interface DocumentRowProps {
  cedula: string;
  doc: Documento;
  onDelete: (doc: Documento) => void;
}

// Memoizado: solo se re-renderiza si cambian sus props (útil si la lista crece).
const DocumentRow = memo(function DocumentRow({
  cedula,
  doc,
  onDelete,
}: DocumentRowProps) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-[#0D0D0D]/10 bg-white px-4 py-3 transition-colors hover:border-[#012340]/30">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#012340]/[0.04] ring-1 ring-inset ring-[#0D0D0D]/10">
        <FileTypeIcon contentType={doc.contentType} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[#0D0D0D]/80">
          {doc.name}
        </p>
        <p className="text-xs text-[#0D0D0D]/45">
          {formatFileSize(doc.size)} · {formatDate(doc.uploadedAt)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <a
          href={fileUrl(cedula, doc, "view")}
          target="_blank"
          rel="noopener noreferrer"
          title="Ver"
          className="flex h-8 w-8 items-center justify-center rounded-md text-[#0D0D0D]/50 transition-colors hover:bg-[#012340]/5 hover:text-[#012340]"
        >
          <Eye className="h-4 w-4" aria-hidden />
        </a>
        <a
          href={fileUrl(cedula, doc, "download")}
          title="Descargar"
          className="flex h-8 w-8 items-center justify-center rounded-md text-[#0D0D0D]/50 transition-colors hover:bg-[#012340]/5 hover:text-[#012340]"
        >
          <Download className="h-4 w-4" aria-hidden />
        </a>
        <button
          type="button"
          title="Eliminar"
          onClick={() => onDelete(doc)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-[#0D0D0D]/50 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </li>
  );
});

interface DocumentListProps {
  cedula: string;
  docs: Documento[];
  onDelete: (doc: Documento) => void;
  onUpload: () => void;
}

export function DocumentList({
  cedula,
  docs,
  onDelete,
  onUpload,
}: DocumentListProps) {
  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col px-6 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#012340]">
            Documentos
            <span className="ml-1.5 text-[#0D0D0D]/40">({docs.length})</span>
          </h3>
          <p className="mt-0.5 text-xs text-[#0D0D0D]/45">
            Adjuntos de la cédula {cedula}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="bg-[#012340] text-white hover:bg-[#012340]/85"
          onClick={onUpload}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Subir documento
        </Button>
      </div>

      <ul className="flex flex-col gap-2">
        {docs.map((doc) => (
          <DocumentRow
            key={doc.id}
            cedula={cedula}
            doc={doc}
            onDelete={onDelete}
          />
        ))}
      </ul>
    </div>
  );
}
