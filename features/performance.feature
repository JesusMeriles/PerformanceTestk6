# language: es
Característica: Evaluación de Rendimiento y Capacidad del Sistema de Evaluación
  Como ingeniero senior de rendimiento
  Quiero evaluar la resiliencia, latencias y estabilidad de la API BFF y de consultas
  Para asegurar el cumplimiento de los Acuerdos de Nivel de Servicio (SLAs) antes del pase a producción

  Antecedentes: Verificación de Disponibilidad de Servicios
    Dado que la API BFF y el servicio de consulta están disponibles
    Y que el servidor Prometheus está listo para recibir métricas

  @smoke
  Escenario: Validación de integridad con prueba de humo (Smoke Test)
    Cuando ejecuto el escenario "smoke" con 1 usuarios virtuales durante "10s"
    Entonces los thresholds de rendimiento de k6 deben cumplirse con código de salida 0
    Y el reporte de ejecución debe generarse en "report/smoke.json"

  @load
  Escenario: Evaluación de rendimiento bajo carga nominal (Load Test)
    Cuando ejecuto el escenario "load" con 50 usuarios virtuales durante "10m"
    Entonces los thresholds de rendimiento de k6 deben cumplirse con código de salida 0
    Y el reporte de ejecución debe generarse en "report/load.json"

  @stress
  Escenario: Determinación del punto de quiebre bajo estrés (Stress Test)
    Cuando ejecuto el escenario "stress" con 300 usuarios virtuales máximos
    Entonces los thresholds de rendimiento de k6 deben cumplirse con código de salida 0
    Y el reporte de ejecución debe generarse en "report/stress.json"

  @spike
  Escenario: Resiliencia ante picos súbitos de tráfico (Spike Test)
    Cuando ejecuto el escenario "spike" con pico súbito de 200 usuarios virtuales
    Entonces los thresholds de rendimiento de k6 deben cumplirse con código de salida 0
    Y el reporte de ejecución debe generarse en "report/spike.json"

