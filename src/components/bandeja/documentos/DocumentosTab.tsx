"use client";

import Image from "next/image";
import { AlertCircle } from "lucide-react";
import { useCallback, useState } from "react";

import { LoadingScreen } from "@/components/LoadingScreen";
import { useNotification } from "@/contexts/NotificationContext";
import { Button } from "@/components/ui/button";
import { DocumentList } from "./DocumentList";
import { UploadDocumentModal } from "./UploadDocumentModal";
import { useDocumentos } from "./useDocumentos";
import { COMMUNICATIONS_URL, type Documento } from "./utils";

export function DocumentosTab({ cedula }: { cedula: string }) {
  const { docs, loading, error, refetch, refresh, remove } =
    useDocumentos(cedula);
  const { confirm, notify } = useNotification();
  const [modalOpen, setModalOpen] = useState(false);

  const openModal = useCallback(() => setModalOpen(true), []);
  const closeModal = useCallback(() => setModalOpen(false), []);

  const handleDelete = useCallback(
    async (doc: Documento) => {
      const ok = await confirm({
        type: "warning",
        title: "Eliminar documento",
        message: (
          <>
            ¿Eliminar <span className="font-semibold">{doc.name}</span>? Esta
            acción no se puede deshacer.
          </>
        ),
        confirmLabel: "Eliminar",
        confirmTone: "danger",
      });
      if (!ok) return;
      try {
        await remove(doc);
        notify({
          type: "success",
          message: "El documento se eliminó correctamente.",
        });
      } catch (e) {
        notify({
          type: "error",
          message:
            e instanceof Error ? e.message : "No se pudo eliminar el documento.",
        });
      }
    },
    [confirm, notify, remove],
  );

  if (loading) {
    return <LoadingScreen message="Cargando documentoS" fullScreen={false} />;
  }

  if (error) {
    return (
      <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 px-8 text-center">
        <AlertCircle className="h-7 w-7 text-red-500" aria-hidden />
        <p className="max-w-[360px] text-sm text-[#0D0D0D]/55">{error}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-[#012340]/20 text-[#012340] hover:bg-[#012340]/5"
          onClick={refetch}
        >
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <>
      {docs.length === 0 ? (
        <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-7 px-8 py-10">
          <Image
            src="/documentos.png"
            alt="Sin documentos"
            width={220}
            height={220}
            className="pointer-events-none select-none"
            priority
          />
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-xl font-normal tracking-tight text-[#0D0D0D]/80">
              No hay documentos disponibles
            </p>
            <p className="max-w-[380px] text-sm leading-relaxed text-[#0D0D0D]/50">
              Aún no se han adjuntado documentos para esta solicitud. Puedes
              solicitarlos{" "}
              <a
                href={COMMUNICATIONS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                comunicándote con el cliente
              </a>{" "}
              o, si ya lo tienes,{" "}
              <button
                type="button"
                onClick={openModal}
                className="font-medium text-[#012340] underline underline-offset-2 transition-colors hover:text-[#012340]/75"
              >
                cárgalo aquí
              </button>
              .
            </p>
          </div>
        </div>
      ) : (
        <DocumentList
          cedula={cedula}
          docs={docs}
          onDelete={handleDelete}
          onUpload={openModal}
        />
      )}

      {modalOpen && (
        <UploadDocumentModal
          cedula={cedula}
          onClose={closeModal}
          onUploaded={refresh}
        />
      )}
    </>
  );
}
