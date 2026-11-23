/**
 * ============================================================================
 * scenarios/smoke.js - Prueba de Humo (Smoke Test)
 * ============================================================================
 * Objetivo:
 * Validar la integridad funcional con carga mínima (1 a 2 VUs).
 *
 * Regla de autenticación:
 * El login se ejecuta estrictamente UNA VEZ en setup() con las credenciales
 * del archivo .env, y el token generado es utilizado por todos los flujos.
 */

import { config } from '../lib/config.js';
import { login, getAuthToken } from '../lib/auth.js';
import { executeCreateAssessmentFlow } from '../flows/create-record.js';
import { executeGetAssessmentFlow } from '../flows/search.js';
import { executeUpdateAssessmentFlow } from '../flows/update-record.js';

const baseTemplate = JSON.parse(open('../data/evaluacion.json'));

export const options = {
  insecureSkipTLSVerify: true,
  vus: parseInt(__ENV.VUS || '1', 10),
  duration: __ENV.DURATION || '1m',
  thresholds: config.thresholds,
};

/**
 * Fase setup(): Se ejecuta UNA SOLA VEZ antes de los VUs.
 * Obtiene el token único utilizando las credenciales de .env.
 */
export function setup() {
  console.log(`[Smoke Setup] Ejecutando login único en BFF (${config.baseUrlBff}) con usuario de .env: '${config.auth.userName}'`);
  const authToken = login();
  console.log('[Smoke Setup] Login único completado con éxito. Token obtenido.');

  return {
    authToken: authToken,
  };
}

/**
 * Ejecución del VU: Reutiliza el token único del setup
 */
export default function (setupData) {
  const token = getAuthToken(setupData);

  // 1. Crear Evaluación (id=0) con el token del login
  const creationResult = executeCreateAssessmentFlow(token, baseTemplate);
  const createdId = creationResult.createdId;
  const customerId = creationResult.assessmentCustomerId;

  // 2. Consultar Evaluación con el mismo token
  executeGetAssessmentFlow(token, customerId);

  // 3. Actualizar Evaluación (id>0) con el mismo token
  executeUpdateAssessmentFlow(token, baseTemplate, createdId, customerId);
}

export function teardown(setupData) {
  console.log('[Smoke Teardown] Prueba de humo finalizada.');
}
