/**
 * ============================================================================
 * scenarios/stress.js - Prueba de Estrés (Stress Test)
 * ============================================================================
 * Regla de autenticación:
 * El login se ejecuta UNA SOLA VEZ en setup() con las credenciales de .env.
 *
 * Perfil:
 * Escalones progresivos con meseta: 50 → 100 → 200 → 300 VUs
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

// Multiplicador o tope máximo parametrizable (Default: 300 VUs)
// Soporta: MAX_VUS, REQUESTS, REQ, VUS, USERS, MAX
const MAX_STRESS_VUS = parseInt(
  __ENV.MAX_VUS || __ENV.REQUESTS || __ENV.REQ || __ENV.VUS || __ENV.USERS || __ENV.MAX || '300',
  10
);

// Tiempo de meseta por cada escalón (default: 3m)
// Soporta: DURATION, TIME, DUR, STEP_TIME
const STEP_HOLD = __ENV.DURATION || __ENV.TIME || __ENV.DUR || __ENV.STEP_TIME || '3m';

// Tiempo de rampa de subida entre escalones (default: 2m)
const RAMP_TIME = __ENV.RAMP_TIME || __ENV.RAMP || '2m';

function getStageTargets(ratio) {
  const t = Math.max(1, Math.round(MAX_STRESS_VUS * ratio));
  return {
    query: Math.max(1, Math.round(t * 0.60)),
    create: Math.max(1, Math.round(t * 0.25)),
    update: Math.max(1, t - Math.round(t * 0.60) - Math.round(t * 0.25)),
  };
}

const s1 = getStageTargets(50 / 300);   // ~50 VUs
const s2 = getStageTargets(100 / 300);  // ~100 VUs
const s3 = getStageTargets(200 / 300);  // ~200 VUs
const s4 = getStageTargets(300 / 300);  // ~300 VUs

export const options = {
  insecureSkipTLSVerify: true,
  scenarios: {
    stress_query: {
      executor: 'ramping-vus',
      exec: 'execQueryFlow',
      startVUs: 1,
      stages: [
        { duration: RAMP_TIME, target: s1.query },
        { duration: STEP_HOLD, target: s1.query },
        { duration: RAMP_TIME, target: s2.query },
        { duration: STEP_HOLD, target: s2.query },
        { duration: RAMP_TIME, target: s3.query },
        { duration: STEP_HOLD, target: s3.query },
        { duration: RAMP_TIME, target: s4.query },
        { duration: STEP_HOLD, target: s4.query },
        { duration: RAMP_TIME, target: 0 },
      ],
      gracefulRampDown: '30s',
      gracefulStop: '30s',
    },

    stress_create: {
      executor: 'ramping-vus',
      exec: 'execCreateFlow',
      startVUs: 1,
      stages: [
        { duration: RAMP_TIME, target: s1.create },
        { duration: STEP_HOLD, target: s1.create },
        { duration: RAMP_TIME, target: s2.create },
        { duration: STEP_HOLD, target: s2.create },
        { duration: RAMP_TIME, target: s3.create },
        { duration: STEP_HOLD, target: s3.create },
        { duration: RAMP_TIME, target: s4.create },
        { duration: STEP_HOLD, target: s4.create },
        { duration: RAMP_TIME, target: 0 },
      ],
      gracefulRampDown: '30s',
      gracefulStop: '30s',
    },

    stress_update: {
      executor: 'ramping-vus',
      exec: 'execUpdateFlow',
      startVUs: 1,
      stages: [
        { duration: RAMP_TIME, target: s1.update },
        { duration: STEP_HOLD, target: s1.update },
        { duration: RAMP_TIME, target: s2.update },
        { duration: STEP_HOLD, target: s2.update },
        { duration: RAMP_TIME, target: s3.update },
        { duration: STEP_HOLD, target: s3.update },
        { duration: RAMP_TIME, target: s4.update },
        { duration: STEP_HOLD, target: s4.update },
        { duration: RAMP_TIME, target: 0 },
      ],
      gracefulRampDown: '30s',
      gracefulStop: '30s',
    },
  },
  thresholds: config.thresholds,
};

export function setup() {
  console.log(`[Stress Setup] Login único en BFF con usuario de .env: '${config.auth.userName}'`);
  const authToken = login();
  console.log('[Stress Setup] Token único obtenido para la prueba de estrés.');
  return { authToken };
}

export function execQueryFlow(data) {
  const token = getAuthToken(data);
  const customerId = 1000 + (__VU % 150) + 1;
  executeGetAssessmentFlow(token, customerId);
}

export function execCreateFlow(data) {
  const token = getAuthToken(data);
  executeCreateAssessmentFlow(token, baseTemplate);
}

export function execUpdateFlow(data) {
  const token = getAuthToken(data);
  const targetId = 1000 + (__VU % 100) + 1;
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
  console.log('[Stress Teardown] Prueba de estrés completada.');
}
