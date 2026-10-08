const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, 'evidencia_pruebas.json');
const jsonIntegracionPath = path.join(__dirname, 'evidencia_pruebas_integration.json');
const mdPath = path.join(__dirname, 'docs', 'Reporte_Pruebas_StockPilot.md');

if (!fs.existsSync(jsonPath)) {
    console.error('❌ No se encontró el archivo evidencia_pruebas.json. Asegúrate de ejecutar "npm run test:evidence" primero.');
    process.exit(1);
}

/** Lee un reporte JSON de vitest; null si no existe o no se pudo leer (integración es opcional). */
function leerReporte(rutaJson) {
    if (!fs.existsSync(rutaJson)) return null;
    try {
        return JSON.parse(fs.readFileSync(rutaJson, 'utf8'));
    } catch (e) {
        console.warn(`⚠️ No se pudo leer ${rutaJson}:`, e.message);
        return null;
    }
}

function duracionSegundos(data) {
    return (data.testResults.reduce((acc, res) => acc + (res.endTime - res.startTime), 0) / 1000).toFixed(2);
}

/** Agrega el detalle por módulo/flujo de un reporte al markdown, numerado como `${prefijo}.N`. */
function agregarDetalle(md, data, prefijo, tituloUnidad) {
    data.testResults.forEach((suite, i) => {
        const suiteName = path.basename(suite.name);
        const isSuccess = suite.status === 'passed';

        md += `### ${prefijo}.${i + 1} ${tituloUnidad}: \`${suiteName}\`\n`;
        md += `**Estado:** ${isSuccess ? '✅ Aprobado' : '❌ Fallido'}\n\n`;

        suite.assertionResults.forEach(test => {
            const statusIcon = test.status === 'passed' ? '✔️' : '❌';
            md += `- ${statusIcon} \`[Caso de Prueba]\` ${test.ancestorTitles.join(' > ')}: **${test.title}**\n`;
        });

        md += '\n';
    });
    return md;
}

try {
    const data = leerReporte(jsonPath);
    const dataIntegracion = leerReporte(jsonIntegracionPath);

    const date = new Date().toLocaleString('es-CO');

    const totalTests = data.numTotalTests;
    const passedTests = data.numPassedTests;
    const failedTests = data.numFailedTests;
    const duration = duracionSegundos(data);

    const totalTestsInt = dataIntegracion ? dataIntegracion.numTotalTests : 0;
    const passedTestsInt = dataIntegracion ? dataIntegracion.numPassedTests : 0;
    const failedTestsInt = dataIntegracion ? dataIntegracion.numFailedTests : 0;
    const durationInt = dataIntegracion ? duracionSegundos(dataIntegracion) : null;

    const totalCombinado = totalTests + totalTestsInt;
    const passedCombinado = passedTests + passedTestsInt;
    const failedCombinado = failedTests + failedTestsInt;

    let md = `---
title: Certificado de Pruebas Unitarias y Aseguramiento de Calidad
author: Sistema de Gestión de Inventario Inteligente (StockPilot)
date: ${date}
---

# 📄 Certificado Oficial de Calidad de Software y Pruebas Unitarias

**Proyecto:** StockPilot — Sistema de Gestión de Inventario Inteligente
**Fecha de Certificación:** ${date}
**Framework de Validación:** Vitest v4
**Entorno de Ejecución:** Node.js (V8 Engine)

---

## 1. Resumen Ejecutivo de Validación

El presente documento certifica la ejecución automatizada de la suite de pruebas **unitarias**${dataIntegracion ? ', más la de **integración** (contra Postgres real — `stockpilot_test` — aislada de desarrollo y producción)' : ''} sobre los módulos críticos (Lógica Financiera, Inteligencia Artificial y Seguridad) del sistema **StockPilot**. Las pruebas fueron diseñadas bajo el enfoque de validación de caja blanca, pruebas de límites${dataIntegracion ? ' y pruebas de integración de extremo a extremo (HTTP real sobre la aplicación completa, vía supertest)' : ''}.

### 1.1. Métricas de Ejecución Combinadas
- **Total de Escenarios Evaluados:** \`${totalCombinado}\`
- **Tasa de Éxito (Pass Rate):** \`${((passedCombinado / totalCombinado) * 100).toFixed(2)}%\`
- **Escenarios Exitosos:** \`${passedCombinado}\`
- **Escenarios Fallidos:** \`${failedCombinado}\`

### 1.2. Desglose por Tipo de Prueba

| Tipo | Escenarios | Exitosos | Fallidos | Latencia |
|---|---|---|---|---|
| Unitarias (\`npm test\`) | ${totalTests} | ${passedTests} | ${failedTests} | ${duration} s |
| Integración (\`npm run test:integration\`) | ${dataIntegracion ? totalTestsInt : 'N/D'} | ${dataIntegracion ? passedTestsInt : 'N/D'} | ${dataIntegracion ? failedTestsInt : 'N/D'} | ${dataIntegracion ? durationInt + ' s' : 'N/D'} |

`;

    md += dataIntegracion
        ? '> Las pruebas de integración corren contra `stockpilot_test`, una base Postgres real aislada de desarrollo y producción — protegida por un guard que aborta si `DATABASE_URL` no es, de forma verificable, una base de pruebas local (ver `tests/integration/setupTestDb.js`).\n\n'
        : '> ⚠️ **Nota:** esta generación no incluyó pruebas de integración (no se encontró `evidencia_pruebas_integration.json`, o la suite de integración falló al correr — revisa que `stockpilot_test` esté disponible y `.env.test` configurado). El certificado solo refleja la suite unitaria.\n\n';

    md += `### 1.3. Veredicto del Sistema\n`;

    if (failedCombinado === 0) {
        md += `> **[ESTADO: APROBADO]** ✅  \n> La integridad de los algoritmos predictivos, controles de acceso y matemática logística cumple con las especificaciones del diseño arquitectónico. El código está estabilizado y certificado como *Production-Ready* en el ámbito lógico.\n\n`;
    } else {
        md += `> **[ESTADO: RECHAZADO]** ❌  \n> Se detectaron anomalías en la lógica de negocio. Se requiere remediación inmediata en los módulos fallidos para garantizar la integridad de los datos.\n\n`;
    }

    md += `## 2. Detalle de Certificación por Módulo — Pruebas Unitarias (Matriz de Trazabilidad)\n\n`;
    md += `A continuación se detalla el comportamiento de cada componente sometido a estrés y validación lógica:\n\n`;
    md = agregarDetalle(md, data, '2', 'Módulo Subyacente');

    let siguienteSeccion = 3;
    if (dataIntegracion) {
        md += `\n---\n\n## 3. Detalle de Certificación por Flujo — Pruebas de Integración\n\n`;
        md += `Ejecutadas contra Postgres real (\`stockpilot_test\`), sobre la aplicación completa vía HTTP real (supertest) — sin mocks de base de datos:\n\n`;
        md = agregarDetalle(md, dataIntegracion, '3', 'Flujo');
        siguienteSeccion = 4;
    }

    md += `\n---\n\n`;
    md += `### ${siguienteSeccion}. Firma de Aprobación Automatizada\n`;
    md += `*Documento autogenerado por el pipeline de Integración Continua (CI) de StockPilot.*  \n`;
    md += `*Generado para su anexo como evidencia técnica en documento de grado.*`;

    fs.writeFileSync(mdPath, md);
    console.log(`✅ ¡Reporte Markdown generado con éxito en: ${mdPath}!`);
    if (dataIntegracion) {
        console.log(`   Incluye ${totalTestsInt} pruebas de integración además de las ${totalTests} unitarias (${totalCombinado} en total).`);
    } else {
        console.log(`   Solo unitarias (${totalTests}) — no se encontró evidencia_pruebas_integration.json.`);
    }

} catch (e) {
    console.error('Error generando reporte:', e);
    process.exitCode = 1; // que test:evidence no termine en verde si no se generó el reporte
}
