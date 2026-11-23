/**
 * ============================================================================
 * scenarios/standalone_login.js - Prueba Aislada de Autenticación / Login
 * ============================================================================
 * Ejecuta ÚNICAMENTE el endpoint de login (POST /api/auth/login).
 * Útil para medir la capacidad y latencia del servicio de autenticación BFF.
 * 
 * Uso:
 *   k6 run --vus 10 --duration 1m scenarios/standalone_login.js
 */

import { config } from '../lib/config.js';
import { executeLoginFlow } from '../flows/login.js';

export const options = {
  insecureSkipTLSVerify: true,
  vus: parseInt(__ENV.VUS || '1', 10),
  duration: __ENV.DURATION || '30s',
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  executeLoginFlow();
}

