import axios, { AxiosInstance } from 'axios';
import { Logger } from '@nestjs/common';
import NodeFormData from 'form-data';

export class SoftSegurosApi {
  private client: AxiosInstance;
  private token: string | null = null;
  private logger = new Logger('SoftSegurosApi');

  constructor(
    private readonly baseUrl: string,
    private readonly username?: string,
    private readonly password?: string,
  ) {
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Performs authentication to obtain a token.
   */
  async login(): Promise<string> {
    if (!this.username || !this.password) {
      throw new Error('Soft Seguros credentials (username/password) are missing.');
    }

    try {
      this.logger.log(`Authenticating user: ${this.username}`);
      const response = await this.client.post('/api-token-auth/', {
        username: this.username,
        password: this.password,
      });

      this.token = response.data.token;
      this.logger.log('Successfully obtained Soft Seguros token.');
      return this.token!;
    } catch (error) {
      this.logger.error(`Login failed: ${error.response?.data?.detail || error.message}`);
      throw new Error('Failed to authenticate with Soft Seguros');
    }
  }

  /**
   * Helper to make authorized requests.
   */
  private async request(method: string, url: string, data?: any, params?: any): Promise<any> {
    if (!this.token) {
      await this.login();
    }

    try {
      const response = await this.client.request({
        method,
        url,
        data,
        params,
        headers: {
          Authorization: `Token ${this.token}`,
        },
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        this.logger.warn('Token expired or invalid. Retrying login...');
        await this.login();
        return this.request(method, url, data, params);
      }
      throw error;
    }
  }

  /**
   * Robust search that iterates through all pages to avoid filter bugs.
   * @param endpoint The API endpoint (e.g., '/api/poliza/')
   * @param targetField Field to compare
   * @param targetValue Value to find
   */
  async exhaustiveSearch(endpoint: string, targetField: string, targetValue: string) {
    let currentUrl = endpoint;
    let page = 1;

    while (currentUrl) {
      this.logger.log(`Searching page ${page} of ${endpoint}...`);
      const response = await this.request('GET', currentUrl, undefined, { page_size: 100 });
      
      const items = response.results || [];
      const found = items.find((item: any) => {
        // Handle nested fields (e.g., "cliente.numero_documento")
        const value = targetField.split('.').reduce((obj, key) => obj?.[key], item);
        return String(value) === String(targetValue);
      });

      if (found) return found;

      currentUrl = response.next;
      page++;
    }

    return null;
  }

  /**
   * Specific methods for SYNC flows
   */
  async getClientByDocument(documento: string) {
    // Attempt 1: dedicated endpoint
    try {
      this.logger.log(`[getClientByDocument] Attempt 1: /listar_cliente_por_documento/ for ${documento}`);
      const response = await this.request('GET', '/api/cliente/listar_cliente_por_documento/', undefined, {
        numero_documento: documento,
      });
      this.logger.log(`[getClientByDocument] Attempt 1 response type: ${typeof response}, has results: ${response?.results !== undefined}, id: ${response?.id}`);
      
      if (response?.results !== undefined) {
        if (response.results?.[0]) return response.results[0];
        // count=0 here doesn't always mean "not exists" — some old clients are missed by this endpoint
      } else if (response) {
        return response;
      }
    } catch (error) {
      const status = error.response?.status;
      const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      this.logger.warn(`[getClientByDocument] Attempt 1 failed: status=${status}, detail=${detail}`);
      
      if (status === 404) {
        this.logger.log(`Client ${documento} not found in Soft Seguros (404).`);
        return null;
      }
      // Auth errors should not be silently swallowed
      if (status === 401 || status === 403) {
        throw error;
      }
    }

    // Attempt 2: main /api/cliente/ with filter (more reliable for older records)
    try {
      this.logger.log(`[getClientByDocument] Attempt 2: /api/cliente/ filter for ${documento}`);
      const response = await this.request('GET', '/api/cliente/', undefined, {
        numero_documento: documento,
        page_size: 10,
      });
      if (response?.results?.length > 0) {
        this.logger.log(`Found client via main endpoint filter: ${response.results[0].id}`);
        return response.results[0];
      }
    } catch (error) {
      this.logger.warn(`Main endpoint filter also failed for ${documento}: status=${error.response?.status}, ${error.message}`);
    }

    return null;
  }

  /**
   * SYNC-2: Create client in Soft Seguros
   * @param data Client data mapped from the Lead object
   */
  async createClient(data: any): Promise<any> {
    try {
      this.logger.log(`Creating client for document: ${data.numero_documento}`);
      
      const payload = {
        numero_documento: data.numero_documento,
        nombres: data.nombres || data.nombre_completo,
        apellidos: data.apellidos || '',
        email: data.correo || data.email || 'sin_correo@test.com',
        celular: data.celular || data.phone || '0000000000',
        telefono: data.telefono || data.celular || data.phone || '0000000000',
        tipo_documento: data.tipo_documento || "01", // Default to Cédula ("01")
        genero: data.genero || "MASCULINO",
        fecha_nacimiento: data.fecha_nacimiento || "1990-01-01",
        ocupacion: data.ocupacion || 4, // INDEPENDIENTE (ID encontrado en SoftSeguros)
        es_prospecto: true,
        sede: 6787, // Sede Principal Roesan
        marca: 6751, // Marca Roesan
        tipo_cliente: data.tipo_cliente || "Cliente", // Default to Cliente for remisiones
        direccion: data.direccion || "Sin dirección",
        ciudad: data.ciudad || "BOGOTÁ",
        provincia: data.provincia || "BOGOTÁ",
        pais: "CO",
        ...(data.otra_ocupacion ? { otra_ocupacion: data.otra_ocupacion } : {}),
      };

      this.logger.debug(`Payload sync-2: ${JSON.stringify(payload)}`);
      const response = await this.request('POST', '/api/cliente/', payload);
      this.logger.log(`Client created successfully with ID: ${response.id}`);
      return response;
    } catch (error) {
       const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
       this.logger.error(`Failed to create client in Soft Seguros: ${detail}`);
       throw new Error(`Error en SYNC-2: No se pudo crear el cliente. ${detail}`);
    }
  }

  /**
   * Update client in Soft Seguros.
   * PATCH silently ignores fecha_nacimiento/fecha_expedicion, so we GET+PUT.
   */
  async updateClient(id: string | number, data: any): Promise<any> {
    try {
      this.logger.log(`GET cliente ${id} para merge antes de PUT`);
      const existing = await this.request('GET', `/api/cliente/${id}/`);
      const merged = { ...existing, ...data };
      this.logger.log(`PUT cliente ${id}`);
      const response = await this.request('PUT', `/api/cliente/${id}/`, merged);
      return response;
    } catch (error) {
      this.logger.error(`Failed to update client ${id}: ${JSON.stringify(error.response?.data || error.message)}`);
      throw error;
    }
  }

  /**
   * Fetch client by internal Soft Seguros ID
   */
  async getClientById(id: string | number) {
    try {
      this.logger.log(`[getClientById] Fetching client id=${id}`);
      const response = await this.request('GET', '/api/cliente/listar_cliente_por_id/', undefined, {
        id_cliente: id,
      });
      if (response?.results?.[0]) return response.results[0];
      if (response?.id) return response;
      return null;
    } catch (error) {
      this.logger.warn(`[getClientById] Failed for id=${id}: ${error.message}`);
      return null;
    }
  }

  /**
   * SYNC-4: Create policy in Soft Seguros
   */
  async createPolicy(data: any): Promise<any> {
    try {
      this.logger.log(`Creating policy for client ID: ${data.id_cliente ?? data.cliente}`);

      const payload: Record<string, any> = {
        cliente: data.id_cliente ?? data.cliente,
        renovable: data.renovable ?? true,
        // estado_poliza MUST be an integer ID: 45909=Vigente, 45910=Cotización, 45911=Devengada
        // Using {codigo_generico:'01'} causes 500 "Problemas internos del servidor"
        estado_poliza: typeof data.estado_poliza === 'number'
          ? data.estado_poliza
          : 45909, // 45909 = Vigente
        sede: data.sede ?? Number(process.env.SOFT_SEDE_ID ?? 6787),
      };

      // vendedor: explicit from payload OR from env SOFT_VENDEDOR_ID
      // IMPORTANT: the org-level vendedor (27931) cannot create policies.
      // Must use an individual asesor ID (e.g., 30808).
      const vendedorId = data.vendedor ?? Number(process.env.SOFT_VENDEDOR_ID);
      if (vendedorId) {
        payload.vendedor = vendedorId;
      }
      if (data.ramo ?? data.ramo_soft_id) payload.ramo = data.ramo_soft_id ?? data.ramo;
      if (data.numero_poliza) payload.numero_poliza = data.numero_poliza;
      if (data.fecha_inicio) payload.fecha_inicio = data.fecha_inicio;
      if (data.fecha_fin) payload.fecha_fin = data.fecha_fin;
      // prima is the correct field name in Soft Seguros for Prima Neta
      if (data.prima !== undefined || data.valor_prima !== undefined) {
        payload.prima = data.prima ?? data.valor_prima;
      }
      if (data.total !== undefined) payload.total = data.total;
      if (data.iva !== undefined) payload.iva = data.iva;
      if (data.gastos_expedicion !== undefined) payload.gastos_expedicion = data.gastos_expedicion;
      if (data.codio_objeto_asegurado ?? data.objeto_asegurado) {
        payload.codio_objeto_asegurado = data.codio_objeto_asegurado ?? data.objeto_asegurado;
      }
      if (data.nombre_tomador) payload.nombre_tomador = data.nombre_tomador;
      if (data.apellido_tomador) payload.apellido_tomador = data.apellido_tomador;
      if (data.cedula_tomador) payload.cedula_tomador = data.cedula_tomador;
      if (data.nombre_asegurado) payload.nombre_asegurado = data.nombre_asegurado;
      if (data.cedula_asegurado) payload.cedula_asegurado = data.cedula_asegurado;
      
      // Tipo Moneda (default to COP if not specified, mapped from moneda)
      if (data.moneda) {
        payload.tipo_moneda = data.moneda;
      } else {
        payload.tipo_moneda = 'COP'; // Default
      }

      // Advanced fields for renewals, payments and alerts
      if (data.poliza_padre) payload.poliza_padre = data.poliza_padre;
      if (data.numero_renovacion !== undefined) payload.numero_renovacion = data.numero_renovacion;
      if (data.observaciones) payload.observaciones = data.observaciones;
      if (data.forma_pago) payload.forma_pago = data.forma_pago;
      if (data.periodicidad) payload.periodicidad = data.periodicidad;
      
      // Notifications (booleans)
      if (data.activar_notificaciones_asistente_virtual !== undefined) payload.activar_notificaciones_asistente_virtual = data.activar_notificaciones_asistente_virtual;
      if (data.enviar_correo_notificacion_renovacion !== undefined) payload.enviar_correo_notificacion_renovacion = data.enviar_correo_notificacion_renovacion;
      if (data.enviar_whatsapp_poliza_por_vencer !== undefined) payload.enviar_whatsapp_poliza_por_vencer = data.enviar_whatsapp_poliza_por_vencer;
      if (data.enviar_correo_pagos_vencidos !== undefined) payload.enviar_correo_pagos_vencidos = data.enviar_correo_pagos_vencidos;
      if (data.enviar_whatsapp_pagos_vencidos !== undefined) payload.enviar_whatsapp_pagos_vencidos = data.enviar_whatsapp_pagos_vencidos;

      this.logger.debug(`Payload sync-4: ${JSON.stringify(payload)}`);
      const response = await this.request('POST', '/api/poliza/', payload);
      return response;
    } catch (error) {
      this.logger.error(`Failed to create policy: ${JSON.stringify(error.response?.data || error.message)}`);
      throw error;
    }
  }

  /**
   * SYNC-3: Create extra client data in Soft Seguros
   * codigo_tipo: 1=email, 2=address, 3=phone, 4=cellular, 5=child, 6=vehicle
   */
  async createDatosExtras(clienteId: number, codigoTipo: number, texto: string | object): Promise<any> {
    try {
      this.logger.log(`Creating datosextrascliente tipo ${codigoTipo} for client ${clienteId}`);
      const payload = {
        cliente: clienteId,
        codigo_tipo: codigoTipo,
        texto: typeof texto === 'object' ? JSON.stringify(texto) : texto,
      };
      this.logger.debug(`Payload sync-3: ${JSON.stringify(payload)}`);
      const response = await this.request('POST', '/api/datosextrascliente/', payload);
      return response;
    } catch (error) {
      this.logger.error(`Failed to create datosextrascliente: ${JSON.stringify(error.response?.data || error.message)}`);
      throw error;
    }
  }

  /**
   * SYNC-5: Create beneficiariopolizariesgo in Soft Seguros
   */
  async createBeneficiario(data: any): Promise<any> {
    try {
      this.logger.log(`Creating beneficiario para póliza ID: ${data.poliza}`);
      const payload: Record<string, any> = {
        poliza: data.poliza,
        numero_documento: data.numero_documento || 'No especificado',
      };
      
      if (data.nombres) payload.nombres = data.nombres;
      if (data.parentesco) payload.parentesco = data.parentesco;
      if (data.porcentaje_beneficio !== undefined) payload.porcentaje_beneficio = data.porcentaje_beneficio;

      this.logger.debug(`Payload sync-5 (beneficiario): ${JSON.stringify(payload)}`);
      const response = await this.request('POST', '/api/beneficiariopolizariesgo/', payload);
      return response;
    } catch (error) {
      this.logger.error(`Failed to create beneficiario: ${JSON.stringify(error.response?.data || error.message)}`);
      // No lanzamos error crítico para que no falle toda la remisión si solo falla el beneficiario
      return { error: error.message };
    }
  }

  /**
   * Update policy in Soft Seguros
   */
  async updatePolicy(id: string | number, data: any): Promise<any> {
    try {
      this.logger.log(`Updating policy ID: ${id}`);
      const response = await this.request('PATCH', `/api/poliza/${id}/`, data);
      return response;
    } catch (error) {
      this.logger.error(`Failed to update policy ${id}: ${JSON.stringify(error.response?.data || error.message)}`);
      throw error;
    }
  }

  /**
   * SYNC-6: Upload attachment to Soft Seguros
   * @param data { id_entidad, tipo_entidad, nombre_archivo, archivo_base64 }
   */
  async createAnexo(data: {
    id_entidad: number;
    tipo_entidad: 'C' | 'P';
    nombre_archivo: string;
    archivo_base64: string;
    fecha_expedicion?: string;
    fecha_inicio?: string;
    fecha_fin?: string;
    tipo_anexo?: number;
  }): Promise<any> {
    if (!this.token) await this.login();
    try {
      this.logger.log(`Uploading attachment ${data.nombre_archivo} to entity ${data.tipo_entidad}:${data.id_entidad}`);
      const today = new Date().toISOString().split('T')[0];
      const farFuture = `${new Date().getFullYear() + 10}-12-31`;

      const form = new NodeFormData();
      form.append('id_entidad', String(data.id_entidad));
      form.append('tipo_entidad', data.tipo_entidad);
      form.append('nombre_archivo', data.nombre_archivo);
      form.append('tipo_anexo', String(data.tipo_anexo || 1));
      form.append('fecha_expedicion', data.fecha_expedicion || today);
      form.append('fecha_inicio', data.fecha_inicio || data.fecha_expedicion || today);
      form.append('fecha_fin', data.fecha_fin || farFuture);
      const fileBuffer = Buffer.from(data.archivo_base64, 'base64');
      form.append('archivo', fileBuffer, { filename: data.nombre_archivo, contentType: 'application/octet-stream' });

      const response = await this.client.post('/api/anexopoliza/', form, {
        headers: { Authorization: `Token ${this.token}`, ...form.getHeaders() },
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        await this.login();
        return this.createAnexo(data);
      }
      this.logger.error(`Failed to upload attachment: ${JSON.stringify(error.response?.data || error.message)}`);
      throw error;
    }
  }

  /**
   * Get all policies for a specific client
   */
  async getPolizasByClient(clientId: string | number): Promise<any[]> {
    try {
      this.logger.log(`Fetching policies for client ID: ${clientId}`);
      const response = await this.request('GET', '/api/poliza/', undefined, {
        id_cliente: clientId,
        page_size: 100,
      });
      return response.results || [];
    } catch (error) {
      this.logger.error(`Failed to fetch policies for client ${clientId}: ${error.message}`);
      return [];
    }
  }

  /**
   * SYNC-7: Create pago pendiente in Soft Seguros
   */
  async createPago(data: {
    poliza: number;
    valor_a_pagar: number;
    valor_pagado: number;
    numero_cuota?: number;
    fecha_pago?: string;
  }): Promise<any> {
    try {
      this.logger.log(`Creating pago for policy ID: ${data.poliza}`);
      
      const payload = {
        poliza: data.poliza,
        valor_a_pagar: data.valor_a_pagar || 0,
        valor_pagado: data.valor_pagado || 0,
        numero_cuota: data.numero_cuota || 1,
        fecha_pago: data.fecha_pago || new Date().toISOString().split('T')[0],
      };

      this.logger.debug(`Payload sync-7 (pago): ${JSON.stringify(payload)}`);
      const response = await this.request('POST', '/api/pagopoliza/', payload);
      return response;
    } catch (error) {
      this.logger.error(`Failed to create pago: ${JSON.stringify(error.response?.data || error.message)}`);
      // No lanzamos error crítico para que no falle toda la remisión si solo falla el pago
      return { error: error.message };
    }
  }
}
