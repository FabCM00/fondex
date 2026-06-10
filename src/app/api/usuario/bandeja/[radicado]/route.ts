import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../../auth";
import { prisma } from "@/lib/prisma";

function serializeDbRow(val: unknown): unknown {
  if (val === null || val === undefined) return null;
  if (typeof val === "bigint") return Number(val);
  if (val instanceof Date) return val.toISOString();
  if (Array.isArray(val)) return val.map(serializeDbRow);
  if (typeof val === "object") {
    const copy: Record<string, unknown> = {};
    for (const key in val as object) copy[key] = serializeDbRow((val as Record<string, unknown>)[key]);
    return copy;
  }
  return val;
}

// estado_143 == "C" (contabilizado) → la solicitud debe pasar a gestionada
function esContabilizado(estado143: string | null | undefined): boolean {
  return (estado143 ?? "").trim().toUpperCase() === "C";
}

function parseFecha(radicado: string, fallback: string): string {
  const ts = radicado.split("_")[1] ?? "";
  if (ts.length >= 6 && !isNaN(Number(ts.slice(0, 6)))) {
    return `20${ts.slice(4, 6)}-${ts.slice(2, 4)}-${ts.slice(0, 2)}`;
  }
  return fallback.slice(0, 10);
}

function buildSolicitante(v1Resp: Record<string, unknown>, mdResp: Record<string, unknown>): string {
  const asociadoMd = (mdResp?.datos_asociado ?? {}) as Record<string, unknown>;
  const asociadoV1 = (v1Resp?.datos_asociado ?? {}) as Record<string, unknown>;
  const nombre =
    (asociadoMd?.deudor as string) ||
    (asociadoV1?.nombre_completo as string) ||
    "";
  return nombre.trim() || "—";
}

function extractMonto(mdResp: Record<string, unknown>, motorResp: Record<string, unknown>): number {
  const oferta = (motorResp?.oferta ?? {}) as Record<string, unknown>;
  if (typeof oferta?.monto === "number" && Number.isFinite(oferta.monto)) return oferta.monto as number;
  const asociado = (mdResp?.datos_asociado ?? {}) as Record<string, unknown>;
  if (typeof asociado?.salarioBase === "number") return asociado.salarioBase as number;
  return 0;
}

// motor2 puede venir numérico (1=viable, 2=no viable) o texto legado ("Viable"/"No Viable").
// Normaliza a 1 | 2 | null.
function normMotor2(rawMotor2: unknown): 1 | 2 | null {
  if (rawMotor2 === 1) return 1;
  if (rawMotor2 === 2) return 2;
  const txt = String(rawMotor2 ?? "").toUpperCase().replace(/\s+/g, "").trim();
  if (txt === "VIABLE") return 1;
  if (txt === "NOVIABLE") return 2;
  return null;
}

// Estado de la solicitud según las 10 reglas de negocio (orden de prioridad).
// Se evalúa la primera regla que se cumpla; el resultado es solo de frontend.
//   identityResp / motorDataExists indican la existencia de las filas relacionadas
//   (equivalen a `identity_results.radicado === null` / `motor_data.radicado === null`).
function deriveEstado(
  v1Resp: Record<string, unknown>,
  motorResp: Record<string, unknown> | null,
  identityResp: Record<string, unknown> | null,
  motorDataExists: boolean,
  estado143: string | null | undefined,
): string {
  const motor1 = v1Resp?.motor1;
  const hayIdentity = identityResp !== null;

  // ── Reglas 1-2: antes de validación de identidad ──
  if (!hayIdentity) {
    return motor1 === 1 ? "valida_1" : "no_valida_1";
  }

  // ── Reglas 3-4: validación de identidad, antes de motor_data ──
  if (!motorDataExists) {
    const statusFace = identityResp?.status_face;
    const statusDoc = identityResp?.status_document;
    const tipo = identityResp?.tipo_validacion;

    // 3: Val Identidad
    if (
      statusFace === 1 &&
      ((tipo === 1 && statusDoc === 1) || tipo === 2)
    ) {
      return "val_identidad";
    }
    // 4: No Val Identidad
    if (statusDoc === 2 || statusFace === 2) {
      return "no_val_identidad";
    }
  }

  // ── Reglas 5-9: flujo post-motor ──
  const status = String(motorResp?.status ?? "").trim().toLowerCase();
  // 5: Fallo en servicios — motor_process existe pero status !== "ok"
  if (motorResp !== null && status !== "ok") return "fallo_servicios";

  const motor2 = normMotor2(motorResp?.motor2);
  // 6: No viable
  if (motor2 === 2) return "no_viable";

  // 7-9: motor2 viable + estado del crédito (estado_143)
  if (motor2 === 1) {
    const tracking = (estado143 ?? "").trim().toUpperCase();
    if (tracking === "E") return "preaprobado";
    if (tracking === "A") return "aprobado";
    if (tracking === "C") return "contabilizado";
  }

  // 10: Revisión — fallback
  return "revision";
}

function extractScore(mdResp: Record<string, unknown>): number | null {
  if (!mdResp) return null;
  const detallado = (mdResp?.detallado ?? {}) as Record<string, unknown>;
  const asociado  = (mdResp?.datos_asociado ?? {}) as Record<string, unknown>;
  const score = detallado?.tu_score ?? asociado?.scoreTU;
  return typeof score === "number" ? score : null;
}

function decisionTexto(v1Resp: Record<string, unknown>, motorResp: Record<string, unknown>): string {
  const rawMotor2 = motorResp?.motor2;
  if (rawMotor2 === 1) return "Viable";
  if (rawMotor2 === 2) return "No viable";
  if (typeof rawMotor2 === "string" && rawMotor2.trim()) return rawMotor2;
  const status = motorResp?.status as string | undefined;
  if (status) return status;
  const motor1 = v1Resp?.motor1;
  if (motor1 === 1) return "Pendiente de motor";
  if (motor1 === 2) return (v1Resp?.mensaje as string) ?? "No apto en validación inicial";
  return "Pendiente de validación";
}

function norm(v: unknown): 1 | 2 | null {
  if (v === 1) return 1;
  if (v === 2) return 2;
  return null;
}

function normBool(v: unknown): 1 | 2 | null {
  if (v === 1) return 1;
  if (v === 0) return 2;
  return null;
}

function buildValidaciones(v1Resp: Record<string, unknown>, motorResp: Record<string, unknown>) {
  const items = [
    { label: "Resultado Validación 1",    key: "motor1",               estado: norm(v1Resp?.motor1) },
    { label: "Validación Identidad (ID)", key: "valida_id",            estado: norm(v1Resp?.valida_id) },
    { label: "Validación Email",          key: "valida_email",         estado: norm(v1Resp?.valida_email) },
    { label: "Validación Celular",        key: "valida_celular",       estado: norm(v1Resp?.valida_celular) },
    { label: "Validación Apellido",       key: "valida_last_name",     estado: norm(v1Resp?.valida_last_name) },
    { label: "Validación Capacidad",      key: "valida_capacidad",     estado: norm(v1Resp?.valida_capacidad) },
    { label: "Validación Estado Laboral", key: "valida_estado_laboral",estado: norm(v1Resp?.valida_estado_laboral) },
  ];

  const proc = (motorResp?.processing ?? {}) as Record<string, unknown>;
  if (Object.keys(proc).length) {
    items.push(
      { label: "Viabilidad crediticia", key: "viabilidadDef", estado: normBool(proc?.viabilidadDef) },
      { label: "Viabilidad criterio 1", key: "viabilidad1",   estado: normBool(proc?.viabilidad1) },
    );
  }

  return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET — detalle completo de una solicitud
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ radicado: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }

  const { radicado } = await params;

  try {
    const v1 = await prisma.valida1Results.findUnique({
      where: { radicado },
      include: {
        motorProcess:   true,
        motorData:      true,
        identity:       true,
        envioThomas:    true,
        workflow:       true,
        creditTracking: true,
      },
    });

    if (!v1) {
      return NextResponse.json({ ok: false, message: "Solicitud no encontrada." }, { status: 404 });
    }

    // Auto-gestionado: estado_143 == "C" (contabilizado) marca la solicitud
    // como gestionada por el sistema, una sola vez, si aún no lo estaba.
    let gestionadoAt = v1.gestionadoAt;
    let gestionadoBy = v1.gestionadoBy;
    if (!gestionadoAt && esContabilizado(v1.creditTracking?.estado143)) {
      gestionadoAt = new Date();
      gestionadoBy = "sistema";
      await prisma.valida1Results.update({
        where: { radicado: v1.radicado },
        data:  { gestionadoAt, gestionadoBy },
      });
    }

    const motor = v1.motorProcess ?? null;
    const md    = v1.motorData    ?? null;
    const iv    = v1.identity     ?? null;
    const et    = v1.envioThomas  ?? null;
    const wf    = v1.workflow      ?? null;

    const v1Resp    = (v1.responseJson    ?? {}) as Record<string, unknown>;
    const motorResp = motor ? ((motor.responseJson ?? {}) as Record<string, unknown>) : null;
    const mdResp    = (md?.responseJson    ?? {}) as Record<string, unknown>;
    const ivResp    = iv ? ((iv.responseJson ?? {}) as Record<string, unknown>) : null;

    const data = {
      radicado:      v1.radicado,
      cedula:        v1.cedula,
      solicitante:   buildSolicitante(v1Resp, mdResp),
      fecha:         parseFecha(v1.radicado, v1.createdAt.toISOString()),
      valor:         extractMonto(mdResp, motorResp ?? {}),
      estado:        deriveEstado(v1Resp, motorResp, ivResp, md !== null, v1.creditTracking?.estado143),
      score:         extractScore(mdResp),
      decisionTexto: decisionTexto(v1Resp, motorResp ?? {}),
      sinMotor:      !motor,
      gestionado:    !!gestionadoAt,
      gestionadoAt:  gestionadoAt?.toISOString() ?? null,
      validaciones:  buildValidaciones(v1Resp, motorResp ?? {}),
      raw: {
        valida1: {
          id:            Number(v1.id),
          radicado:      v1.radicado,
          cedula:        v1.cedula,
          request_json:  v1.requestJson  ?? null,
          response_json: v1.responseJson ?? null,
          created_at:    v1.createdAt.toISOString(),
          updated_at:    v1.updatedAt.toISOString(),
          gestionado_at: gestionadoAt?.toISOString() ?? null,
          gestionado_by: gestionadoBy ?? null,
        },
        motor_process: motor ? {
          id:            Number(motor.id),
          radicado:      motor.radicado,
          cedula:        motor.cedula,
          request_json:  motor.requestJson  ?? null,
          response_json: motor.responseJson ?? null,
          created_at:    motor.createdAt.toISOString(),
          updated_at:    motor.updatedAt.toISOString(),
        } : null,
        motor_data: md ? {
          id:            Number(md.id),
          radicado:      md.radicado,
          cedula:        md.cedula,
          request_json:  md.requestJson  ?? null,
          response_json: md.responseJson ?? null,
          created_at:    md.createdAt.toISOString(),
          updated_at:    md.updatedAt.toISOString(),
        } : null,
        identity: iv ? {
          id:            Number(iv.id),
          radicado:      iv.radicado,
          cedula:        iv.cedula,
          request_json:  iv.requestJson  ?? null,
          response_json: iv.responseJson ?? null,
          created_at:    iv.createdAt.toISOString(),
          updated_at:    iv.updatedAt.toISOString(),
        } : null,
        envio_thomas: et ? {
          id:            Number(et.id),
          radicado:      et.radicado,
          cedula:        et.cedula,
          request_json:  et.requestJson  ?? null,
          response_json: et.responseJson ?? null,
          created_at:    et.createdAt.toISOString(),
          updated_at:    et.updatedAt.toISOString(),
        } : null,
        workflow: wf ? {
          id:            Number(wf.id),
          radicado:      wf.radicado,
          cedula:        wf.cedula,
          request_json:  wf.requestJson  ?? null,
          response_json: wf.responseJson ?? null,
          created_at:    wf.createdAt.toISOString(),
          updated_at:    wf.updatedAt.toISOString(),
        } : null,
        credit_tracking: v1.creditTracking
          ? (serializeDbRow(v1.creditTracking) as Record<string, unknown>)
          : null,
        credito_decision: null,
      },
    };

    return NextResponse.json({ ok: true, data });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error interno.";
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
