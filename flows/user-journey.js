/**
 * ============================================================================
 * flows/user-journey.js - Flujo Encadenado de Usuario de Extremo a Extremo
 * ============================================================================
 * Demuestra la correlación completa utilizando el token único del .env:
 * 1. El token JWT se obtiene desde el login (BFF) usando credenciales de .env.
 * 2. El token se inyecta en la cabecera 'Authorization: Bearer <token>' para:
 *    - Creación de la evaluación (POST /api/evaluaciones con id=0).
 *    - Consulta de la evaluación (POST /api/evaluaciones/consulta con { assessmentCustomerId }).
 *    - Actualización de la evaluación (POST /api/evaluaciones con id>0).
 */

import { executeCreateAssessmentFlow } from './create-record.js';
import { executeGetAssessmentFlow } from './search.js';
import { executeUpdateAssessmentFlow } from './update-record.js';
import { getAuthToken } from '../lib/auth.js';

/**
 * Ejecuta el ciclo de vida completo de un usuario con correlación de token e IDs
 * @param {object} setupData Datos provistos por setup()
 */
export function executeCompleteUserJourney(setupData = null) {
  // 1. Obtener el token originado en el Login único de setup() desde .env
  const token = getAuthToken(setupData);

  // 2. Crear Registro de Evaluación utilizando estrictamente el token del login
  const created = executeCreateAssessmentFlow(token);

  // 3. Consultar la misma evaluación enviando el assessmentCustomerId con el mismo token
  executeGetAssessmentFlow(token, created.assessmentCustomerId);

  // 4. Actualizar la evaluación en el mismo endpoint con el mismo token
  executeUpdateAssessmentFlow(token, null, created.createdId, created.assessmentCustomerId);

  return {
    token,
    createdId: created.createdId,
    assessmentCustomerId: created.assessmentCustomerId,
  };
}

export default executeCompleteUserJourney;
