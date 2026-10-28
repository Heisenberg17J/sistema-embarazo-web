/** Tipos de la API (`backend/src`). Reflejan lo que devuelve cada endpoint. */

export type Rol = "GESTANTE" | "PROFESIONAL" | "ADMINISTRADOR";
export type Severidad = "INFORMATIVA" | "ADVERTENCIA" | "CRITICA";
/** ANULADA: el dato que la originó se corrigió o se eliminó. Se conserva, no se borra. */
export type EstadoAlerta = "PENDIENTE" | "REVISADA" | "DESCARTADA" | "ANULADA";
export type EstadoEmbarazo = "ACTIVO" | "FINALIZADO" | "CANCELADO";
export type EstadoCita =
    | "PROGRAMADA"
    | "REPROGRAMADA"
    | "CUMPLIDA"
    | "CANCELADA"
    | "NO_ASISTIO";
export type OrigenMedicion = "GESTANTE" | "PROFESIONAL";

export interface PerfilGestante {
    tipo_documento: string;
    numero_documento: string;
    fecha_nacimiento: string;
    telefono: string | null;
    direccion: string | null;
    eps: string | null;
    grupo_sanguineo: string | null;
    contacto_emergencia_nombre: string | null;
    contacto_emergencia_telefono: string | null;
}

export interface PerfilProfesional {
    registro_profesional: string;
    especialidad: string;
    institucion: string | null;
    telefono: string | null;
}

export interface Usuario {
    id: number;
    rol: Rol;
    nombre: string;
    apellido: string;
    correo: string;
    activo: boolean;
    debe_cambiar_contrasena: boolean;
    ultimo_acceso: string | null;
    creado_en: string;
    perfil?: PerfilGestante | PerfilProfesional | null;
}

export interface Embarazo {
    embarazo_id: number;
    gestante_usuario_id: number;
    gestante: string;
    fecha_inicio: string;
    fecha_estimada_parto: string;
    estado: EstadoEmbarazo;
    semana_actual: number | null;
    edad_gestacional: string | null;
    trimestre: number | null;
    dias_para_parto: number | null;
    talla_cm: number | null;
    peso_pregestacional_kg: number | null;
    fecha_finalizacion: string | null;
    observaciones: string | null;
    ultimo_peso_kg: number | null;
    peso: {
        imc_pregestacional: number;
        categoria_imc: string;
        ganancia_recomendada_kg: { min: number; max: number };
        ganancia_actual_kg: number | null;
        nota: string;
    } | null;
}

export interface Alerta {
    id: number;
    embarazo_id: number;
    gestante_usuario_id?: number;
    gestante?: string;
    severidad: Severidad;
    mensaje: string;
    valor_detectado: number | null;
    tipo_medicion?: string | null;
    unidad?: string | null;
    tipo_sintoma?: string | null;
    regla?: string | null;
    estado: EstadoAlerta;
    generada_en: string;
    revisada_por: number | null;
    revisor?: string | null;
    fecha_revision: string | null;
    observacion_revision: string | null;
    accion_inmediata: boolean;
    anulada_en?: string | null;
    motivo_anulacion?: string | null;
    aviso?: string;
}

export interface Cita {
    id: number;
    embarazo_id: number;
    fecha: string;
    hora: string;
    duracion_min: number;
    estado: EstadoCita;
    motivo_cancelacion: string | null;
    tipo_control: string;
    tipo_control_nombre: string;
    profesional_usuario_id: number;
    profesional: string;
    gestante_usuario_id: number;
    gestante: string;
}

export interface Medicion {
    id: number;
    tipo: string;
    nombre: string;
    unidad: string;
    valor: number;
    fecha_registro: string;
    semana_gestacion: number | null;
    origen: OrigenMedicion;
    control_id: number | null;
    observaciones: string | null;    /** El servidor lo decide: quién lo registró y si sigue abierta la ventana para corregirlo. */
    editable?: boolean;
}

export interface SerieMediciones {
    embarazo_id: number;
    fecha_inicio: string;
    series: {
        tipo: string;
        nombre: string;
        unidad: string;
        puntos: {
            fecha: string;
            semana: number | null;
            valor: number;
            origen: OrigenMedicion;
        }[];
        referencias: {
            codigo: string;
            operador: string;
            valor_referencia: number | null;
            valor_min: number | null;
            valor_max: number | null;
            severidad: Severidad;
        }[];
    }[];
}

export interface Sintoma {
    id: number;
    embarazo_id: number;
    tipo: string | null;
    tipo_nombre?: string | null;
    es_signo_alarma?: boolean;
    descripcion: string;
    intensidad: number | null;
    fecha: string;
    semana_gestacion: number | null;
    observaciones: string | null;
    registrado_en: string;
    alerta_id?: number | null;
    alerta_severidad?: Severidad | null;
    alerta_estado?: EstadoAlerta | null;
    alerta?: Alerta | null;    /** El servidor lo decide: quién lo registró y si sigue abierta la ventana para corregirlo. */
    editable?: boolean;
}

export interface Examen {
    id: number;
    embarazo_id: number;
    tipo: string;
    tipo_nombre: string;
    fecha: string;
    resultado: string;
    observaciones: string | null;
    registrado_en: string;
    profesional: string;    /** El servidor lo decide: quién lo registró y si sigue abierta la ventana para corregirlo. */
    editable?: boolean;
}

export interface Control {
    id: number;
    embarazo_id: number;
    cita_id: number | null;
    fecha: string;
    semana_gestacion: number;
    observaciones: string | null;
    creado_en: string;
    profesional: string;
    mediciones: { tipo: string; nombre: string; valor: number; unidad: string }[];
    alertas?: Alerta[];    /** El servidor lo decide: quién lo registró y si sigue abierta la ventana para corregirlo. */
    editable?: boolean;
}

export interface EventoHistorial {
    embarazo_id: number;
    tipo: "CONTROL" | "SINTOMA" | "EXAMEN" | "CITA" | "ALERTA";
    registro_id: number;
    fecha: string;
    titulo: string;
    detalle: string | null;
    estado: string | null;
    /** Solo en la actividad general del profesional: de quién es el registro. */
    gestante?: string;
    gestante_id?: number;
}

export interface Paciente {
    profesional_usuario_id: number;
    gestante_usuario_id: number;
    gestante: string;
    correo: string;
    telefono: string | null;
    embarazo_id: number | null;
    fecha_estimada_parto: string | null;
    semana_actual: number | null;
    edad_gestacional: string | null;
    alertas_pendientes: number;
    alertas_criticas: number;
    proxima_cita: string | null;
}

export interface Contenido {
    id: number;
    titulo: string;
    cuerpo: string;
    categoria: string | null;
    semana_desde: number;
    semana_hasta: number;
    publicado: boolean;
    leido?: boolean;
}

export interface TipoMedicion {
    id: number;
    codigo: string;
    nombre: string;
    unidad: string;
    valor_min: number;
    valor_max: number;
    decimales: number;
    registrable_por_gestante: boolean;
    activo: boolean;
}

export interface TipoSintoma {
    id: number;
    codigo: string;
    nombre: string;
    es_signo_alarma: boolean;
    severidad: Severidad | null;
    mensaje_alarma: string | null;
    alarma_hasta_semana: number | null;
    activo: boolean;
}

/** Elemento que un profesional debe avalar: una regla de alerta o un signo de alarma. */
export interface ElementoRevision {
    id: number;
    codigo: string;
    mensaje: string;
    severidad: Severidad | null;
    aprobada_en: string | null;
    aprobada_por: string | null;
}

export interface ReglaRevision extends ElementoRevision {
    medicion: string;
    unidad: string;
    operador: OperadorRegla;
    valor_referencia: number | null;
    valor_min: number | null;
    valor_max: number | null;
    semana_desde: number;
    semana_hasta: number;
    activa: boolean;
}

export interface SignoRevision extends Omit<ElementoRevision, "mensaje"> {
    nombre: string;
    mensaje_alarma: string;
    alarma_hasta_semana: number | null;
    activo: boolean;
}

export interface RevisionClinica {
    reglas: ReglaRevision[];
    signos: SignoRevision[];
    /** Cuántos elementos siguen sin aprobación clínica. */
    pendientes: number;
}

export type EstadoSolicitud = "PENDIENTE" | "ATENDIDA" | "RECHAZADA";

/** Solicitud de supresión de datos, vista por la propia gestante. */
export interface SolicitudPropia {
    id: number;
    estado: EstadoSolicitud;
    motivo: string | null;
    solicitada_en: string;
    atendida_en: string | null;
    respuesta: string | null;
}

/** Solicitud de supresión, vista por el administrador. */
export interface SolicitudSupresion extends SolicitudPropia {
    usuario_id: number;
    persona: string;
    correo: string;
    anonimizado_en: string | null;
}

export interface TipoControl {
    id: number;
    codigo: string;
    nombre: string;
    duracion_min: number;
    activo: boolean;
}

export interface TipoExamen {
    id: number;
    codigo: string;
    nombre: string;
    descripcion: string | null;
    activo: boolean;
}

export interface Pagina<T> {
    datos: T[];
    paginacion: { page: number; limit: number; total: number; paginas: number };
    aviso?: string;
}

/** Panel del profesional: `GET /dashboard` con rol PROFESIONAL. */
export interface PanelProfesional {
    rol: "PROFESIONAL";
    resumen: {
        pacientes: number;
        alertas_pendientes: number;
        alertas_criticas: number;
        sin_cita_programada: number;
    };
    alertas_prioritarias: (Pick<
        Alerta,
        "id" | "embarazo_id" | "severidad" | "mensaje" | "valor_detectado" | "generada_en"
    > & { gestante_usuario_id: number; gestante: string })[];
    citas_hoy: {
        id: number;
        embarazo_id: number;
        hora: string;
        estado: EstadoCita;
        tipo_control: string;
        gestante: string;
    }[];
}

/** Panel de la gestante: `GET /dashboard` con rol GESTANTE. */
export interface PanelGestante {
    rol: "GESTANTE";
    embarazo: Embarazo | null;
    /** Quién la acompaña y cómo contactarle (sin el correo de acceso). */
    profesionales: {
        id: number;
        nombre: string;
        especialidad: string;
        institucion: string | null;
        telefono: string | null;
    }[];
    mensaje?: string;
    proxima_cita: Pick<
        Cita,
        "id" | "fecha" | "hora" | "estado" | "profesional"
    > & {
        tipo_control: string;
        /** Días que faltan para la cita (0 = hoy). */
        dias_para: number;
        /** Verdadero si falta menos que el aviso configurado por el administrador. */
        recordatorio: boolean;
    } | null;
    alertas_pendientes: Pick<
        Alerta,
        "id" | "severidad" | "mensaje" | "generada_en" | "accion_inmediata"
    >[];
    ultimas_mediciones: Pick<
        Medicion,
        "tipo" | "nombre" | "unidad" | "valor" | "fecha_registro"
    >[];
    contenido_semana: Pick<Contenido, "id" | "titulo" | "categoria" | "leido">[];
    aviso: string;
}

// --- Administración ---------------------------------------------------------

/** Fila de `GET /usuarios`: sin perfil, que solo trae `GET /usuarios/:id`. */
export type UsuarioListado = Pick<
    Usuario,
    "id" | "rol" | "nombre" | "apellido" | "correo" | "activo" | "ultimo_acceso" | "creado_en"
>;

export interface Asignacion {
    id: number;
    profesional_usuario_id: number;
    profesional: string;
    gestante_usuario_id: number;
    gestante: string;
    fecha_inicio: string;
    fecha_fin: string | null;
    activa: boolean;
    creada_en: string;
    asignada_por: number | null;
}

export type OperadorRegla =
    | "MENOR"
    | "MENOR_IGUAL"
    | "MAYOR"
    | "MAYOR_IGUAL"
    | "FUERA_DE_RANGO";

export interface ReglaAlerta {
    id: number;
    tipo_medicion_id: number;
    tipo_medicion: string;
    unidad: string;
    codigo: string;
    operador: OperadorRegla;
    valor_referencia: number | null;
    valor_min: number | null;
    valor_max: number | null;
    semana_desde: number;
    semana_hasta: number;
    severidad: Severidad;
    mensaje: string;
    activa: boolean;
    creada_por: number | null;
    creada_en: string;
    /** Aprobación clínica: la retira la base de datos si se cambia lo aprobado. */
    aprobada_por: number | null;
    aprobada_en: string | null;
}

export interface ParametroSistema {
    clave: string;
    valor: string;
    descripcion: string | null;
    actualizado_por: number | null;
    actualizado_en: string;
}

export type AccionAuditoria =
    | "LOGIN"
    | "LOGIN_FALLIDO"
    | "LOGOUT"
    | "CREAR"
    | "MODIFICAR"
    | "DESACTIVAR"
    | "CONSULTAR_SENSIBLE";

export interface RegistroAuditoria {
    id: number;
    usuario_id: number | null;
    usuario_correo: string | null;
    accion: AccionAuditoria;
    entidad: string;
    entidad_id: number | null;
    detalle: Record<string, unknown> | null;
    ip: string | null;
    ocurrido_en: string;
}

/** Panel del administrador: `GET /dashboard` con rol ADMINISTRADOR. Solo agregados. */
export interface PanelAdministrador {
    rol: "ADMINISTRADOR";
    usuarios_por_rol: { rol: Rol; activos: number; inactivos: number }[];
    gestantes_sin_profesional: number;
    embarazos_por_estado: { estado: EstadoEmbarazo; total: number }[];
    alertas: { severidad: Severidad; estado: EstadoAlerta; total: number }[];
    citas_por_estado: { estado: EstadoCita; total: number }[];
    contenido: { publicados: number; lecturas: number };
}
