#!/usr/bin/env node

/**
 * Script para probar la conexión a WispHub API
 * 
 * Uso:
 *   npm run test:wisphub
 *   # o
 *   node scripts/test-wisphub-connection.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Lee la configuración desde las variables de entorno
const WISPHUB_API_URL = process.env.WISPHUB_API_URL || '';
const WISPHUB_API_KEY = process.env.WISPHUB_API_KEY || '';

if (!WISPHUB_API_URL || !WISPHUB_API_KEY) {
    console.error('❌ Error: WISPHUB_API_URL y WISPHUB_API_KEY deben estar configurados en el archivo .env');
    process.exit(1);
}

async function testWispHubEndpoints() {
    console.log(`
=================================================
    DIAGNÓSTICO DE CONEXIÓN A WISPHUB API
=================================================
Fecha: ${new Date().toLocaleString()}
URL Base: ${WISPHUB_API_URL}
=================================================
`);

    // Lista de endpoints a probar
    const endpoints = [
        { path: 'clientes?limit=1', name: 'Listado de Clientes' },
        { path: 'puntos-pago', name: 'Puntos de Pago' },
        { path: 'clientes/morosos', name: 'Clientes Morosos' },
        { path: 'servicios/mantenimientos', name: 'Mantenimientos Programados' },
        // Añadir más endpoints según sea necesario
    ];

    const results = [];

    for (const endpoint of endpoints) {
        const url = `${WISPHUB_API_URL}${endpoint.path}`;
        console.log(`\n🔍 Probando endpoint: ${endpoint.name}`);
        console.log(`📡 URL: ${url}`);

        try {
            const start = Date.now();
            const response = await axios.get(url, {
                headers: { 'Authorization': WISPHUB_API_KEY },
                timeout: 5000 // 5 segundos máximo
            });
            const responseTime = Date.now() - start;

            console.log(`✅ ÉXITO (${responseTime}ms)`);
            console.log(`📊 Estado: ${response.status} ${response.statusText}`);

            // Verificamos si la respuesta tiene resultados
            const hasResults = response.data &&
                (Array.isArray(response.data.results) ||
                    Object.keys(response.data).length > 0);

            if (hasResults) {
                const count = Array.isArray(response.data.results)
                    ? response.data.results.length
                    : 'N/A';
                console.log(`📋 Datos recibidos: ${count} resultados`);
            } else {
                console.log(`⚠️ Respuesta vacía o sin datos`);
            }

            results.push({
                endpoint: endpoint.name,
                url,
                status: 'success',
                responseTime,
                statusCode: response.status,
                hasData: hasResults
            });
        } catch (error) {
            console.log(`❌ ERROR`);

            if (error.response) {
                // Error con respuesta del servidor
                console.log(`📊 Estado: ${error.response.status} ${error.response.statusText}`);
                console.log(`📝 Mensaje: ${JSON.stringify(error.response.data)}`);
            } else if (error.request) {
                // Error sin respuesta del servidor
                console.log(`📝 Error: No se recibió respuesta del servidor`);
            } else {
                // Error en la configuración de la solicitud
                console.log(`📝 Error: ${error.message}`);
            }

            results.push({
                endpoint: endpoint.name,
                url,
                status: 'error',
                error: error.message,
                statusCode: error.response?.status || 'N/A',
                details: error.response?.data || {}
            });
        }
    }

    console.log(`
=================================================
    RESUMEN DE DIAGNÓSTICO
=================================================`);

    const successCount = results.filter(r => r.status === 'success').length;
    const totalEndpoints = results.length;

    console.log(`✅ Endpoints exitosos: ${successCount}/${totalEndpoints}`);
    console.log(`❌ Endpoints con error: ${totalEndpoints - successCount}/${totalEndpoints}`);

    if (successCount === totalEndpoints) {
        console.log(`\n🎉 ¡TODOS LOS ENDPOINTS FUNCIONAN CORRECTAMENTE!`);
    } else if (successCount === 0) {
        console.log(`\n🚨 ¡NINGÚN ENDPOINT ESTÁ FUNCIONANDO!`);
        console.log(`   Verifique la configuración de API_URL y API_KEY`);
    } else {
        console.log(`\n⚠️ ALGUNOS ENDPOINTS PRESENTAN ERRORES`);

        // Listar los endpoints con error
        console.log(`\nEndpoints con error:`);
        results.filter(r => r.status === 'error').forEach(r => {
            console.log(`- ${r.endpoint}: ${r.error}`);
        });
    }

    // Guardar resultados en un archivo de log
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }

    const logFile = path.join(logDir, 'wisphub-diagnostic.log');
    const logData = {
        timestamp: new Date().toISOString(),
        baseUrl: WISPHUB_API_URL,
        results,
        summary: {
            total: totalEndpoints,
            success: successCount,
            failed: totalEndpoints - successCount
        }
    };

    fs.writeFileSync(logFile, JSON.stringify(logData, null, 2));
    console.log(`\n📝 Resultados guardados en: ${logFile}`);
}

// Ejecutar el diagnóstico
testWispHubEndpoints()
    .catch(error => {
        console.error('Error general durante el diagnóstico:', error);
        process.exit(1);
    });
