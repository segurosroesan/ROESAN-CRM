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
      
      // Vehicle (Auto)
      vehiclePlate: i.string().optional(),
      vehicleBrand: i.string().optional(),
      vehicleModel: i.string().optional(),
      vehicleYear: i.string().optional(),
      vehicleUse: i.string().optional(),
      driverBirthDate: i.string().optional(),
      
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
      
      // Soft Seguros Integration
      soft_cliente_id: i.string().optional(),
      soft_poliza_id: i.string().optional(),
      sincronizado_soft: i.boolean().optional(),
      
      // Legal
      consentimiento_datos: i.boolean().optional(),
      ip_origen: i.string().optional(),
      
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
    
    users: i.entity({
      name: i.string(),
      email: i.string().indexed(),
      role: i.string(), // 'admin', 'coordinador', 'asesor'
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
  },
});

export type AppSchema = typeof schema;
export default schema;
