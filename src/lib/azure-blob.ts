import { randomUUID } from "node:crypto";
import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";

const CONTAINER_NAME = "documentos";

const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 MB

/** Ciclo de validación del documento. Por defecto entra como "pendiente". */
export const DOCUMENT_STATUSES = ["pendiente", "revision", "validado"] as const;
export type DocumentoEstado = (typeof DOCUMENT_STATUSES)[number];

export const DEFAULT_CATEGORY = "Documentos generales";
const MAX_CATEGORY_LEN = 60;

const LEGACY_CATEGORY_LABELS: Record<string, string> = {
  vivienda: "Crédito Vivienda",
  vehiculo: "Crédito Vehículo",
  general: DEFAULT_CATEGORY,
};

function sanitizeCategory(value: string | null | undefined): string {
  const v = (value ?? "").trim().replace(/\s+/g, " ");
  return v ? v.slice(0, MAX_CATEGORY_LEN) : DEFAULT_CATEGORY;
}

function readCategory(meta: Record<string, string>): string {
  if (meta.categoryname) return decodeName(meta.categoryname, DEFAULT_CATEGORY);
  if (meta.category)
    return (
      LEGACY_CATEGORY_LABELS[meta.category] ?? sanitizeCategory(meta.category)
    );
  return DEFAULT_CATEGORY;
}

export function isValidStatus(value: string): value is DocumentoEstado {
  return DOCUMENT_STATUSES.includes(value as DocumentoEstado);
}

function normalizeStatus(value: string | null | undefined): DocumentoEstado {
  return isValidStatus(value ?? "") ? (value as DocumentoEstado) : "pendiente";
}

export interface DocumentoMeta {
  id: string;
  name: string;
  size: number;
  contentType: string;
  uploadedAt: string;
  category: string;
  status: DocumentoEstado;
}

const globalForBlob = globalThis as unknown as {
  blobContainer: ContainerClient | undefined;
};

function getContainerClient(): ContainerClient {
  if (globalForBlob.blobContainer) return globalForBlob.blobContainer;

  const accountName = process.env.AZURE_BLOB_ACCOUNT ?? "fondexblobstore";
  const accountUrl = `https://${accountName}.blob.core.windows.net`;
  const credential = new DefaultAzureCredential();

  const service = new BlobServiceClient(accountUrl, credential);
  const container = service.getContainerClient(CONTAINER_NAME);
  globalForBlob.blobContainer = container;
  return container;
}

export function sanitizeCedula(cedula: string): string {
  return cedula.replace(/[^0-9]/g, "");
}

function sanitizeFilename(name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return safe.slice(-120) || "archivo";
}

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
      category: readCategory(meta),
      status: normalizeStatus(meta.status),
    });
  }

  docs.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  return docs;
}

export async function uploadDocument(
  cedula: string,
  file: File,
  category: string,
): Promise<DocumentoMeta> {
  const safe = sanitizeCedula(cedula);
  if (!safe) throw new Error("Cédula inválida.");

  const container = getContainerClient();
  await container.createIfNotExists();

  const label = sanitizeCategory(category);
  const contentType = file.type || "application/octet-stream";
  const blobName = `${safe}/${randomUUID()}-${sanitizeFilename(file.name)}`;
  const blockBlob = container.getBlockBlobClient(blobName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await blockBlob.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: contentType },
    metadata: {
      originalname: encodeName(file.name),
      categoryname: encodeName(label),
      status: "pendiente",
    },
  });

  return {
    id: blobName,
    name: file.name,
    size: buffer.length,
    contentType,
    uploadedAt: new Date().toISOString(),
    category: label,
    status: "pendiente",
  };
}

export async function setDocumentStatus(
  cedula: string,
  id: string,
  status: DocumentoEstado,
): Promise<void> {
  const safe = sanitizeCedula(cedula);
  if (!safe) throw new Error("Cédula inválida.");
  if (!id.startsWith(`${safe}/`)) {
    throw new Error("El documento no pertenece a la cédula indicada.");
  }

  const container = getContainerClient();
  const blob = container.getBlockBlobClient(id);
  if (!(await blob.exists())) throw new Error("Documento no encontrado.");

  const props = await blob.getProperties();
  await blob.setMetadata({ ...(props.metadata ?? {}), status });
}

export async function deleteDocument(
  cedula: string,
  id: string,
): Promise<void> {
  const safe = sanitizeCedula(cedula);
  if (!safe) throw new Error("Cédula inválida.");
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
