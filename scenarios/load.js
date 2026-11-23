/**
 * ============================================================================
 * scenarios/load.js - Prueba de Carga (Load Test)
 * ============================================================================
 * Regla de autenticación:
 * El login se ejecuta UNA SOLA VEZ en setup() con las credenciales de .env.
 * Todos los VUs reutilizan el token obtenido, evitando la invalidación de sesión.
 *
 * Distribución de tráfico (usando 'exec' con múltiples escenarios):
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

// Carga nominal parametrizable desde la CLI:
// Soporta: VUS, USERS, REQUESTS, REQ
const TOTAL_VUS = parseInt(
  __ENV.VUS || __ENV.USERS || __ENV.REQUESTS || __ENV.REQ || '50',
  10
);

// Duración de la meseta parametrizable:
// Soporta: DURATION, TIME, DUR, T
const HOLD_DURATION = __ENV.DURATION || __ENV.TIME || __ENV.DUR || __ENV.T || '10m';

// Tiempo de rampa de subida (default: 2m)
const RAMP_TIME = __ENV.RAMP_TIME || __ENV.RAMP || '2m';

// Distribución de VUs por escenario (60% / 25% / 15%)
const VUS_QUERY = Math.max(1, Math.round(TOTAL_VUS * 0.60));
const VUS_CREATE = Math.max(1, Math.round(TOTAL_VUS * 0.25));
const VUS_UPDATE = Math.max(1, TOTAL_VUS - VUS_QUERY - VUS_CREATE);

export const options = {
  insecureSkipTLSVerify: true,
  scenarios: {
    // Escenario 1: Consultas de Evaluación (60% del tráfico)
    scenario_query: {
      executor: 'ramping-vus',
      exec: 'execQueryFlow',
      startVUs: 1,
      stages: [
        { duration: RAMP_TIME, target: VUS_QUERY },
        { duration: HOLD_DURATION, target: VUS_QUERY },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
      gracefulStop: '30s',
    },

    // Escenario 2: Creación de Evaluaciones con id=0 (25% del tráfico)
    scenario_create: {
      executor: 'ramping-vus',
      exec: 'execCreateFlow',
      startVUs: 1,
      stages: [
        { duration: RAMP_TIME, target: VUS_CREATE },
        { duration: HOLD_DURATION, target: VUS_CREATE },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
      gracefulStop: '30s',
    },

    // Escenario 3: Actualización de Evaluaciones con id>0 (15% del tráfico)
    scenario_update: {
      executor: 'ramping-vus',
      exec: 'execUpdateFlow',
      startVUs: 1,
      stages: [
        { duration: RAMP_TIME, target: VUS_UPDATE },
        { duration: HOLD_DURATION, target: VUS_UPDATE },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
      gracefulStop: '30s',
    },
  },
  thresholds: config.thresholds,
};

/**
 * setup(): Login ÚNICO ejecutado 1 sola vez con credenciales de .env
 */
export function setup() {
  console.log(`[Load Setup] Login único en BFF con usuario de .env: '${config.auth.userName}'`);
  const authToken = login();
  console.log('[Load Setup] Token de sesión única obtenido para todos los VUs.');

  return {
    authToken: authToken,
  };
}

/**
 * Ejecutor 1: Consultas POST por assessmentCustomerId
 */
export function execQueryFlow(data) {
  const token = getAuthToken(data);
  const customerId = 1000 + (__VU % 100) + 1;
  executeGetAssessmentFlow(token, customerId);
}

/**
 * Ejecutor 2: Creación de evaluaciones (id=0)
 */
export function execCreateFlow(data) {
  const token = getAuthToken(data);
  executeCreateAssessmentFlow(token, baseTemplate);
}

/**
 * Ejecutor 3: Actualización de evaluaciones (id>0)
 */
export function execUpdateFlow(data) {
  const token = getAuthToken(data);
  const targetId = 1000 + (__VU % 50) + 1;
  executeUpdateAssessmentFlow(token, baseTemplate, targetId, targetId);
}

/**
 * Función por defecto en caso de ejecución simplificada (--vus / --iterations)
 */
export default function (data) {
  const token = getAuthToken(data);
  executeGetAssessmentFlow(token);
  const created = executeCreateAssessmentFlow(token, baseTemplate);
  if (created && created.createdId) {
    executeUpdateAssessmentFlow(token, baseTemplate, created.createdId, created.assessmentCustomerId);
  }
}

export function teardown(data) {
  console.log('[Load Teardown] Prueba de carga completada.');
}
