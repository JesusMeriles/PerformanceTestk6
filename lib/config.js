/**
 * ============================================================================
 * lib/config.js - Configuración Centralizada para k6
 * ============================================================================
 * Lee variables de entorno (__ENV) con valores por defecto y expone
 * thresholds, URLs y credenciales para todos los escenarios y flujos.
 */

export const config = {
  // URLs Base (Arquitectura desacoplada: BFF y Query API)
  baseUrlBff: __ENV.BASE_URL_BFF || __ENV.BASE_URL_CORE || 'http://localhost:3000',
  baseUrlQuery: __ENV.BASE_URL_QUERY || 'http://localhost:3000',

  // Configuración TLS (permite certificados autofirmados/internos en entornos QA)
  insecureSkipTLSVerify: __ENV.INSECURE_SKIP_TLS_VERIFY !== 'false', // true por defecto

  // Endpoints
  endpoints: {
    login: __ENV.ENDPOINT_LOGIN || '/api/auth/login',
    assessment: __ENV.ENDPOINT_ASSESSMENT || '/api/evaluaciones',
    query: __ENV.ENDPOINT_QUERY || '/api/evaluaciones/consulta',
  },

  // Credenciales BFF por defecto (Payload: { userName, password, ipAddress, deviceId })
  auth: {
    userName: __ENV.API_USER || 'admin',
    password: __ENV.API_PASS || 'Testing123*',
    ipAddress: __ENV.API_IP_ADDRESS || '1',
    deviceId: __ENV.API_DEVICE_ID || 'hkAb',
    // Estrategia de autenticación (1: setup compartido, 2: token único por VU, 3: pre-login en setup, 4: por iteración)
    strategy: parseInt(__ENV.AUTH_STRATEGY || '1', 10),
  },

  // Tiempos de espera (Think Time) en segundos
  thinkTime: {
    min: parseFloat(__ENV.THINK_TIME_MIN || '1'),
    max: parseFloat(__ENV.THINK_TIME_MAX || '3'),
  },

  // Thresholds estándar (Única fuente de verdad en k6)
  thresholds: {
    // SLOs globales de infraestructura
    http_req_duration: ['p(90)<400', 'p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'], // Menos del 1% de fallos
    checks: ['rate>0.99'],          // Más del 99% de checks exitosos

    // Trends específicas por flujo
    'http_req_duration{flow:login}': ['p(95)<500'],
    'http_req_duration{flow:get_assessment}': ['p(95)<400'],
    'http_req_duration{flow:create_assessment}': ['p(95)<600'],
    'http_req_duration{flow:update_assessment}': ['p(95)<600'],
  },
};

export default config;
