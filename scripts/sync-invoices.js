const path = require('path');
const fs = require('fs');

// Configuración de la API
const API_KEY = 'Api-Key mHHsEQKX.Uc1BQzXFOCXUno64ZTM9K4vaDPjH9gLq';
const API_URL = 'https://api.wisphub.app/api/facturas/';

async function syncInvoices() {
    const axios = require('axios');
    const cacheFilePath = path.join(process.cwd(), 'invoices_cache.json');

    console.log('🚀 Iniciando sincronización completa de facturas...');
    console.log(`📁 Archivo de caché: ${cacheFilePath}`);

    try {
        // Calcular rango de fechas para los últimos 12 meses
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 12);

        const start = startDate.toISOString().split('T')[0];
        const end = endDate.toISOString().split('T')[0];

        console.log(`📅 Descargando facturas del ${start} al ${end}`);

        // Obtener todas las facturas
        const allInvoices = [];
        let nextUrl = `${API_URL}?fecha_emision_after=${start}&fecha_emision_before=${end}&limit=300`;
        let page = 1;
        const maxPages = 50; // Límite de páginas

        while (nextUrl && page <= maxPages && allInvoices.length < 10000) {
            console.log(`📄 Descargando página ${page} - Total facturas: ${allInvoices.length}`);

            const response = await axios.get(nextUrl, {
                headers: {
                    'Authorization': API_KEY,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });

            if (response.data && response.data.results) {
                const pageInvoices = response.data.results;
                allInvoices.push(...pageInvoices);

                console.log(`✅ Página ${page} descargada: ${pageInvoices.length} facturas`);

                // Obtener siguiente página
                nextUrl = response.data.next;
                page++;

                // Pausa para no sobrecargar la API
                if (nextUrl) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } else {
                console.log('⚠️ Respuesta de API sin datos válidos');
                break;
            }
        }

        console.log(`📊 Descarga completa: ${allInvoices.length} facturas obtenidas`);

        // Normalizar facturas
        const normalizedInvoices = allInvoices.map(invoice => ({
            id: invoice.id?.toString() || 'unknown',
            numero: invoice.numero || invoice.id?.toString(),
            amount: parseFloat(invoice.monto) || 0,
            monto: parseFloat(invoice.monto) || 0,
            dueDate: new Date(invoice.fecha_vencimiento || invoice.fecha_emision),
            fecha_vencimiento: invoice.fecha_vencimiento || invoice.fecha_emision,
            fecha_emision: invoice.fecha_emision,
            status: invoice.estado || 'unknown',
            estado: invoice.estado || 'unknown',
            cliente: {
                usuario: invoice.cliente?.usuario,
                cedula: invoice.cliente?.cedula,
                telefono: invoice.cliente?.telefono,
                nombre: invoice.cliente?.nombre,
                id: invoice.cliente?.id?.toString()
            },
            originalData: invoice,
            cacheTimestamp: Date.now(),
            lastUpdated: new Date().toISOString()
        }));

        // Crear estructura de caché
        const cacheData = {
            lastFullSync: new Date().toISOString(),
            totalInvoices: normalizedInvoices.length,
            dateRanges: {
                [`${start}_${end}`]: {
                    startDate: start,
                    endDate: end,
                    syncTimestamp: Date.now(),
                    invoiceCount: normalizedInvoices.length
                }
            },
            invoices: normalizedInvoices,
            metadata: {
                version: '1.0.0',
                cacheFormat: 'normalized_invoices_v1',
                lastCleanup: new Date().toISOString()
            }
        };

        // Guardar en archivo
        fs.writeFileSync(cacheFilePath, JSON.stringify(cacheData, null, 2));

        console.log(`✅ Sincronización completada exitosamente!`);
        console.log(`📊 Estadísticas:`);
        console.log(`   • Total de facturas: ${normalizedInvoices.length}`);
        console.log(`   • Páginas descargadas: ${page - 1}`);
        console.log(`   • Archivo guardado en: ${cacheFilePath}`);
        console.log(`   • Tamaño del archivo: ${(fs.statSync(cacheFilePath).size / 1024 / 1024).toFixed(2)} MB`);

    } catch (error) {
        console.error('❌ Error durante la sincronización:', error.message);
        if (error.response) {
            console.error('📡 Error de API:', error.response.status, error.response.statusText);
        }
        process.exit(1);
    }
}

// Ejecutar sincronización
if (require.main === module) {
    syncInvoices().then(() => {
        console.log('🎉 Script de sincronización finalizado');
        process.exit(0);
    }).catch(error => {
        console.error('💥 Error fatal:', error);
        process.exit(1);
    });
}

module.exports = { syncInvoices };
