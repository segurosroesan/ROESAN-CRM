import axios, { AxiosInstance } from 'axios';
import { Logger } from '@nestjs/common';

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
      const response = await this.request('GET', '/api/cliente/listar_cliente_por_documento/', undefined, {
        numero_documento: documento,
      });
      if (response?.results !== undefined) {
        if (response.results?.[0]) return response.results[0];
        // count=0 here doesn't always mean "not exists" — some old clients are missed by this endpoint
      } else if (response) {
        return response;
      }
    } catch (error) {
      if (error.response?.status === 404) {
        this.logger.log(`Client ${documento} not found in Soft Seguros (404).`);
        return null;
      }
      this.logger.warn(`Dedicated endpoint failed for ${documento}: ${error.message}`);
    }

    // Attempt 2: main /api/cliente/ with filter (more reliable for older records)
    try {
      this.logger.log(`Trying main endpoint filter for document ${documento}`);
      const response = await this.request('GET', '/api/cliente/', undefined, {
        numero_documento: documento,
        page_size: 10,
      });
      if (response?.results?.length > 0) {
        this.logger.log(`Found client via main endpoint filter: ${response.results[0].id}`);
        return response.results[0];
      }
    } catch (error) {
      this.logger.warn(`Main endpoint filter also failed for ${documento}: ${error.message}`);
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
        tipo_documento: data.tipo_documento || "01", // Cédula (default)
        genero: data.genero || "MASCULINO",
        fecha_nacimiento: data.fecha_nacimiento || "1990-01-01",
        ocupacion: data.ocupacion || 4, // INDEPENDIENTE (ID encontrado en SoftSeguros)
        es_prospecto: true,
        sede: 6787, // Sede Principal Roesan
        marca: 6751, // Marca Roesan
        tipo_cliente: data.tipo_cliente || "F", // Persona Física
        direccion: data.direccion || "Sin dirección",
        ciudad: data.ciudad || "BOGOTÁ",
        provincia: data.provincia || "BOGOTÁ",
        pais: "CO",
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
   * Update client in Soft Seguros
   */
  async updateClient(id: string | number, data: any): Promise<any> {
    try {
      this.logger.log(`Updating client ID: ${id}`);
      const response = await this.request('PATCH', `/api/cliente/${id}/`, data);
      return response;
    } catch (error) {
      this.logger.error(`Failed to update client ${id}: ${JSON.stringify(error.response?.data || error.message)}`);
      throw error;
    }
  }

  /**
   * SYNC-4: Create policy in Soft Seguros
   */
  async createPolicy(data: any): Promise<any> {
    try {
      this.logger.log(`Creating policy for client ID: ${data.id_cliente}`);
      const response = await this.request('POST', '/api/poliza/', data);
      return response;
    } catch (error) {
      this.logger.error(`Failed to create policy: ${JSON.stringify(error.response?.data || error.message)}`);
      throw error;
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
    tipo_entidad: 'C' | 'P'; // C=Cliente, P=Poliza
    nombre_archivo: string;
    archivo_base64: string;
    tipo_anexo?: number;
  }): Promise<any> {
    try {
      this.logger.log(`Uploading attachment ${data.nombre_archivo} to entity ${data.tipo_entidad}:${data.id_entidad}`);
      
      const payload = {
        id_entidad: data.id_entidad,
        tipo_entidad: data.tipo_entidad,
        nombre_archivo: data.nombre_archivo,
        archivo: data.archivo_base64,
        tipo_anexo: data.tipo_anexo || 1, // Default tipo
      };

      const response = await this.request('POST', '/api/anexopoliza/', payload);
      return response;
    } catch (error) {
      this.logger.error(`Failed to upload attachment: ${JSON.stringify(error.response?.data || error.message)}`);
      throw error;
    }
  }
}
