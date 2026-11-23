#!/usr/bin/env node
/**
 * ============================================================================
 * scripts/run-test.js - Ejecutor Rápido y Flexible para Pruebas k6
 * ============================================================================
 * Permite ejecutar cualquier escenario de carga pasando parámetros amigables:
 *
 * Ejemplos de uso:
 *   node scripts/run-test.js load 500 5m
 *   node scripts/run-test.js load request=500 time=5m
 *   node scripts/run-test.js spike request=300 time=1m
 *   node scripts/run-test.js stress max=400 time=3m
 *   node scripts/run-test.js create request=50 time=30s
 *   node scripts/run-test.js query request=100 time=1m
 */

const { spawn } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(`
Uso del Ejecutor Flexible de Pruebas k6:
  npm run test -- <escenario> [usuarios/requests] [tiempo]
  node scripts/run-test.js <escenario> [opciones]

Escenarios disponibles:
  - load        (Prueba de carga nominal con distribución 60/25/15)
  - spike       (Prueba de pico súbito 10 -> N VUs)
  - stress      (Prueba de estrés por escalones)
  - smoke       (Prueba de humo rápida 1-2 VUs)
  - soak        (Prueba de resistencia prolongada)
  - create      (Solo endpoint POST /api/evaluaciones id=0)
  - query       (Solo endpoint POST /api/evaluaciones/consulta)
  - login       (Solo endpoint POST /api/auth/login)

Formatos soportados:
  node scripts/run-test.js load 500 5m
  node scripts/run-test.js load request=500 time=5m
  node scripts/run-test.js spike request=200 time=1m
  node scripts/run-test.js create vus=20 time=30s
  node scripts/run-test.js load request=100 time=3m --no-prom  (sin Prometheus)
`);
  process.exit(0);
}

// 1. Mapeo del archivo de escenario
let scenarioRaw = args[0].toLowerCase().replace(/^--scenario=/, '');
const scenarioMap = {
  load: 'scenarios/load.js',
  spike: 'scenarios/spike.js',
  stress: 'scenarios/stress.js',
  smoke: 'scenarios/smoke.js',
  soak: 'scenarios/soak.js',
  create: 'scenarios/standalone_create.js',
  standalone_create: 'scenarios/standalone_create.js',
  query: 'scenarios/standalone_query.js',
  standalone_query: 'scenarios/standalone_query.js',
  login: 'scenarios/standalone_login.js',
  standalone_login: 'scenarios/standalone_login.js',
};

const scenarioFile = scenarioMap[scenarioRaw] || `scenarios/${scenarioRaw}.js`;

// 2. Parseo de parámetros (requests, vus, time, duration, token)
let requestsOrVus = null;
let durationOrTime = null;
let authToken = null;
let usePrometheus = true;

const extraArgs = [];

for (let i = 1; i < args.length; i++) {
  const arg = args[i];

  if (arg === '--no-prom' || arg === '--no-prometheus') {
    usePrometheus = false;
    continue;
  }

  // Patrón: request=500 o requests=500 o vus=500 o users=500 o max=500
  const vusMatch = arg.match(/^(?:--)?(?:requests?|vus?|users?|max|req)=([0-9]+)$/i);
  if (vusMatch) {
    requestsOrVus = vusMatch[1];
    continue;
  }

  // Patrón: time=5m o duration=5m o t=5m
  const timeMatch = arg.match(/^(?:--)?(?:time|duration|dur|t)=([0-9]+[smhd])$/i);
  if (timeMatch) {
    durationOrTime = timeMatch[1];
    continue;
  }

  // Patrón: token=xxx
  const tokenMatch = arg.match(/^(?:--)?(?:auth_)?token=(.+)$/i);
  if (tokenMatch) {
    authToken = tokenMatch[1];
    continue;
  }

  // Argumentos posicionales si no tienen clave=valor
  if (!arg.includes('=')) {
    if (/^[0-9]+$/.test(arg) && !requestsOrVus) {
      requestsOrVus = arg;
    } else if (/^[0-9]+[smhd]$/i.test(arg) && !durationOrTime) {
      durationOrTime = arg;
    } else {
      extraArgs.push(arg);
    }
  } else {
    extraArgs.push(arg);
  }
}

// 3. Construir variables de entorno k6 (-e) y flags de ejecución
const k6Args = ['run', '--insecure-skip-tls-verify'];

if (usePrometheus) {
  k6Args.push('-o', 'experimental-prometheus-rw');
}

if (requestsOrVus) {
  k6Args.push('-e', `VUS=${requestsOrVus}`);
  k6Args.push('-e', `REQUESTS=${requestsOrVus}`);
  k6Args.push('-e', `SPIKE_VUS=${requestsOrVus}`);
  k6Args.push('-e', `MAX_VUS=${requestsOrVus}`);
}

if (durationOrTime) {
  k6Args.push('-e', `DURATION=${durationOrTime}`);
  k6Args.push('-e', `TIME=${durationOrTime}`);
}

if (authToken) {
  k6Args.push('-e', `AUTH_TOKEN=${authToken}`);
}

k6Args.push(...extraArgs);
k6Args.push(scenarioFile);

console.log('\n============================================================');
console.log(`Ejecutando Escenario: ${scenarioRaw.toUpperCase()}`);
if (requestsOrVus) console.log(`- Usuarios/Requests : ${requestsOrVus}`);
if (durationOrTime) console.log(`- Duración/Tiempo   : ${durationOrTime}`);
console.log(`- Prometheus Stream : ${usePrometheus ? 'Habilitado (:9090)' : 'Deshabilitado'}`);
console.log(`- Comando k6        : k6 ${k6Args.join(' ')}`);
console.log('============================================================\n');

const env = {
  ...process.env,
  K6_PROMETHEUS_RW_SERVER_URL: process.env.K6_PROMETHEUS_RW_SERVER_URL || 'http://localhost:9090/api/v1/write',
  K6_PROMETHEUS_RW_TREND_STATS: process.env.K6_PROMETHEUS_RW_TREND_STATS || 'p(90),p(95),p(99),min,max',
};

const child = spawn('k6', k6Args, {
  env,
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => {
  process.exit(code);
});
