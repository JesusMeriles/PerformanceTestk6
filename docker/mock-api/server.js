const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'performance-test-secret-key-k6';

app.use(express.json({ limit: '10mb' }));

// Almacenamiento en memoria para simular sesiones y evaluaciones
const activeTokensByUser = new Map();
let assessmentSequence = 1000;
const assessmentsDatabase = new Map();
const assessmentsByCustomer = new Map();

// Middleware de verificación de JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acceso no autorizado: Token no proporcionado' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido o expirado' });
    }

    // Regla de negocio: Si el usuario inició sesión de nuevo, el token anterior queda invalidado
    const currentActiveToken = activeTokensByUser.get(decoded.userName);
    if (currentActiveToken && currentActiveToken !== token) {
      return res.status(401).json({
        error: 'Sesión invalidada: Se ha iniciado sesión desde otra instancia y el token ha cambiado'
      });
    }

    req.user = decoded;
    next();
  });
};

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

// 1. Endpoint de Login (BFF)
// Payload esperado: { "userName": "", "password": "", "ipAddress": "1", "deviceId": "hkAb" }
app.post('/api/auth/login', (req, res) => {
  const { userName, password, ipAddress, deviceId } = req.body || {};

  const user = userName || req.body.email;
  if (!user || !password) {
    return res.status(400).json({ error: 'userName y password son requeridos' });
  }

  const tokenPayload = {
    userName: user,
    role: 'evaluator',
    deviceId: deviceId || 'hkAb',
    ipAddress: ipAddress || '1',
    sub: user
  };

  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1h' });
  activeTokensByUser.set(user, token);

  return res.status(200).json({
    token,
    tokenType: 'Bearer',
    expiresIn: 3600,
    user: {
      userName: user,
      role: 'evaluator',
      deviceId: deviceId || 'hkAb'
    }
  });
});

// 2. Endpoint de Envío / Actualización de Evaluaciones (BFF)
// Regla: Si id === 0 se crea y devuelve un nuevo id; si id > 0 se actualiza el registro existente
app.post('/api/evaluaciones', authenticateToken, (req, res) => {
  const payload = req.body;

  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Cuerpo de la evaluación inválido' });
  }

  // Si la petición viene únicamente con assessmentCustomerId (sin campos de evaluación), tratar como consulta
  if (payload.assessmentCustomerId && !payload.amounts && !payload.inventory && !payload.products) {
    return handleQueryAssessment(req, res, payload.assessmentCustomerId);
  }

  const delay = Math.floor(Math.random() * 25) + 10;
  setTimeout(() => {
    const isUpdate = payload.id && Number(payload.id) > 0;
    const customerId = payload.assessmentCustomerId || (isUpdate ? payload.id : ++assessmentSequence);

    let assignedId;
    if (isUpdate) {
      assignedId = Number(payload.id);
      const record = {
        ...payload,
        id: assignedId,
        assessmentCustomerId: customerId,
        updatedAt: new Date().toISOString(),
        updatedBy: req.user.userName
      };
      assessmentsDatabase.set(assignedId, record);
      assessmentsByCustomer.set(customerId, record);

      return res.status(200).json({
        success: true,
        operation: 'UPDATE',
        message: 'Evaluación actualizada exitosamente',
        id: assignedId,
        assessmentCustomerId: customerId,
        timestamp: new Date().toISOString()
      });
    } else {
      assignedId = ++assessmentSequence;
      const record = {
        ...payload,
        id: assignedId,
        assessmentCustomerId: customerId,
        createdAt: new Date().toISOString(),
        createdBy: req.user.userName
      };
      assessmentsDatabase.set(assignedId, record);
      assessmentsByCustomer.set(customerId, record);

      return res.status(201).json({
        success: true,
        operation: 'CREATE',
        message: 'Evaluación creada exitosamente',
        id: assignedId,
        assessmentCustomerId: customerId,
        timestamp: new Date().toISOString()
      });
    }
  }, delay);
});

// Función auxiliar para responder a la consulta de evaluación por assessmentCustomerId
function handleQueryAssessment(req, res, customerId) {
  const cid = Number(customerId);
  const delay = Math.floor(Math.random() * 20) + 5;

  setTimeout(() => {
    // Buscar si existe en la base de datos simulada
    const existing = assessmentsByCustomer.get(cid) || assessmentsDatabase.get(cid);

    if (existing) {
      return res.status(200).json(existing);
    }

    // Si no está en memoria, devolver la estructura estándar solicitada por el usuario
    return res.status(200).json({
      assessmentCustomerId: cid,
      amounts: [
        { conceptId: 1, amounts: 15000 }
      ],
      data: [
        { conceptId: 10, value: `Evaluación Correlacionada ${cid}` }
      ],
      products: [
        {
          id: 1,
          assessmentCustomerId: cid,
          productName: `Prenda Industrial ${cid}`,
          hasCostSheet: true,
          hasInventory: true,
          quantity: 100,
          unit: 1,
          frequency: 30,
          purchasePrice: 15,
          sellingPrice: 35,
          finishedProductsInventory: true,
          processedProductsInventory: true,
          calculateUnitCost: true,
          productionUnit: 1,
          productionQuantity: 100,
          withWaste: 0,
          productionCost: 1500,
          waste: 0,
          totalProductionCost: 1500,
          unitCost: 15,
          monthlyCost: 1500,
          monthlySales: 3500,
          mub: 57.14,
          recordStatus: true,
          idProduct: 1,
          productionUnitSell: 1,
          productionQuantitySell: 100,
          clarification: "Consulta simulada",
          supplies: [
            {
              id: 1,
              supplyName: "Insumo Test",
              inventory: true,
              quantity: 200,
              purchaseUnit: 1,
              purchasePrice: 2,
              quantityUnitProduced: 2,
              costUnit: 4,
              recordStatus: true
            }
          ]
        }
      ],
      employees: [
        {
          id: 1,
          assessmentCustomerId: cid,
          jobType: 1,
          quantityEmployee: 2,
          quantityMonths: 12,
          monthlyCost: 1800,
          recordStatus: true
        }
      ],
      debts: [
        {
          id: 1,
          balance: 3500,
          creditorType: 1,
          creditorName: 1,
          debtConsolidation: true,
          installmentAmount: 250,
          originalAmount: 5000,
          paymentFrequency: 30,
          typeOfDebt: 2,
          otherCreditorName: "Banco",
          monthlyInstallment: 250,
          recordStatus: true
        }
      ],
      assets: [
        {
          id: 1,
          activityType: 1,
          assetClassification: 2,
          assetType: 1,
          description: "Equipo Principal",
          marketValue: 2000,
          recordStatus: true
        }
      ]
    });
  }, delay);
}

// 3. Endpoint de Consulta de Evaluación mediante POST (Query API)
// Request: { "assessmentCustomerId": 623 }
app.post('/api/evaluaciones/consulta', authenticateToken, (req, res) => {
  const { assessmentCustomerId } = req.body || {};
  if (!assessmentCustomerId && assessmentCustomerId !== 0) {
    return res.status(400).json({ error: 'assessmentCustomerId es requerido en el body' });
  }
  return handleQueryAssessment(req, res, assessmentCustomerId);
});

// Endpoint GET de listado general (compatibilidad)
app.get('/api/evaluaciones', authenticateToken, (req, res) => {
  const { limit = 20, page = 1 } = req.query;
  const list = Array.from(assessmentsDatabase.values());
  res.status(200).json({
    success: true,
    data: list.slice(0, Number(limit)),
    total: list.length
  });
});

app.listen(PORT, () => {
  console.log(`Mock Assessment API corriendo en el puerto ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
