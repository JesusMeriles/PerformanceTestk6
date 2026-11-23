/**
 * ============================================================================
 * scenarios/standalone_query.js - Prueba Aislada de Consulta de Evaluaciones
 * ============================================================================
 * Ejecuta ÚNICAMENTE el endpoint de consulta (POST /api/evaluaciones/consulta).
 * 
 * Uso:
 * - Sin setup y pasando token manual:
 *   k6 run --no-setup -e AUTH_TOKEN="eyJ..." scenarios/standalone_query.js
 * 
 * - Con login automático en memoria:
 *   k6 run --vus 20 --duration 1m scenarios/standalone_query.js
 */

import { config } from '../lib/config.js';
import { getAuthToken } from '../lib/auth.js';
import { executeGetAssessmentFlow } from '../flows/search.js';

export const options = {
  insecureSkipTLSVerify: true,
  vus: parseInt(__ENV.VUS || '1', 10),
  duration: __ENV.DURATION || '30s',
  thresholds: {
    http_req_duration: ['p(95)<400', 'p(99)<800'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  const token = getAuthToken();
  const customerId = 1000 + (__VU % 100) + 1;
  executeGetAssessmentFlow(token, customerId);
}

