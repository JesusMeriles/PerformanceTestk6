import http from 'k6/http';
import { check, group, fail } from 'k6';
import { config } from '../lib/config.js';
import { realisticSleep } from '../lib/helpers.js';

let memoizedToken = null;

/**
 * Ejecuta el flujo de login utilizando las credenciales de .env
 * @returns {string} Token JWT
 */
export function executeLoginFlow() {
  if (memoizedToken) {
    return memoizedToken;
  }

  group('Flujo 01 - Autenticación BFF (.env)', function () {
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
        name: 'POST /api/auth/login',
        flow: 'login',
      },
    };

    const res = http.post(url, payload, params);

    const checkOk = check(res, {
      'login: status HTTP es 200': (r) => r.status === 200,
      'login: tiempo respuesta < 1000ms': (r) => r.timings.duration < 1000,
      'login: token JWT recibido en body': (r) => {
        try {
          const body = r.json();
          return !!(body && (body.token || body.accessToken || body.jwt));
        } catch (e) {
          return false;
        }
      },
    });

    if (!checkOk) {
      fail(`[Login Flow] Fallo crítico al autenticar usuario '${config.auth.userName}' desde .env. HTTP ${res.status}: ${res.body}`);
    }

    const body = res.json();
    memoizedToken = body.token || body.accessToken || body.jwt;

    realisticSleep();
  });

  return memoizedToken;
}

export default executeLoginFlow;