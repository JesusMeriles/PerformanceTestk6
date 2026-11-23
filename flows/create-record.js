/**
 * ============================================================================
 * flows/create-record.js - Flujo de Creación de Evaluación (BFF)
 * ============================================================================
 * Regla de negocio: Para crear, el objeto envía 'id: 0'.
 * Utiliza estrictamente el token JWT obtenido del Login en la cabecera:
 * Authorization: Bearer <token_del_login>
 *
 * Genera datos de arrays de forma aleatoria (llenos/vacíos) y correlaciona
 * el ID y assessmentCustomerId devueltos por el servidor.
 */

import http from 'k6/http';
import { check, group, fail } from 'k6';
import { config } from '../lib/config.js';
import { authHeaders, getAuthToken } from '../lib/auth.js';
import { generateAssessmentPayload, realisticSleep } from '../lib/helpers.js';

// Carga perezosa de la plantilla por defecto si no es proporcionada
let defaultBaseTemplate = null;
try {
  defaultBaseTemplate = JSON.parse(open('../data/evaluacion.json'));
} catch (e) {}

/**
 * Ejecuta el flujo de creación de evaluación
 * @param {string} token Token JWT obtenido del login (si es null, lo resuelve automáticamente)
 * @param {object} baseTemplate Plantilla JSON base (opcional)
 * @returns {object} { createdId, assessmentCustomerId }
 */
export function executeCreateAssessmentFlow(token = null, baseTemplate = null) {
  // Asegurar que se utilice el token de autenticación del login
  const activeToken = token || getAuthToken();
  const template = baseTemplate || defaultBaseTemplate;

  if (!activeToken) {
    fail('[Create Flow] No se dispone de un token JWT válido de login.');
  }

  let result = null;

  group('Flujo 02 - Crear Evaluación (id=0)', function () {
    const url = `${config.baseUrlBff}${config.endpoints.assessment}`;

    // Generar payload con id: 0 y arrays aleatorios según requerimiento
    const payloadObject = generateAssessmentPayload(template, {
      isUpdate: false,
      randomizeArrays: true,
    });

    const payload = JSON.stringify(payloadObject);
    const params = {
      headers: authHeaders(activeToken),
      tags: {
        name: 'POST /api/evaluaciones (create)',
        flow: 'create_assessment',
      },
    };

    const res = http.post(url, payload, params);

    const checkOk = check(res, {
      'crear: status HTTP es 200 o 201': (r) => r.status === 201 || r.status === 200,
      'crear: tiempo respuesta < 800ms': (r) => r.timings.duration < 800,
      'crear: id generado devuelto': (r) => {
        try {
          const body = r.json();
          return !!(body && (body.id || body.data?.id));
        } catch (e) {
          return false;
        }
      },
      'crear: assessmentCustomerId presente': (r) => {
        try {
          const body = r.json();
          return body && (body.assessmentCustomerId !== undefined || body.data?.assessmentCustomerId !== undefined);
        } catch (e) {
          return false;
        }
      },
    });

    if (!checkOk) {
      fail(`[Create Flow] Error al crear evaluación con token de login. HTTP ${res.status}: ${res.body}`);
    }

    const body = res.json();
    const createdId = body.id || (body.data && body.data.id);
    const assessmentCustomerId = body.assessmentCustomerId || (body.data && body.data.assessmentCustomerId) || payloadObject.assessmentCustomerId;

    result = {
      createdId: Number(createdId),
      assessmentCustomerId: Number(assessmentCustomerId),
    };

    realisticSleep();
  });

  return result;
}

export default executeCreateAssessmentFlow;
