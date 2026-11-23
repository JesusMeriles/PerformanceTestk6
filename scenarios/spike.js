/**
 * ============================================================================
 * scenarios/spike.js - Prueba de Pico / Disparo Súbito (Spike Test)
 * ============================================================================
 * Regla de autenticación:
 * El login se ejecuta UNA SOLA VEZ en setup() con las credenciales de .env.
 *
 * Perfil:
 * 10 VUs → 200 VUs en 10 segundos, sostener 1 min, volver a 10 VUs
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

// Parámetros configurables desde la CLI:
// Base VUs (antes del pico)
const BASE_VUS = parseInt(__ENV.BASE_VUS || __ENV.BASE || '10', 10);

// Pico de VUs / Requests (default: 200)
// Soporta: SPIKE_VUS, REQUESTS, REQ, VUS, USERS, SPIKE, PEAK
const SPIKE_VUS = parseInt(
  __ENV.SPIKE_VUS || __ENV.REQUESTS || __ENV.REQ || __ENV.VUS || __ENV.USERS || __ENV.SPIKE || __ENV.PEAK || '200',
  10
);

// Tiempo de duración en la meseta del pico (default: 1m)
// Soporta: DURATION, TIME, DUR, T, HOLD
const SPIKE_HOLD = __ENV.DURATION || __ENV.TIME || __ENV.DUR || __ENV.T || __ENV.HOLD || '1m';

// Tiempo en la línea base tras la recuperación (default: 1m)
const BASE_HOLD = __ENV.BASE_HOLD || __ENV.BASE_TIME || '1m';

const baseTargets = {
  query: Math.max(1, Math.round(BASE_VUS * 0.60)),
  create: Math.max(1, Math.round(BASE_VUS * 0.25)),
  update: Math.max(1, BASE_VUS - Math.round(BASE_VUS * 0.60) - Math.round(BASE_VUS * 0.25)),
};

const spikeTargets = {
  query: Math.max(1, Math.round(SPIKE_VUS * 0.60)),
  create: Math.max(1, Math.round(SPIKE_VUS * 0.25)),
  update: Math.max(1, SPIKE_VUS - Math.round(SPIKE_VUS * 0.60) - Math.round(SPIKE_VUS * 0.25)),
};

export const options = {
  insecureSkipTLSVerify: true,
  scenarios: {
    spike_query: {
      executor: 'ramping-vus',
      exec: 'execQueryFlow',
      startVUs: 1,
      stages: [
        { duration: '30s', target: baseTargets.query },
        { duration: '10s', target: spikeTargets.query },
        { duration: SPIKE_HOLD, target: spikeTargets.query },
        { duration: '10s', target: baseTargets.query },
        { duration: BASE_HOLD, target: baseTargets.query },
        { duration: '15s', target: 0 },
      ],
      gracefulRampDown: '15s',
      gracefulStop: '15s',
    },

    spike_create: {
      executor: 'ramping-vus',
      exec: 'execCreateFlow',
      startVUs: 1,
      stages: [
        { duration: '30s', target: baseTargets.create },
        { duration: '10s', target: spikeTargets.create },
        { duration: SPIKE_HOLD, target: spikeTargets.create },
        { duration: '10s', target: baseTargets.create },
        { duration: BASE_HOLD, target: baseTargets.create },
        { duration: '15s', target: 0 },
      ],
      gracefulRampDown: '15s',
      gracefulStop: '15s',
    },

    spike_update: {
      executor: 'ramping-vus',
      exec: 'execUpdateFlow',
      startVUs: 1,
      stages: [
        { duration: '30s', target: baseTargets.update },
        { duration: '10s', target: spikeTargets.update },
        { duration: SPIKE_HOLD, target: spikeTargets.update },
        { duration: '10s', target: baseTargets.update },
        { duration: BASE_HOLD, target: baseTargets.update },
        { duration: '15s', target: 0 },
      ],
      gracefulRampDown: '15s',
      gracefulStop: '15s',
    },
  },
  thresholds: config.thresholds,
};

export function setup() {
  console.log(`[Spike Setup] Login único en BFF con usuario de .env: '${config.auth.userName}'`);
  const authToken = login();
  console.log('[Spike Setup] Token único obtenido para la prueba de pico.');
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
  console.log('[Spike Teardown] Prueba de pico completada.');
}
