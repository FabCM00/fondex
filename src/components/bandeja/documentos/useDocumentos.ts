import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { API, type DocStatus, type Documento } from "./utils";

export interface UseDocumentos {
  docs: Documento[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** Recarga "silenciosa": no activa el estado `loading` (no desmonta la vista). */
  refresh: () => Promise<void>;
  remove: (doc: Documento) => Promise<void>;
  updateStatus: (doc: Documento, status: DocStatus) => Promise<void>;
}

async function fetchDocumentos(cedula: string): Promise<Documento[]> {
  const res = await fetch(`${API}?cedula=${encodeURIComponent(cedula)}`);
  const json = (await res.json()) as {
    ok?: boolean;
    message?: string;
    documentos?: Documento[];
  };
  if (!res.ok || !json.ok) {
    throw new Error(json.message ?? "No se pudieron cargar los documentos.");
  }
  return json.documentos ?? [];
}

export function useDocumentos(cedula: string): UseDocumentos {
  const qc = useQueryClient();
  const key = ["documentos", cedula] as const;

  const {
    data: docs = [],
    isLoading: loading,
    error: queryError,
    refetch: tqRefetch,
  } = useQuery({
    queryKey: key,
    queryFn: () => fetchDocumentos(cedula),
  });

  const removeMutation = useMutation({
    mutationFn: async (doc: Documento) => {
      const res = await fetch(
        `${API}?cedula=${encodeURIComponent(cedula)}&id=${encodeURIComponent(doc.id)}`,
        { method: "DELETE" },
      );
      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.message ?? "No se pudo eliminar el documento.");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      doc,
      status,
    }: {
      doc: Documento;
      status: DocStatus;
    }) => {
      const res = await fetch(
        `${API}?cedula=${encodeURIComponent(cedula)}&id=${encodeURIComponent(doc.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.message ?? "No se pudo actualizar el estado.");
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const refetch = async () => {
    await tqRefetch();
  };

  return {
    docs,
    loading,
    error: queryError instanceof Error ? queryError.message : null,
    refetch,
    refresh: refetch,
    remove: (doc) => removeMutation.mutateAsync(doc),
    updateStatus: (doc, status) =>
      updateStatusMutation.mutateAsync({ doc, status }),
  };
}
