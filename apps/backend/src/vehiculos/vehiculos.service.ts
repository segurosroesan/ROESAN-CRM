import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';

@Injectable()
export class VehiculosService {
  private readonly logger = new Logger(VehiculosService.name);

  async consultarPorPlaca(placa: string) {
    // Sanitizar placa
    const placaLimpia = placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    if (placaLimpia.length < 5 || placaLimpia.length > 6) {
      throw new HttpException({ error: 'Placa inválida' }, HttpStatus.BAD_REQUEST);
    }

    this.logger.log(`Consultando placa: ${placaLimpia}`);

    const apiKey = process.env.VERIFIK_API_KEY;

    // Si no hay token de Verifik configurado, usamos un mock para que puedan probar el flujo
    if (!apiKey || apiKey === 'mock_token' || apiKey === '') {
      this.logger.log('VERIFIK_API_KEY no encontrada. Devolviendo datos mockeados.');
      
      // Simulamos latencia de red
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Mock data basado en placas típicas
      let mockData = {
        placa: placaLimpia,
        marca: 'CHEVROLET',
        linea: 'ONIX',
        modelo: '2023',
        fasecolda: '02816043',
        clase: 'AUTOMOVIL'
      };

      if (placaLimpia.startsWith('M')) {
        mockData = { ...mockData, marca: 'MAZDA', linea: 'CX-30', modelo: '2022', fasecolda: '06815031' };
      } else if (placaLimpia.startsWith('K')) {
        mockData = { ...mockData, marca: 'KIA', linea: 'PICANTO', modelo: '2020', fasecolda: '05206100' };
      }

      return {
        success: true,
        data: mockData,
        source: 'mock'
      };
    }

    // Lógica real para consultar Verifik (ejemplo estructura)
    try {
      const response = await fetch(`https://api.verifik.co/v2/co/fasecolda/values-by-plate?plate=${placaLimpia}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Error en Verifik: ${response.status}`);
      }

      const data = await response.json();
      
      // Adaptar la respuesta de Verifik a nuestro formato
      return {
        success: true,
        data: {
          placa: placaLimpia,
          marca: data.data?.marca || '',
          linea: data.data?.linea || '',
          modelo: data.data?.modelo?.toString() || '',
          fasecolda: data.data?.codigoFasecolda || data.data?.codeFasecolda || '',
          clase: data.data?.clase || ''
        },
        source: 'verifik'
      };
    } catch (error: any) {
      this.logger.error(`Error consultando Verifik: ${error.message}`);
      throw new HttpException({ error: 'Error al consultar la placa en el servicio externo', details: error.message }, HttpStatus.BAD_GATEWAY);
    }
  }
}
