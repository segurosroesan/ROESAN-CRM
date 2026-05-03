// IDs del sistema Soft Seguros — obtenidos del panel de administración.
// Actualizar si Soft Seguros cambia su configuración.

export const SOFT_ESTADO_VIGENTE_ID = parseInt(process.env.SOFT_ESTADO_VIGENTE_ID || '45909', 10);
export const SOFT_VENDEDOR_ORG_ID = parseInt(process.env.SOFT_VENDEDOR_ID || '27931', 10);
export const SOFT_SEDE_ID = parseInt(process.env.SOFT_SEDE_ID || '6787', 10);

// Código genérico del estado póliza "Vigente"
export const CODIGO_ESTADO_VIGENTE = '01';

// Tipos de documento Soft Seguros
export const TIPO_DOC_CEDULA = '01';
export const TIPO_DOC_NIT = '02';
export const TIPO_DOC_PASAPORTE = '03';

// Tipo de cliente
export const TIPO_CLIENTE_NATURAL = 'Cliente';
export const TIPO_CLIENTE_JURIDICO = 'ClienteJuridico';
