// Estados derivados en frontend según las 10 reglas de negocio (orden de prioridad).
// Ver deriveEstado() en los endpoints de bandeja.
export type SolicitudEstado =
  | "valida_1"          // 1: motor1 === 1 && sin identity_results
  | "no_valida_1"       // 2: motor1 !== 1 && sin identity_results
  | "val_identidad"     // 3: identidad OK && sin motor_data
  | "no_val_identidad"  // 4: identidad rechazada && sin motor_data
  | "fallo_servicios"   // 5: motor_process.status !== "ok"
  | "no_viable"         // 6: motor2 === 2
  | "preaprobado"       // 7: motor2 === 1 && estado_143 === "E"
  | "aprobado"          // 8: motor2 === 1 && estado_143 === "A"
  | "contabilizado"     // 9: motor2 === 1 && estado_143 === "C"
  | "revision";         // 10: cualquier otro caso

export interface ValidacionItem {
  label: string;
  key: string;
  estado: 1 | 2 | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

export interface RawValida1Row {
  radicado: string;
  cedula: string;
  request_json:  Json;
  response_json: Json;
  created_at: string;
  updated_at: string;
  gestionado_at?: string | null;
  gestionado_by?: string | null;
  [key: string]: Json;
}

export interface RawMotorProcessRow {
  radicado: string;
  cedula: string;
  request_json:  Json;
  response_json: Json;
  [key: string]: Json;
}

export interface RawMotorDataRow {
  radicado: string;
  cedula: string;
  request_json:  Json;
  response_json: Json;
  [key: string]: Json;
}

export interface RawIdentityRow {
  radicado: string;
  cedula: string;
  request_json:  Json;
  response_json: Json;
  [key: string]: Json;
}

export interface RawEnvioThomasRow {
  radicado: string;
  cedula: string;
  request_json:  Json;
  response_json: Json;
  [key: string]: Json;
}

export interface RawWorkflowRow {
  radicado: string;
  cedula: string;
  request_json:  Json;
  response_json: Json;
  [key: string]: Json;
}

export interface RawCreditTrackingRow {
  radicado: string;
  cedula: string;
  nombreCliente?: string | null;
  emailCliente?: string | null;
  numeroFlujo?: number | null;
  estado135?: string | null;
  referencia?: string | null;
  numeroSolicitud?: string | null;
  estado143?: string | null;
  estadoAprobacion?: string | null;
  completado?: boolean | null;
  datos135?: Json;
  datos143?: Json;
  updatedAt?: string | null;
  [key: string]: Json;
}


export interface SolicitudUI {
  radicado: string;
  cedula: string;
  solicitante: string;
  fecha: string;
  valor: number;
  estado: SolicitudEstado;
  score: number | null;
  decisionTexto: string;
  sinMotor: boolean;
  gestionado: boolean;
  gestionadoAt: string | null;
  validaciones: ValidacionItem[];
  raw?: {
    valida1:          RawValida1Row;
    motor_process:    RawMotorProcessRow    | null;
    motor_data:       RawMotorDataRow       | null;
    identity:         RawIdentityRow        | null;
    envio_thomas:     RawEnvioThomasRow     | null;
    workflow:         RawWorkflowRow        | null;
    credit_tracking:  RawCreditTrackingRow  | null;
    credito_decision: null;
  };
}

/** SolicitudUI con detalle completo — raw siempre presente (endpoint /[radicado]) */
export type SolicitudDetail = SolicitudUI & {
  raw: NonNullable<SolicitudUI["raw"]>;
};
