/**
 * ============================================================================
 * flows/search.js - Flujo de Consulta / Obtención de Evaluación (Query API)
 * ============================================================================
 * Regla de negocio: La obtención de la evaluación se realiza mediante un POST
 * a la URL de consulta enviando el payload:
 * {
 *   "assessmentCustomerId": <id>
 * }
 * Utiliza estrictamente el token JWT obtenido del Login en la cabecera:
 * Authorization: Bearer <token_del_login>
 * y retorna la evaluación correlacionada correspondiente.
 */

import http from 'k6/http';
import { check, group, fail } from 'k6';
import { config } from '../lib/config.js';
import { authHeaders, getAuthToken } from '../lib/auth.js';
import { realisticSleep, randomInt } from '../lib/helpers.js';

/**
 * Ejecuta el flujo de consulta de evaluación mediante POST
 * @param {string} token Token JWT obtenido del login (si es null, lo resuelve automáticamente)
 * @param {number} assessmentCustomerId ID del cliente de la evaluación a consultar
 * @returns {object} Datos de la evaluación recuperada
 */
export function executeGetAssessmentFlow(token = null, assessmentCustomerId = null) {
  // Asegurar que se utilice el token de autenticación del login
  const activeToken = token || getAuthToken();

  if (!activeToken) {
    fail('[Query Flow] No se dispone de un token JWT válido de login.');
  }

  let assessmentData = null;

  group('Flujo 04 - Consultar Evaluación (POST Query)', function () {
    const url = `${config.baseUrlQuery}${config.endpoints.query}`;
    const customerId = assessmentCustomerId || randomInt(1001, 1050);

    const payload = JSON.stringify({
      assessmentCustomerId: Number(customerId),
    });

    const params = {
      headers: authHeaders(activeToken),
      tags: {
        name: 'POST /api/evaluaciones/consulta',
        flow: 'get_assessment',
      },
    };

    const res = http.post(url, payload, params);

    const checkOk = check(res, {
      'consulta: status HTTP es 200': (r) => r.status === 200,
      'consulta: tiempo respuesta < 600ms': (r) => r.timings.duration < 600,
      'consulta: assessmentCustomerId coincide o está presente': (r) => {
        try {
          const body = r.json();
          return body && (
            body.assessmentCustomerId === Number(customerId) ||
            body.assessmentCustomerId !== undefined ||
            body.data !== undefined
          );
        } catch (e) {
          return false;
        }
      },
    });

    if (!checkOk) {
      fail(`[Query Flow] Fallo al consultar evaluación con token de login para customerId ${customerId}. HTTP ${res.status}: ${res.body}`);
    }

    assessmentData = res.json();
    realisticSleep();
  });

  return assessmentData;
}

export default executeGetAssessmentFlow;
