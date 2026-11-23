/**
 * ============================================================================
 * scenarios/standalone_create.js - Prueba Aislada de Creación de Evaluaciones
 * ============================================================================
 * Ejecuta ÚNICAMENTE el endpoint de creación de evaluaciones (POST /api/evaluaciones).
 * 
 * Uso:
 * - Sin setup y pasando token manual:
 *   k6 run --no-setup -e AUTH_TOKEN="eyJ..." scenarios/standalone_create.js
 * 
 * - Con login automático en memoria:
 *   k6 run --vus 10 --duration 1m scenarios/standalone_create.js
 */

import { config } from '../lib/config.js';
import { getAuthToken } from '../lib/auth.js';
import { executeCreateAssessmentFlow } from '../flows/create-record.js';

const baseTemplate = JSON.parse(open('../data/evaluacion.json'));

export const options = {
  insecureSkipTLSVerify: true,
  vus: parseInt(__ENV.VUS || '1', 10),
  duration: __ENV.DURATION || '30s',
  thresholds: {
    http_req_duration: ['p(95)<600', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  const token = getAuthToken();
  executeCreateAssessmentFlow(token, baseTemplate);
}
