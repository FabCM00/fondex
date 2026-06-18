import { useCallback, useEffect, useState } from "react";

import { API, type Documento } from "./utils";

export interface UseDocumentos {
  docs: Documento[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  /** Recarga "silenciosa": no activa el estado `loading` (no desmonta la vista). */
  refresh: () => Promise<void>;
  remove: (doc: Documento) => Promise<void>;
}

/**
 * Maneja el ciclo de vida de los documentos de una cédula: carga inicial,
 * recarga y eliminación (con confirmación). Devuelve estado + acciones; el
 * componente solo se encarga de pintarlos.
 */
export function useDocumentos(cedula: string): UseDocumentos {
  const [docs, setDocs] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (silent: boolean) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API}?cedula=${encodeURIComponent(cedula)}`);
        const json = (await res.json()) as {
          ok?: boolean;
          message?: string;
          documentos?: Documento[];
        };
        if (!res.ok || !json.ok) {
          throw new Error(
            json.message ?? "No se pudieron cargar los documentos.",
          );
        }
        setDocs(json.documentos ?? []);
      } catch (e) {
        // En refresco silencioso no rompemos la vista con la pantalla de error:
        // la subida ya fue exitosa y el documento aparecerá en la próxima recarga.
        if (!silent) {
          setError(e instanceof Error ? e.message : "Error al cargar documentos.");
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [cedula],
  );

  const refetch = useCallback(() => load(false), [load]);
  const refresh = useCallback(() => load(true), [load]);

  useEffect(() => {
    load(false);
  }, [load]);

  // Elimina el documento y lo quita de la lista. Lanza el error para que la UI
  // (modal de confirmación + notificación) decida cómo mostrarlo.
  const remove = useCallback(
    async (doc: Documento) => {
      const res = await fetch(
        `${API}?cedula=${encodeURIComponent(cedula)}&id=${encodeURIComponent(doc.id)}`,
        { method: "DELETE" },
      );
      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.message ?? "No se pudo eliminar el documento.");
      }
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    },
    [cedula],
  );

  return { docs, loading, error, refetch, refresh, remove };
}
