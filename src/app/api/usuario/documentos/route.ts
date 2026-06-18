import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import {
  deleteDocument,
  isAllowedContentType,
  listDocuments,
  MAX_DOCUMENT_BYTES,
  sanitizeCedula,
  uploadDocument,
} from "@/lib/azure-blob";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }

  const cedula = req.nextUrl.searchParams.get("cedula") ?? "";
  if (!sanitizeCedula(cedula)) {
    return NextResponse.json({ ok: false, message: "Cédula requerida." }, { status: 400 });
  }

  try {
    const documentos = await listDocuments(cedula);
    return NextResponse.json({ ok: true, documentos });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error interno.";
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }

  const cedula = req.nextUrl.searchParams.get("cedula") ?? "";
  if (!sanitizeCedula(cedula)) {
    return NextResponse.json({ ok: false, message: "Cédula requerida." }, { status: 400 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, message: "Archivo requerido." }, { status: 400 });
    }
    if (!isAllowedContentType(file.type)) {
      return NextResponse.json(
        { ok: false, message: "Formato no válido. Solo PDF, JPG o PNG." },
        { status: 415 },
      );
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      return NextResponse.json(
        { ok: false, message: "El archivo supera el límite de 10 MB." },
        { status: 413 },
      );
    }

    const documento = await uploadDocument(cedula, file);
    return NextResponse.json({ ok: true, documento }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error interno.";
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }

  const cedula = req.nextUrl.searchParams.get("cedula") ?? "";
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!sanitizeCedula(cedula) || !id) {
    return NextResponse.json({ ok: false, message: "Parámetros requeridos." }, { status: 400 });
  }

  try {
    await deleteDocument(cedula, id);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error interno.";
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
