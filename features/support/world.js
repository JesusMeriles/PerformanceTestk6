/**
 * ============================================================================
 * features/support/world.js - Cucumber World & Configuración Global
 * ============================================================================
 * Define el timeout por defecto para pruebas de carga prolongadas y carga
 * variables de entorno desde .env.
 */

const { setWorldConstructor, setDefaultTimeout } = require('@cucumber/cucumber');
const dotenv = require('dotenv');
const path = require('path');

// Cargar variables de entorno desde .env si existe
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Timeout de Cucumber: 30 minutos (para permitir que los escenarios de k6 completen sus mesetas)
setDefaultTimeout(30 * 60 * 1000);

class PerformanceWorld {
  constructor() {
    this.scenarioName = null;
    this.exitCode = null;
    this.k6Stdout = null;
    this.k6Stderr = null;
    this.summaryExportPath = null;
    this.summaryData = null;
  }
}

setWorldConstructor(PerformanceWorld);

