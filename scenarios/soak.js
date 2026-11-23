/**
 * ============================================================================
 * scenarios/soak.js - Prueba de Resistencia Prolongada (Soak Test)
 * ============================================================================
 * Regla de autenticación:
 * El login se ejecuta UNA SOLA VEZ en setup() con las credenciales de .env.
 *
 * Perfil:
 * Carga moderada (30 VUs) sostenida durante 30 a 60 minutos.
 *
 * Distribución de tráfico (usando 'exec' multi-escenario):
 * - Consulta de evaluación (POST): 60%
 * - Creación de evaluación (POST id=0): 25%
 * - Actualización de evaluación (POST id>0): 15%
 */

import { config } from '../lib/config.js';
import { login, getAuthToken } from '../lib/auth.js';
import { executeCreateAssessmentFlow } from '../flows/create-record.js';
import { executeGetAssessmentFlow } from '../flows/search.js';
import { executeUpdateAssessmentFlow } from '../flows/update-record.js';

const baseTemplate = JSON.parse(open('../data/evaluacion.json'));

const SOAK_VUS = parseInt(__ENV.SOAK_VUS || '30', 10);
const SOAK_DURATION = __ENV.SOAK_DURATION || '30m';

const vusQuery = Math.max(1, Math.round(SOAK_VUS * 0.60));
const vusCreate = Math.max(1, Math.round(SOAK_VUS * 0.25));
const vusUpdate = Math.max(1, SOAK_VUS - vusQuery - vusCreate);

export const options = {
  insecureSkipTLSVerify: true,
  scenarios: {
    soak_query: {
      executor: 'ramping-vus',
      exec: 'execQueryFlow',
      startVUs: 1,
      stages: [
        { duration: '2m', target: vusQuery },
        { duration: SOAK_DURATION, target: vusQuery },
        { duration: '2m', target: 0 },
      ],
      gracefulRampDown: '30s',
      gracefulStop: '30s',
    },

    soak_create: {
      executor: 'ramping-vus',
      exec: 'execCreateFlow',
      startVUs: 1,
      stages: [
        { duration: '2m', target: vusCreate },
        { duration: SOAK_DURATION, target: vusCreate },
        { duration: '2m', target: 0 },
      ],
      gracefulRampDown: '30s',
      gracefulStop: '30s',
    },

    soak_update: {
      executor: 'ramping-vus',
      exec: 'execUpdateFlow',
      startVUs: 1,
      stages: [
        { duration: '2m', target: vusUpdate },
        { duration: SOAK_DURATION, target: vusUpdate },
        { duration: '2m', target: 0 },
      ],
      gracefulRampDown: '30s',
      gracefulStop: '30s',
    },
  },
  thresholds: config.thresholds,
};

export function setup() {
  console.log(`[Soak Setup] Login único en BFF con usuario de .env: '${config.auth.userName}'`);
  const authToken = login();
  console.log('[Soak Setup] Token único obtenido para la prueba de resistencia.');
  return { authToken };
}

export function execQueryFlow(data) {
  const token = getAuthToken(data);
  const customerId = 1000 + (__VU % 100) + 1;
  executeGetAssessmentFlow(token, customerId);
}

export function execCreateFlow(data) {
  const token = getAuthToken(data);
  executeCreateAssessmentFlow(token, baseTemplate);
}

export function execUpdateFlow(data) {
  const token = getAuthToken(data);
  const targetId = 1000 + (__VU % 50) + 1;
  executeUpdateAssessmentFlow(token, baseTemplate, targetId, targetId);
}

export default function (data) {
  const token = getAuthToken(data);
  executeGetAssessmentFlow(token);
  const created = executeCreateAssessmentFlow(token, baseTemplate);
  if (created && created.createdId) {
    executeUpdateAssessmentFlow(token, baseTemplate, created.createdId, created.assessmentCustomerId);
  }
}

export function teardown(data) {
  console.log('[Soak Teardown] Prueba de resistencia completada.');
}
