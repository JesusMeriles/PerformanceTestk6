/**
 * ============================================================================
 * features/steps/perf.steps.js - Step Definitions BDD para k6
 * ============================================================================
 * Capa delgada de BDD:
 * - Background verifica la salud del BFF y de Prometheus.
 * - Los steps 'When' invocan k6 mediante execSync con las variables del entorno,
 *   activando la exportación a Prometheus y el resumen JSON.
 * - Los steps 'Then' validan que k6 retorne código 0 (thresholds superados).
 */

const { Given, When, Then } = require('@cucumber/cucumber');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// ----------------------------------------------------------------------------
// Background Steps
// ----------------------------------------------------------------------------
Given('que la API BFF y el servicio de consulta están disponibles', async function () {
  const bffUrl = process.env.BASE_URL_BFF || 'http://localhost:3000';
  const healthEndpoint = `${bffUrl}/health`;

  try {
    const res = await fetch(healthEndpoint, { method: 'GET' });
    assert.strictEqual(
      res.ok,
      true,
      `El servicio BFF no respondió adecuadamente en ${healthEndpoint}. Status: ${res.status}`
    );
  } catch (err) {
    // Si la app real no implementa /health, intentar validar conectividad con la URL base
    try {
      const fallback = await fetch(bffUrl, { method: 'GET' });
      assert.ok(fallback.status < 500, `Servicio BFF no alcanzable en ${bffUrl}`);
    } catch (e) {
      throw new Error(`No se pudo conectar con el servicio BFF en ${bffUrl}: ${err.message}`);
    }
  }
});

Given('que el servidor Prometheus está listo para recibir métricas', async function () {
  const promUrl = 'http://localhost:9090/-/healthy';

  try {
    const res = await fetch(promUrl, { method: 'GET' });
    assert.strictEqual(
      res.ok,
      true,
      `Prometheus no está saludable en ${promUrl}. Status: ${res.status}`
    );
  } catch (err) {
    console.warn(`[Aviso Observabilidad] Prometheus no respondió en ${promUrl}. Se continuará la prueba si k6 está en modo standalone.`);
  }
});

// ----------------------------------------------------------------------------
// When Steps (Ejecución de k6)
// ----------------------------------------------------------------------------
function runK6Command(world, scenarioFile, customEnv = {}) {
  const rootDir = path.resolve(__dirname, '../../');
  const scenarioPath = path.join(rootDir, 'scenarios', scenarioFile);
  const scenarioKey = path.basename(scenarioFile, '.js');
  const summaryPath = path.join(rootDir, 'report', `${scenarioKey}.json`);

  // Asegurar que el directorio report/ exista
  const reportDir = path.join(rootDir, 'report');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  world.scenarioName = scenarioKey;
  world.summaryExportPath = summaryPath;

  const env = {
    ...process.env,
    K6_PROMETHEUS_RW_SERVER_URL: process.env.K6_PROMETHEUS_RW_SERVER_URL || 'http://localhost:9090/api/v1/write',
    K6_PROMETHEUS_RW_TREND_STATS: process.env.K6_PROMETHEUS_RW_TREND_STATS || 'p(90),p(95),p(99),min,max',
    ...customEnv,
  };

  const command = `k6 run --insecure-skip-tls-verify --summary-export="${summaryPath}" -o experimental-prometheus-rw "${scenarioPath}"`;
  console.log(`\n[Cucumber Exec] Ejecutando: ${command}`);

  try {
    const output = execSync(command, {
      cwd: rootDir,
      env: env,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    world.exitCode = 0;
    world.k6Stdout = output;
  } catch (error) {
    world.exitCode = error.status || 1;
    world.k6Stdout = error.stdout ? error.stdout.toString() : '';
    world.k6Stderr = error.stderr ? error.stderr.toString() : error.message;
    console.error(`[Cucumber Error] k6 finalizó con código de error ${world.exitCode}:`, world.k6Stderr);
  }
}

When('ejecuto el escenario {string} con {int} usuarios virtuales durante {string}', function (scenario, vus, duration) {
  runK6Command(this, `${scenario}.js`, {
    VUS: String(vus),
    DURATION: duration,
  });
});

When('ejecuto el escenario {string} con {int} usuarios virtuales máximos', function (scenario, maxVus) {
  runK6Command(this, `${scenario}.js`, {
    MAX_VUS: String(maxVus),
  });
});

When('ejecuto el escenario {string} con pico súbito de {int} usuarios virtuales', function (scenario, spikeVus) {
  runK6Command(this, `${scenario}.js`, {
    SPIKE_VUS: String(spikeVus),
  });
});

// ----------------------------------------------------------------------------
// Then Steps (Validaciones de Thresholds y Reportes)
// ----------------------------------------------------------------------------
Then('los thresholds de rendimiento de k6 deben cumplirse con código de salida 0', function () {
  assert.strictEqual(
    this.exitCode,
    0,
    `Los thresholds de k6 no se cumplieron o la prueba falló. Código de salida: ${this.exitCode}.\nSalida k6:\n${this.k6Stdout}\nError:\n${this.k6Stderr}`
  );
});

Then('el reporte de ejecución debe generarse en {string}', function (expectedReportFile) {
  const rootDir = path.resolve(__dirname, '../../');
  const fullPath = path.join(rootDir, expectedReportFile);

  assert.ok(
    fs.existsSync(fullPath),
    `El archivo de resumen de k6 no fue generado en ${fullPath}`
  );

  const rawJson = fs.readFileSync(fullPath, 'utf-8');
  const summary = JSON.parse(rawJson);
  this.summaryData = summary;

  console.log(`[Cucumber Report] Resumen cargado exitosamente desde ${expectedReportFile}`);
  if (summary.metrics && summary.metrics['http_req_duration']) {
    const dur = summary.metrics['http_req_duration'];
    const p95 = dur['p(95)'] !== undefined ? dur['p(95)'] : (dur.values ? dur.values['p(95)'] : null);
    if (p95 !== null && p95 !== undefined) {
      console.log(`[Métrica P95 Global]: ${Number(p95).toFixed(2)} ms`);
    }
  }
});

