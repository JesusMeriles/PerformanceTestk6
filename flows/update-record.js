/**
 * ============================================================================
 * flows/update-record.js - Flujo de Actualización de Evaluación (BFF)
 * ============================================================================
 * Regla de negocio: Para actualizar se utiliza el mismo endpoint enviando
 * un ID numérico positivo (id > 0).
 * Utiliza estrictamente el token JWT obtenido del Login en la cabecera:
 * Authorization: Bearer <token_del_login>
 */

import http from 'k6/http';
import { check, group, fail } from 'k6';
import { config } from '../lib/config.js';
import { authHeaders, getAuthToken } from '../lib/auth.js';
import { generateAssessmentPayload, realisticSleep } from '../lib/helpers.js';

let defaultBaseTemplate = null;
try {
  defaultBaseTemplate = JSON.parse(open('../data/evaluacion.json'));
} catch (e) {}

/**
 * Ejecuta el flujo de actualización de evaluación
 * @param {string} token Token JWT obtenido del login (si es null, lo resuelve automáticamente)
 * @param {object} baseTemplate Plantilla JSON base de la evaluación
 * @param {number} assessmentId ID numérico de la evaluación a actualizar
 * @param {number} customerId ID de cliente de la evaluación
 * @returns {boolean} Éxito de la operación
 */
export function executeUpdateAssessmentFlow(token = null, baseTemplate = null, assessmentId = null, customerId = null) {
  const activeToken = token || getAuthToken();
  const template = baseTemplate || defaultBaseTemplate;

  if (!activeToken) {
    fail('[Update Flow] No se dispone de un token JWT válido de login.');
  }

  let success = false;

  group('Flujo 03 - Actualizar Evaluación (id>0)', function () {
    const url = `${config.baseUrlBff}${config.endpoints.assessment}`;
    const targetId = Number(assessmentId) || 1001;

    // Generar payload con id > 0 para forzar la lógica de actualización
    const payloadObject = generateAssessmentPayload(template, {
      isUpdate: true,
      assessmentId: targetId,
      randomizeArrays: true,
    });

    if (customerId) {
      payloadObject.assessmentCustomerId = customerId;
    }

    const payload = JSON.stringify(payloadObject);
    const params = {
      headers: authHeaders(activeToken),
      tags: {
        name: 'POST /api/evaluaciones (update)',
        flow: 'update_assessment',
      },
    };

    const res = http.post(url, payload, params);

    const checkOk = check(res, {
      'actualizar: status HTTP es 200': (r) => r.status === 200,
      'actualizar: tiempo respuesta < 800ms': (r) => r.timings.duration < 800,
      'actualizar: confirmación recibida': (r) => {
        try {
          const body = r.json();
          return body && (body.success === true || body.operation === 'UPDATE' || body.id === targetId);
        } catch (e) {
          return false;
        }
      },
    });

    if (!checkOk) {
      fail(`[Update Flow] Error al actualizar evaluación ID ${targetId} con token de login. HTTP ${res.status}: ${res.body}`);
    }

    success = true;
    realisticSleep();
  });

  return success;
}

export default executeUpdateAssessmentFlow;
