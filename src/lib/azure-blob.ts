import { randomUUID } from "node:crypto";
import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";

const CONTAINER_NAME = "documentos";

const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 MB

export interface DocumentoMeta {
  /** Nombre del blob, incluye el prefijo de la cédula (p.ej. "123/uuid-archivo.pdf"). */
  id: string;
  /** Nombre original del archivo subido por el usuario. */
  name: string;
  size: number;
  contentType: string;
  /** ISO 8601. */
  uploadedAt: string;
}

// Singleton: evita múltiples clientes con el Hot Reload de Next.js.
const globalForBlob = globalThis as unknown as {
  blobContainer: ContainerClient | undefined;
};

function getContainerClient(): ContainerClient {
  if (globalForBlob.blobContainer) return globalForBlob.blobContainer;

  const connectionString = process.env.AZURE_BLOB_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error("AZURE_BLOB_CONNECTION_STRING no está configurada.");
  }

  const service = BlobServiceClient.fromConnectionString(connectionString);
  const container = service.getContainerClient(CONTAINER_NAME);
  globalForBlob.blobContainer = container;
  return container;
}

/** La cédula solo debe contener dígitos: evita inyección de path en el prefijo del blob. */
export function sanitizeCedula(cedula: string): string {
  return cedula.replace(/[^0-9]/g, "");
}

function sanitizeFilename(name: string): string {
  // Conserva extensión y caracteres seguros; recorta a 120 chars.
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return safe.slice(-120) || "archivo";
}

// La metadata de Azure solo admite ASCII; el nombre original puede traer acentos/espacios.
function encodeName(name: string): string {
  return Buffer.from(name, "utf-8").toString("base64");
}
function decodeName(encoded: string | undefined, fallback: string): string {
  if (!encoded) return fallback;
  try {
    return Buffer.from(encoded, "base64").toString("utf-8");
  } catch {
    return fallback;
  }
}

export function isAllowedContentType(type: string): boolean {
  return ALLOWED_CONTENT_TYPES.has(type);
}

export async function listDocuments(cedula: string): Promise<DocumentoMeta[]> {
  const safe = sanitizeCedula(cedula);
  if (!safe) return [];

  const container = getContainerClient();
  await container.createIfNotExists();

  const prefix = `${safe}/`;
  const docs: DocumentoMeta[] = [];
  for await (const blob of container.listBlobsFlat({
    prefix,
    includeMetadata: true,
  })) {
    const meta = blob.metadata ?? {};
    const uploaded =
      blob.properties.createdOn ?? blob.properties.lastModified ?? new Date(0);
    docs.push({
      id: blob.name,
      name: decodeName(meta.originalname, blob.name.slice(prefix.length)),
      size: blob.properties.contentLength ?? 0,
      contentType: blob.properties.contentType ?? "application/octet-stream",
      uploadedAt: uploaded.toISOString(),
    });
  }

  docs.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  return docs;
}

export async function uploadDocument(
  cedula: string,
  file: File,
): Promise<DocumentoMeta> {
  const safe = sanitizeCedula(cedula);
  if (!safe) throw new Error("Cédula inválida.");

  const container = getContainerClient();
  await container.createIfNotExists();

  const contentType = file.type || "application/octet-stream";
  const blobName = `${safe}/${randomUUID()}-${sanitizeFilename(file.name)}`;
  const blockBlob = container.getBlockBlobClient(blobName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await blockBlob.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: contentType },
    metadata: { originalname: encodeName(file.name) },
  });

  return {
    id: blobName,
    name: file.name,
    size: buffer.length,
    contentType,
    uploadedAt: new Date().toISOString(),
  };
}

export async function deleteDocument(cedula: string, id: string): Promise<void> {
  const safe = sanitizeCedula(cedula);
  if (!safe) throw new Error("Cédula inválida.");
  // Seguridad: el blob debe pertenecer al prefijo de esta cédula.
  if (!id.startsWith(`${safe}/`)) {
    throw new Error("El documento no pertenece a la cédula indicada.");
  }
  const container = getContainerClient();
  await container.getBlockBlobClient(id).deleteIfExists();
}

export interface DocumentoBuffer {
  buffer: Buffer;
  contentType: string;
  name: string;
}

export async function getDocumentBuffer(
  cedula: string,
  id: string,
): Promise<DocumentoBuffer | null> {
  const safe = sanitizeCedula(cedula);
  if (!safe) return null;
  if (!id.startsWith(`${safe}/`)) return null;

  const container = getContainerClient();
  const blob = container.getBlockBlobClient(id);
  if (!(await blob.exists())) return null;

  const props = await blob.getProperties();
  const buffer = await blob.downloadToBuffer();
  const name = decodeName(
    props.metadata?.originalname,
    id.split("/").pop() ?? "documento",
  );

  return {
    buffer,
    contentType: props.contentType ?? "application/octet-stream",
    name,
  };
}
