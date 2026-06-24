"use client";

import { AlertCircle, Upload, X } from "lucide-react";
import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNotification } from "@/contexts/NotificationContext";
import {
  CATEGORY_PRESETS,
  CUSTOM_CATEGORY_ID,
  FileThumb,
  MAX_SIZE_MB,
  formatFileSize,
} from "./utils";
import { useDocumentUpload } from "./useDocumentUpload";

interface UploadDocumentModalProps {
  cedula: string;
  /** Categoría preseleccionada (id de preset o "otro"). */
  initialCategory?: string;
  onClose: () => void;
  onUploaded: () => void;
}

export function UploadDocumentModal({
  cedula,
  initialCategory = "vivienda",
  onClose,
  onUploaded,
}: UploadDocumentModalProps) {
  const { notify } = useNotification();
  const { file, progress, status, error, start } = useDocumentUpload(
    cedula,
    onUploaded,
  );
  const [dragOver, setDragOver] = useState(false);
  const [presetId, setPresetId] = useState<string>(initialCategory);
  const [customText, setCustomText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isCustom = presetId === CUSTOM_CATEGORY_ID;
  // Etiqueta final que se guardará: el "full" del preset o el texto escrito.
  const effectiveCategory = isCustom
    ? customText.trim()
    : (CATEGORY_PRESETS.find((p) => p.id === presetId)?.full ?? "");
  const categoryReady = effectiveCategory.length > 0;

  const isEmpty = status === "idle" || status === "error";
  const uploading = status === "uploading";

  // Al completar: aviso de éxito + cerrar el modal.
  useEffect(() => {
    if (status === "done" && file) {
      notify({
        type: "success",
        message: (
          <>
            El documento <span className="font-semibold">{file.name}</span> se
            cargó correctamente.
          </>
        ),
      });
      onClose();
    }
  }, [status, file, notify, onClose]);

  // Cerrar con Escape (salvo mientras sube).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !uploading) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, uploading]);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (selected && categoryReady) start(selected, effectiveCategory);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragOver(false);
    const selected = event.dataTransfer.files?.[0];
    if (selected && categoryReady) start(selected, effectiveCategory);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && !uploading) onClose();
      }}
    >
      <div className="relative flex w-full max-w-md flex-col rounded-md border border-[#0D0D0D]/10 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#0D0D0D]/10 px-5 py-3.5">
          <h3 className="text-sm font-semibold text-[#012340]">
            Cargar documento
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            title="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-sm text-[#0D0D0D]/30 transition-colors hover:text-[#012340] disabled:opacity-40"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {isEmpty && (
            <>
              <div className="mb-4">
                <p className="mb-1.5 text-xs font-medium text-[#0D0D0D]/55">
                  Tipo de crédito
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {CATEGORY_PRESETS.map((opt) => {
                    const active = presetId === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPresetId(opt.id)}
                        className={cn(
                          "rounded-lg border px-2 py-2 text-xs font-semibold transition-colors",
                          active
                            ? "border-[#012340] bg-[#012340] text-white"
                            : "border-[#0D0D0D]/12 text-[#0D0D0D]/55 hover:border-[#012340]/40 hover:text-[#012340]",
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setPresetId(CUSTOM_CATEGORY_ID)}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-xs font-semibold transition-colors",
                      isCustom
                        ? "border-[#012340] bg-[#012340] text-white"
                        : "border-[#0D0D0D]/12 text-[#0D0D0D]/55 hover:border-[#012340]/40 hover:text-[#012340]",
                    )}
                  >
                    Otro
                  </button>
                </div>

                {isCustom && (
                  <input
                    type="text"
                    autoFocus
                    value={customText}
                    onChange={(event) => setCustomText(event.target.value)}
                    placeholder="Escribe el tipo de crédito"
                    maxLength={60}
                    className="mt-2 w-full rounded-lg border border-[#0D0D0D]/12 px-3 py-2 text-sm text-[#0D0D0D]/80 outline-none transition-colors placeholder:text-[#0D0D0D]/35 focus:border-[#012340]/40"
                  />
                )}
              </div>

              <label
                htmlFor="documento-upload"
                aria-disabled={!categoryReady}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-9 text-center transition-colors",
                  dragOver
                    ? "border-[#F29A2E] bg-[#F29A2E]/[0.06]"
                    : "border-[#0D0D0D]/15 hover:border-[#012340]/40 hover:bg-[#012340]/[0.02]",
                  !categoryReady && "pointer-events-none opacity-50",
                )}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#012340]/[0.06] text-[#012340]">
                  <Upload className="h-6 w-6" aria-hidden />
                </span>
                <p className="mt-3 text-sm text-[#0D0D0D]/70">
                  Arrastra y suelta o{" "}
                  <span className="font-semibold text-[#F29A2E] underline underline-offset-4">
                    elige un archivo
                  </span>
                </p>
                <p className="mt-1 text-xs text-[#0D0D0D]/40">
                  PDF, JPG o PNG · máx. {MAX_SIZE_MB} MB
                </p>
                <input
                  id="documento-upload"
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="sr-only"
                  disabled={!categoryReady}
                  onChange={handleInputChange}
                />
              </label>

              {isCustom && !categoryReady && (
                <p className="mt-2 text-xs text-[#0D0D0D]/45">
                  Escribe el tipo de crédito para poder cargar el archivo.
                </p>
              )}

              {error && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                  {error}
                </div>
              )}
            </>
          )}

          {/* Subiendo */}
          {uploading && file && (
            <div className="rounded-xl border border-[#0D0D0D]/10 bg-black/[0.02] p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-inset ring-[#0D0D0D]/10">
                  <FileThumb contentType={file.type} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#0D0D0D]/80">
                    {file.name}
                  </p>
                  <p className="text-xs text-[#0D0D0D]/50">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#012340]/10">
                  <div
                    className="h-full rounded-full bg-[#012340] transition-all duration-150"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums text-[#0D0D0D]/50">
                  {progress}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-[#0D0D0D]/10 px-5 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-[#0D0D0D]/60 hover:text-[#0D0D0D]/80"
            disabled={uploading}
            onClick={onClose}
          >
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
