/**
 * ============================================================================
 * lib/helpers.js - Utilidades, Generación Dinámica y Think Time para k6
 * ============================================================================
 * Incluye:
 * - Think time aleatorio (sleep realista).
 * - Generador de IDs únicos mediante __VU e __ITER.
 * - Generador dinámico de evaluaciones (creación id=0, actualización id>0,
 *   y aleatorización de arrays vacíos / llenos).
 * - Manejo robusto de checks y correlación con fail() ante errores críticos.
 */

import { sleep, check, fail } from 'k6';
import { config } from './config.js';

/**
 * Retorna un entero pseudo-aleatorio entre min y max (ambos inclusive)
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Retorna un flotante redondeado a N decimales
 */
export function randomFloat(min, max, decimals = 2) {
  const str = (Math.random() * (max - min) + min).toFixed(decimals);
  return parseFloat(str);
}

/**
 * Retorna un elemento aleatorio de un arreglo
 */
export function randomChoice(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Think time realista: pausa la ejecución un tiempo aleatorio entre min y max
 */
export function realisticSleep(min = config.thinkTime.min, max = config.thinkTime.max) {
  const duration = Math.random() * (max - min) + min;
  sleep(duration);
}

/**
 * Genera un identificador único determinista combinando VU, iteración y timestamp
 */
export function getUniqueEntityName(prefix = 'TEST') {
  return `${prefix}_VU${__VU}_IT${__ITER}_${Date.now() % 100000}`;
}

/**
 * Generador dinámico del payload de evaluación a partir de la plantilla base
 * 
 * Reglas de negocio del usuario:
 * 1. Para crear: id = 0.
 * 2. Para actualizar: id = número positivo (mismo endpoint).
 * 3. Variación de instancias con campos de arrays [] vacíos o llenos de forma aleatoria.
 * 
 * @param {object} baseTemplate Plantilla JSON cargada desde data/evaluacion.json
 * @param {object} options Opciones de personalización
 * @param {boolean} options.isUpdate Si es true, envía id > 0 para actualizar; si es false, id = 0
 * @param {number} options.assessmentId ID para actualización
 * @param {boolean} options.randomizeArrays Si es true, alterna arrays vacíos o poblados
 * @returns {object} Payload listo para enviar por HTTP POST
 */
export function generateAssessmentPayload(baseTemplate, options = {}) {
  const {
    isUpdate = false,
    assessmentId = 0,
    randomizeArrays = true,
  } = options;

  // Clonación profunda de la plantilla base
  const payload = JSON.parse(JSON.stringify(baseTemplate));

  // Regla de ID: 0 para crear, número para actualizar
  const targetId = isUpdate ? (assessmentId > 0 ? assessmentId : randomInt(1001, 9999)) : 0;
  payload.id = targetId;
  payload.assessmentCustomerId = isUpdate
    ? targetId
    : (__VU * 10000 + __ITER + randomInt(1, 999));

  // Generación de etiquetas únicas para evitar colisión de datos
  const uniqueTag = `VU${__VU}_IT${__ITER}_${randomInt(10, 99)}`;

  // Función interna para decidir si un array debe ir vacío o con datos
  const shouldPopulate = (arrayName) => {
    if (!randomizeArrays) return true;
    // 70% de probabilidad de tener datos, 30% de ir vacío para simular distintas instancias
    return Math.random() > 0.3;
  };

  // 1. Amounts
  if (!shouldPopulate('amounts')) {
    payload.amounts = [];
  } else {
    payload.amounts = [
      { conceptId: randomInt(1, 5), amount: randomFloat(5000, 50000) },
      { conceptId: randomInt(6, 10), amount: randomFloat(1000, 15000) },
    ];
  }

  // 2. Data
  if (!shouldPopulate('data')) {
    payload.data = [];
  } else {
    payload.data = [
      { conceptId: 10, value: `Evaluación de Negocio ${uniqueTag}` },
      { conceptId: 20, value: `Sector Comercio / Textil` },
    ];
  }

  // 3. Inventory
  if (!shouldPopulate('inventory')) {
    payload.inventory = [];
  } else {
    payload.inventory = payload.inventory.map((item, idx) => ({
      ...item,
      id: targetId === 0 ? 0 : randomInt(1, 500),
      idApp: idx + 1,
      productName: `Material Textil ${uniqueTag}_${idx + 1}`,
      quantity: randomInt(20, 200),
      cost: randomFloat(10, 80),
      totalCost: randomFloat(500, 5000),
      recordStatus: true,
    }));
  }

  // 4. Employees
  if (!shouldPopulate('employees')) {
    payload.employees = [];
  } else {
    payload.employees = [
      {
        idApp: 1,
        id: targetId === 0 ? 0 : randomInt(1, 500),
        jobType: randomInt(1, 4),
        quantityEmployee: randomInt(1, 10),
        quantityMonths: 12,
        monthlyCost: randomFloat(1200, 4500),
        recordStatus: true,
      },
    ];
  }

  // 5. Debts
  if (!shouldPopulate('debts')) {
    payload.debts = [];
  } else {
    payload.debts = [
      {
        idApp: 1,
        id: targetId === 0 ? 0 : randomInt(1, 500),
        typeOfDebt: randomInt(1, 3),
        creditorType: 1,
        creditorName: randomInt(1, 5),
        originalAmount: randomFloat(3000, 20000),
        paymentFrequency: 30,
        installmentAmount: randomFloat(200, 1000),
        balance: randomFloat(1000, 15000),
        debtConsolidation: Math.random() > 0.5,
        otherCreditorName: `Financiera Local ${uniqueTag}`,
        monthlyInstallment: randomFloat(200, 1000),
        recordStatus: true,
      },
    ];
  }

  // 6. Assets
  if (!shouldPopulate('assets')) {
    payload.assets = [];
  } else {
    payload.assets = [
      {
        idApp: 1,
        id: targetId === 0 ? 0 : randomInt(1, 500),
        activityType: 1,
        assetClassification: 2,
        assetType: 1,
        description: `Maquinaria Operativa ${uniqueTag}`,
        marketValue: randomFloat(1500, 10000),
        assetIdentifier: `EQ-${uniqueTag}`,
        licensePlate: 'N/A',
        recordStatus: true,
      },
    ];
  }

  // 7. Products
  if (!shouldPopulate('products')) {
    payload.products = [];
  } else {
    payload.products = [
      {
        idApp: 1,
        id: targetId === 0 ? 0 : randomInt(1, 500),
        productName: `Prenda Terminada ${uniqueTag}`,
        hasCostSheet: true,
        hasInventory: true,
        quantity: randomInt(50, 500),
        unit: 1,
        frequency: 30,
        purchasePrice: randomFloat(10, 25),
        sellingPrice: randomFloat(30, 70),
        finishedProductsInventory: true,
        processedProductsInventory: true,
        calculateUnitCost: true,
        productionUnit: 1,
        productionQuantity: randomInt(50, 500),
        withWaste: 5,
        productionCost: randomFloat(1000, 5000),
        waste: 2,
        totalProductionCost: randomFloat(1020, 5100),
        unitCost: randomFloat(12, 30),
        monthlyCost: randomFloat(1000, 5000),
        monthlySales: randomFloat(2500, 15000),
        mub: randomFloat(40, 65),
        recordStatus: true,
        idAppProduct: 1,
        productionUnitSell: 1,
        productionQuantitySell: randomInt(50, 500),
        clarification: `Lote producido en prueba ${uniqueTag}`,
        supplies: [
          {
            idApp: 1,
            id: targetId === 0 ? 0 : randomInt(1, 500),
            supplyName: `Insumo Principal ${uniqueTag}`,
            inventory: true,
            quantity: randomInt(100, 1000),
            purchaseUnit: 1,
            purchasePrice: randomFloat(0.5, 5),
            quantityUnitProduced: 2,
            costUnit: randomFloat(1, 10),
            recordStatus: true,
          },
        ],
      },
    ];
  }

  // 8. Dependents
  if (!shouldPopulate('dependents')) {
    payload.dependents = [];
  } else {
    payload.dependents = [
      {
        idApp: 1,
        id: targetId === 0 ? 0 : randomInt(1, 500),
        relation: 1,
        quantity: randomInt(1, 4),
        recordStatus: true,
      },
    ];
  }

  // 9. Maintenance
  if (!shouldPopulate('maintenance')) {
    payload.maintenance = [];
  } else {
    payload.maintenance = [
      {
        idApp: 1,
        id: targetId === 0 ? 0 : randomInt(1, 500),
        classification: 1,
        machineType: 1,
        totalMaintenanceCost: randomFloat(50, 300),
        recordStatus: true,
        supplies: [
          {
            idApp: 1,
            supply: 1,
            id: targetId === 0 ? 0 : randomInt(1, 500),
            purchaseUnit: 1,
            quantity: randomInt(1, 5),
            purchasePrice: randomFloat(10, 50),
            frequency: 90,
            cost: randomFloat(20, 100),
            recordStatus: true,
          },
        ],
      },
    ];
  }

  return payload;
}

/**
 * Ejecuta validaciones check() robustas con registro de fallas
 * Si una validación de correlación crítica falla, aborta la iteración con fail()
 */
export function validateResponse(res, checksMap, critical = false, stepName = 'Step') {
  const checkSuccess = check(res, checksMap);

  if (!checkSuccess && critical) {
    fail(`[${stepName}] Fallo crítico de correlación o validación HTTP. Status: ${res.status}. Body: ${res.body ? res.body.substring(0, 200) : 'vacio'}`);
  }

  return checkSuccess;
}

export default {
  randomInt,
  randomFloat,
  randomChoice,
  realisticSleep,
  getUniqueEntityName,
  generateAssessmentPayload,
  validateResponse,
};

