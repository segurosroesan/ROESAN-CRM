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
    try {
        const response = await this.request('GET', '/api/cliente/listar_cliente_por_documento/', undefined, {
            numero_documento: documento
        });
        // API may return paginated { count, results: [...] } or a direct object
        if (response?.results !== undefined) {
          return response.results?.[0] ?? null;
        }
        return response ?? null;
    } catch (error) {
        this.logger.warn(`Direct client search failed for ${documento}, trying exhaustive loop...`);
        return this.exhaustiveSearch('/api/cliente/', 'numero_documento', documento);
    }
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
        email: data.correo || 'sin_correo@test.com',
        celular: data.celular || '0000000000',
        telefono: data.celular || '0000000000',
        tipo_documento: "01", // Cédula (default)
        genero: "MASCULINO", // Default requerido
        fecha_nacimiento: "1990-01-01", // Default requerido
        ocupacion: 4, // INDEPENDIENTE (ID encontrado en SoftSeguros)
        es_prospecto: true,
        sede: 6787, // Sede Principal Roesan
        marca: 6751, // Marca Roesan
        tipo_cliente: "F", // Persona Física
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
       this.logger.error(`Failed to create client in Soft Seguros: ${JSON.stringify(error.response?.data || error.message)}`);
       throw new Error(`Error en SYNC-2: No se pudo crear el cliente. ${JSON.stringify(error.response?.data)}`);
    }
  }
}
