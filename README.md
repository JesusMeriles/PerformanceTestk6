# Framework de Pruebas de Rendimiento k6 + Prometheus + Grafana + BDD Cucumber

Proyecto integral de pruebas de carga, estrés, picos y resistencia para el sistema de evaluaciones financieras y transaccionales, con observabilidad en tiempo real y capa ejecutiva BDD.

---

## 1. Arquitectura de la Solución

El framework se compone de cuatro pilares desacoplados:
1. **Generador de Carga (Grafana k6):** Ejecuta scripts parametrizados en JavaScript modular, con thresholds como única fuente de verdad y cálculo de percentiles ($P_{90}$, $P_{95}$, $P_{99}$).
2. **Capa Ejecutiva BDD (@cucumber/cucumber):** Expresa objetivos de negocio en Gherkin de alto nivel y valida el cumplimiento estricto de thresholds vía código de salida y reportes HTML ejecutivos.
3. **Pila de Observabilidad (Docker):**
   - **Prometheus (v2.54):** Recibe métricas en streaming vía `--web.enable-remote-write-receiver`.
   - **Grafana (v11.0):** Dashboard provisionado automáticamente con 6 paneles clave en el puerto `3001`.
   - **cAdvisor (v0.49):** Monitorea CPU y RAM de los contenedores en tiempo real.
4. **Servicio Bajo Prueba (BFF & Query API):** Maneja la regla de sesión única (single-token) y el contrato de evaluación con `id: 0` (crear) e `id > 0` (actualizar).

```
k6-performance-project/
├── data/
│   ├── evaluacion.json       # Estructura del JSON de evaluación real provista
│   ├── users.json            # Pool de usuarios para estrategias multi-VU
│   └── search-terms.csv      # Términos de búsqueda parametrizados
├── lib/
│   ├── config.js             # Configuración centralizada de __ENV y thresholds
│   ├── auth.js               # Manejo de token único, decodificación JWT y 4 estrategias
│   └── helpers.js            # Generador dinámico de arrays, id:0 / id>0 y think time
├── flows/
│   ├── login.js              # Flujo de autenticación BFF ({ userName, password, ... })
│   ├── create-record.js      # Creación de evaluación (id=0) con correlación de ID devuelto
│   ├── update-record.js      # Actualización de evaluación (id>0) en el mismo endpoint
│   └── search.js             # Consulta de evaluación vía POST { assessmentCustomerId }
├── scenarios/
│   ├── smoke.js              # Validación mínima de integridad (1-2 VUs, 1 min)
│   ├── load.js               # Carga nominal (50 VUs, rampa 2m + meseta 10m + bajada 1m)
│   ├── stress.js             # Carga progresiva por escalones (50 → 100 → 200 → 300 VUs)
│   ├── spike.js              # Disparo abrupto (10 → 200 VUs en 10s)
│   └── soak.js               # Resistencia prolongada (30 VUs por 30-60 min)
├── features/
│   ├── performance.feature   # Criterios BDD en lenguaje Gherkin de alto nivel
│   ├── steps/perf.steps.js   # Step definitions que ejecutan k6 con execSync
│   └── support/world.js      # World y timeouts para pruebas de larga duración
├── docker/
│   ├── docker-compose.yml    # Prometheus, Grafana, cAdvisor y Mock API
│   ├── prometheus.yml        # Configuración de scrape y remote-write receiver
│   ├── grafana/provisioning/ # Auto-provisioning de datasources y dashboards
│   └── mock-api/             # Servidor Node.js local con la lógica exacta de evaluación
├── dashboards/
│   └── k6-performance-dashboard.json # Tablero exportado de Grafana
├── report/
│   ├── INFORME_TECNICO_RENDIMIENTO.md # Plantilla completa del informe técnico
│   ├── cucumber.html         # Reporte visual HTML generado por Cucumber
│   └── *.json                # Resúmenes de métricas k6 exportados
├── .env.example              # Variables de entorno documentadas
├── .env                      # Configuración local activa
├── .gitignore                # Exclusión de credenciales y binarios
└── package.json              # Dependencias y scripts npm reproducibles
```

---

## 2. Requisitos Previos

- **Node.js:** Versión $\ge 18$ LTS (recomendado Node 20 o 22).
- **Grafana k6:** Versión $\ge 0.45$ instalada en el sistema (`k6 version`).
- **Docker Desktop:** Con motor Docker Compose disponible.

---

## 3. Configuración Inicial

1. Clona el repositorio e instala las dependencias de Node:
   ```powershell
   npm install
   ```

2. Configura las variables de entorno en `.env` (copiando desde `.env.example`):
   ```ini
   # URLs Base desacopladas
   BASE_URL_BFF=http://localhost:3000
   BASE_URL_QUERY=http://localhost:3000

   # Endpoints
   ENDPOINT_LOGIN=/api/auth/login
   ENDPOINT_ASSESSMENT=/api/evaluaciones
   ENDPOINT_QUERY=/api/evaluaciones/consulta

   # Credenciales de autenticación BFF
   API_USER=admin
   API_PASS=Testing123*
   API_IP_ADDRESS=1
   API_DEVICE_ID=hkAb

   # Estrategia de autenticación (1: setup compartido, 2: por VU, 3: pool en setup, 4: por iteración)
   AUTH_STRATEGY=1

   # Servidor Prometheus Remote Write
   K6_PROMETHEUS_RW_SERVER_URL=http://localhost:9090/api/v1/write
   K6_PROMETHEUS_RW_TREND_STATS=p(90),p(95),p(99),min,max
   ```

---

## 4. Despliegue de Observabilidad y Servicios

Levanta la pila de observabilidad y la API de prueba con un solo comando:
```powershell
# Iniciar Prometheus, Grafana, cAdvisor y Mock API
npm run docker:up

# Verificar el estado de los contenedores
npm run docker:status
```

### URLs de Acceso Rápido:
- **Grafana:** [http://localhost:3001](http://localhost:3001) (Dashboard listo: `k6 Performance Testing & System Monitoring`)
- **Prometheus:** [http://localhost:9090](http://localhost:9090)
- **cAdvisor:** [http://localhost:8080](http://localhost:8080)
- **API Mock / Backend:** [http://localhost:3000/health](http://localhost:3000/health)

---

## 5. Ejecución de Pruebas de Rendimiento

Puedes ejecutar las pruebas pasando la **cantidad de usuarios/requests** y el **tiempo/duración** directamente en el comando:

### A. Ejecutor Flexible y Rápido (Recomendado)
Soporta formatos tipo `request=500 time=5m` o posicional `500 5m`:

```powershell
# 1. Carga nominal: 500 requests/usuarios durante 5 minutos
npm run test -- load request=500 time=5m
# O forma corta:
node scripts/run-test.js load 500 5m

# 2. Pico súbito (Spike): salto a 300 requests/usuarios sosteniendo 2 minutos
npm run test -- spike request=300 time=2m
# O forma corta:
node scripts/run-test.js spike 300 2m

# 3. Estrés escalonado: hasta 500 requests/usuarios máximos
npm run test -- stress max=500 time=3m
# O forma corta:
node scripts/run-test.js stress 500 3m

# 4. Solo creación de evaluación (id=0): 50 usuarios durante 30 segundos
npm run test -- create request=50 time=30s

# 5. Solo consulta de evaluación: 100 usuarios durante 1 minuto
npm run test -- query request=100 time=1m

# Tip: Si no tienes Prometheus levantado, añade --no-prom al final:
npm run test -- load request=50 time=1m --no-prom
```

### B. Ejecución Directa con npm / k6 (mediante variables -e)
```powershell
# Carga nominal (Load) con 500 VUs durante 10 minutos
npm run load -- -e VUS=500 -e TIME=10m

# Pico súbito (Spike) con 300 VUs en el pico durante 2 minutos
npm run spike -- -e SPIKE_VUS=300 -e TIME=2m

# Estrés escalonado (Stress) hasta 400 VUs
npm run stress -- -e MAX_VUS=400 -e TIME=3m

# Ejecución nativa con k6 directamente:
k6 run --insecure-skip-tls-verify -e VUS=500 -e TIME=5m scenarios/load.js
k6 run --insecure-skip-tls-verify -e SPIKE_VUS=200 -e TIME=1m scenarios/spike.js
```

### C. Ejecución BDD con Cucumber (Reportes Ejecutivos)
```powershell
# Ejecutar toda la suite BDD
npm run bdd

# Ejecutar por etiqueta específica
npm run bdd:smoke
npm run bdd:load
npm run bdd:stress
npm run bdd:spike
```

El reporte HTML visual se genera automáticamente en: `report/cucumber.html`.

---

## 6. Monitoreo y Guía de Capturas en Grafana

### Paneles Incluidos en el Dashboard:
1. **Throughput (RPS):** `sum(rate(k6_http_reqs_total[10s]))`
2. **Latencias Percentiles:** $P_{90}$, $P_{95}$, $P_{99}$ en milisegundos.
3. **Tasa de Errores HTTP:** Porcentaje de fallos sobre el total de peticiones.
4. **VUs Activos:** Curva de usuarios virtuales concurrentes en el tiempo.
5. **Latencia P95 por Tag `name`:** Desglose individual de cada endpoint para aislar cuellos de botella.
6. **Consumo de CPU y Memoria (cAdvisor):** Métricas de hardware de los contenedores.

### Cómo Verificar Nombres de Métricas en Prometheus:
1. Ingresa a [http://localhost:9090/graph](http://localhost:9090/graph).
2. En la barra de búsqueda, escribe `k6_` para autocompletar todas las series temporales enviadas por k6 vía remote-write:
   - `k6_http_req_duration_milliseconds`
   - `k6_http_reqs_total`
   - `k6_vus`
   - `k6_checks_total`
3. Escribe `container_cpu_usage_seconds_total` para verificar las métricas de cAdvisor.

### Cómo Importar el Dashboard Comunitario Oficial de k6:
Si deseas una vista alternativa adicional:
1. En Grafana, ve a **Dashboards** → **New** → **Import**.
2. Ingresa el ID comunitario: `19665` (k6 Prometheus Dashboard) o `2587`.
3. Selecciona la fuente de datos `Prometheus` y haz clic en **Import**.

### Procedimiento para Tomar Capturas de Evidencia:
1. Durante la meseta de carga máxima del escenario (ej. minuto 5 de `load` o pico de `spike`):
2. Ajusta el selector de tiempo en Grafana a: `Last 15 minutes` y refresco en `5s`.
3. Haz clic en el título de cada panel → **View** para pantalla completa.
4. Toma la captura y guárdala en `report/screenshots/` con el nombre correspondiente (`smoke_grafana.png`, `load_grafana.png`, `stress_grafana.png`, `spike_grafana.png`).

---

## 7. Diagnóstico de Cuellos de Botella

Utiliza la siguiente matriz para interpretar los resultados de tus pruebas:

| Síntoma en Métricas | Diagnóstico Técnico | Solución Recomendada |
|---|---|---|
| Latencia sube con VUs y CPU baja (< 30%) | Bloqueo en Base de Datos o saturación del pool de conexiones. | Optimizar consultas SQL, crear índices y aumentar `poolSize` de BD. |
| CPU del contenedor al 100% | Cuello de botella de cómputo (serialización JSON, criptografía o regex). | Optimizar código, utilizar streams/parsers eficientes o escalado horizontal. |
| Timeouts o errores 5xx tras cierto nivel de VUs | Agotamiento del socket backlog, descriptores de archivos o threads. | Ajustar `ulimit -n` en Linux, aumentar `worker_connections` o hilos de Node/Java. |
| Memoria RAM creciente en prueba Soak | Fuga de memoria (Memory Leak) en la aplicación. | Tomar heap dump con Node Inspector / VisualVM y corregir variables globales. |

---

## 8. Detener el Entorno

Cuando finalices tus pruebas, puedes detener los contenedores con:
```powershell
npm run docker:down
```

