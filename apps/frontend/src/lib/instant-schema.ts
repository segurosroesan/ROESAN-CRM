import { i } from "@instantdb/react";

const schema = i.schema({
  entities: {
    leads: i.entity({
      // Base info
      name: i.string(),
      phone: i.string(),
      email: i.string().indexed(),
      city: i.string().optional(),
      type: i.string().indexed(), // ramo: 'auto', 'salud', 'empresarial', 'cumplimiento'
      source: i.string().optional(), // e.g., 'Sitio Web', 'Meta', etc.
      documento: i.string().optional(),
      fecha_nacimiento: i.string().optional(), // Extraída de cédula, formato YYYY-MM-DD
      genero: i.string().optional(),           // 'MASCULINO' | 'FEMENINO'
      selectedProducts: i.string().optional(),
      observaciones: i.string().optional(),
      
      
      // Vehicle (Auto)
      vehiclePlate: i.string().optional(),
      vehicleBrand: i.string().optional(),
      vehicleModel: i.string().optional(),
      vehicleYear: i.string().optional(),
      vehicleFasecolda: i.string().optional(),
      vehicleUse: i.string().optional(),
      driverBirthDate: i.string().optional(),
      driverGender: i.string().optional(),
      hasPledge: i.boolean().optional(),
      pledgeDetails: i.string().optional(),
      drivingZone: i.string().optional(),
      
      // Salud
      patientAge: i.string().optional(),
      healthCoverage: i.string().optional(),
      currentEps: i.string().optional(),
      
      // Corporate (Empresa)
      companyName: i.string().optional(),
      companyNit: i.string().optional(),
      companySector: i.string().optional(),
      companyEmployees: i.string().optional(),
      companyRisk: i.string().optional(),
      responsibleName: i.string().optional(),
      responsiblePhone: i.string().optional(),
      
      // Cumplimiento
      contractType: i.string().optional(),
      contractValue: i.string().optional(),
      contractEntity: i.string().optional(),
      
      // CRM Management
      status: i.string().indexed(), // stages: 'Nuevo', 'Contactado', etc.
      priority: i.string().optional(), // 'Baja', 'Media', 'Alta', 'Urgente'
      score: i.number().optional(),
      notes: i.string().optional(),
      asesorId: i.string().optional(),
      
      // Pipeline type
      pipeline_tipo: i.string().optional(), // 'preventa' | 'renovacion' | 'crosssell'

      // Vehicle shorthand (for email generation / cotizador)
      placa: i.string().optional(),
      vehiculo: i.string().optional(), // "Toyota Corolla 2022"

      // Soft Seguros Integration
      soft_cliente_id: i.string().optional(),
      soft_poliza_id: i.string().optional(),
      sincronizado_soft: i.boolean().optional(),

      // Renovation-specific fields
      numero_poliza: i.string().optional(),
      aseguradora: i.string().optional(),
      fecha_fin_poliza: i.string().optional(),
      prima_actual: i.number().optional(),
      dias_para_vencer: i.number().optional(),
      objeto_asegurado: i.string().optional(),
      fecha_inicio_poliza: i.string().optional(),
      tipo_documento: i.string().optional(), // '01'=Cédula, '02'=NIT, '03'=Pasaporte
      prima_neta: i.number().optional(),
      iva: i.number().optional(),
      gastos_expedicion: i.number().optional(),
      
      // Legal
      consentimiento_datos: i.boolean().optional(),
      ip_origen: i.string().optional(),
      
      // Documentos (Persistencia de metadatos de sincronización)
      docs_metadata: i.json().optional(),
      
      createdAt: i.number().indexed(),
      updatedAt: i.number(),
    }),
    
    tasks: i.entity({
      title: i.string(),
      description: i.string(),
      completed: i.boolean(),
      leadId: i.string().indexed(),
      createdAt: i.number(),
    }),

    interacciones: i.entity({
      tipo: i.string(), // 'llamada', 'whatsapp', 'email', 'reunion'
      notas: i.string(),
      leadId: i.string().indexed(),
      createdAt: i.number(),
    }),

    cotizaciones: i.entity({
      valor: i.number(),
      prima_total: i.number().optional(),
      prima_neta: i.number().optional(),
      iva: i.number().optional(),
      gastos_expedicion: i.number().optional(),
      valor_asegurado: i.number().optional(),
      aseguradora: i.string(),
      nombre_plan: i.string().optional(),
      cobertura: i.string().optional(),
      coberturas: i.json().optional(),   // array de coberturas detalladas
      deducibles: i.json().optional(),   // array de deducibles
      fuente: i.string().optional(),
      estado: i.string(), // 'pendiente', 'enviada', 'aceptada', 'rechazada'
      es_renovacion: i.boolean().optional(),
      leadId: i.string().indexed(),
      createdAt: i.number(),
      updatedAt: i.number().optional(),
    }),
    
    users: i.entity({
      name: i.string(),
      email: i.string().indexed(),
      role: i.string(), // 'admin', 'coordinador', 'asesor', 'solo lectura'
      active: i.boolean().optional(),
      googleEmail: i.string().optional(),
      googleRefreshToken: i.string().optional(),
    }),

    job_importaciones: i.entity({
      ejecutadoEn: i.number(),
      totalConsultadas: i.number(),
      nuevasCreadas: i.number(),
      actualizadas: i.number(),
      ignoradas: i.number(),
      errores: i.number(),
      detalleErrores: i.string().optional(),
      duracionMs: i.number().optional(),
    }),

    propuestas: i.entity({
      extracted: i.json(), // Datos estructurados del comparativo y cliente
      analysis: i.json(),  // Análisis de IA con la recomendación
      leadId: i.string().indexed(),
      createdAt: i.number(),
    }),
  },
  links: {
    leadTasks: {
      forward: {
        on: "leads",
        has: "many",
        label: "tasks",
      },
      reverse: {
        on: "tasks",
        has: "one",
        label: "lead",
      },
    },
    leadAsesor: {
      forward: {
        on: "leads",
        has: "one",
        label: "assignedTo",
      },
      reverse: {
        on: "users",
        has: "many",
        label: "leads",
      },
    },
    leadInteracciones: {
      forward: {
        on: "leads",
        has: "many",
        label: "interacciones",
      },
      reverse: {
        on: "interacciones",
        has: "one",
        label: "lead",
      },
    },
    leadCotizaciones: {
      forward: {
        on: "leads",
        has: "many",
        label: "cotizaciones",
      },
      reverse: {
        on: "cotizaciones",
        has: "one",
        label: "lead",
      },
    },
    leadPropuestas: {
      forward: {
        on: "leads",
        has: "many",
        label: "propuestas",
      },
      reverse: {
        on: "propuestas",
        has: "one",
        label: "lead",
      },
    },
  },
});

export type AppSchema = typeof schema;
export default schema;
