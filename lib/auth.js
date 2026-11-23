/**
 * ============================================================================
 * lib/auth.js - Módulo de Autenticación k6 (Single-Session JWT desde .env)
 * ============================================================================
 * REGLA DE NEGOCIO CRÍTICA:
 * El login SOLO debe ejecutarse UNA VEZ utilizando las credenciales de .env
 * (API_USER, API_PASS, API_IP_ADDRESS, API_DEVICE_ID).
 * Si se realizara login nuevamente, el token previo quedaría invalidado.
 *
 * El token único obtenido se almacena y se comparte con todos los VUs
 * a través de la fase setup().
 */

import http from 'k6/http';
import { check, fail } from 'k6';
import encoding from 'k6/encoding';
import { config } from './config.js';

// Cache de sesión a nivel de instancia
let sharedToken = null;

/**
 * Decodifica el payload de un token JWT usando k6/encoding
 * @param {string} token 
 * @returns {object|null}
 */
export function decodeJwt(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    const decodedStr = encoding.b64decode(base64, 'rawstd', 's');
    return JSON.parse(decodedStr);
  } catch (e) {
    return null;
  }
}

/**
 * Verifica si el token ha expirado
 * @param {string} token 
 * @param {number} marginSeconds
 * @returns {boolean}
 */
export function isTokenExpired(token, marginSeconds = 30) {
  const payload = decodeJwt(token);
  if (!payload || !payload.exp) return false;
  const now = Math.floor(Date.now() / 1000);
  return (payload.exp - marginSeconds) <= now;
}

/**
 * Genera las cabeceras estándar para peticiones autenticadas
 * @param {string} token 
 * @returns {object}
 */
export function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

/**
 * Ejecuta el login ÚNICAMENTE con las credenciales configuradas en .env
 * @returns {string} Token JWT único
 */
export function login() {
  // Si ya se obtuvo el token en esta instancia, reusarlo para no invalidar la sesión
  if (sharedToken) {
    return sharedToken;
  }

  const url = `${config.baseUrlBff}${config.endpoints.login}`;
  const payload = JSON.stringify({
    userName: config.auth.userName,
    password: config.auth.password,
    ipAddress: config.auth.ipAddress,
    deviceId: config.auth.deviceId,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    tags: {
      name: 'POST /api/auth/login (once)',
      flow: 'login',
    },
  };

  const res = http.post(url, payload, params);

  const loginSuccess = check(res, {
    'login: status es 200': (r) => r.status === 200,
    'login: token presente en respuesta': (r) => {
      try {
        const body = r.json();
        return body && (body.token || body.accessToken || body.jwt);
      } catch (e) {
        return false;
      }
    },
  });

  if (!loginSuccess) {
    fail(`Fallo crítico al autenticar usuario '${config.auth.userName}' desde .env: HTTP ${res.status} - ${res.body}`);
  }

  const jsonBody = res.json();
  sharedToken = jsonBody.token || jsonBody.accessToken || jsonBody.jwt;
  return sharedToken;
}

/**
 * Obtiene el token de autenticación originado en setup()
 * @param {object} setupData Objeto devuelto por setup()
 * @returns {string} Token único
 */
export function getAuthToken(setupData = null) {
  // 1. Si se proporcionó un token manual mediante CLI/ENV (--no-setup)
  if (__ENV.AUTH_TOKEN) {
    return __ENV.AUTH_TOKEN;
  }
  // 2. Si se originó en setupData
  if (setupData && setupData.authToken) {
    return setupData.authToken;
  }
  // 3. Si ya se guardó en memoria en la instancia
  if (sharedToken) {
    return sharedToken;
  }
  // 4. Fallback automático con credenciales de .env
  return login();
}

export default {
  login,
  authHeaders,
  decodeJwt,
  isTokenExpired,
  getAuthToken,
};
