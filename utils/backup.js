const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const BACKUPS_DIR = path.join(__dirname, '..', 'backups');
const MAX_BACKUPS = 14;

function runPgDump(databaseUrl, outputPath) {
    return new Promise((resolve, reject) => {
        // Formato "custom" (-Fc): comprimido y restaurable con pg_restore, a diferencia de un volcado
        // de texto plano.
        execFile('pg_dump', [databaseUrl, '-F', 'c', '-f', outputPath], (error, stdout, stderr) => {
            if (error) return reject(new Error(stderr || error.message));
            resolve();
        });
    });
}

/**
 * Si el cron interno de respaldo (services/schedulerService.js) debe programarse. Función pura,
 * sin efectos secundarios, para poder probarla sin mockear cron/db/mailer.
 *
 * En producción (Render, plan gratuito) no tiene sentido programarlo: no hay disco persistente, así
 * que el archivo no sobrevive a un redeploy ni a un reinicio del contenedor, y el proceso se duerme
 * tras 15 min sin tráfico, así que el cron de las 2:00 casi nunca llega a correr. El respaldo real de
 * producción es el workflow de GitHub Actions (.github/workflows/respaldo-neon.yml), que corre en la
 * infraestructura de GitHub y no depende de que el servicio esté despierto — ver
 * docs/restaurar_respaldo.md.
 *
 * @param {string} [nodeEnv=process.env.NODE_ENV]
 * @returns {boolean}
 */
function debeProgramarRespaldoLocal(nodeEnv = process.env.NODE_ENV) {
    return nodeEnv !== 'production';
}

/**
 * Respaldo lógico de PostgreSQL vía pg_dump. Reemplaza al respaldo por copia de archivo (utils/backup.js
 * original, pensado para inventario.db de SQLite, dejó de funcionar al migrar a PostgreSQL en la nube).
 *
 * Limitación conocida: en Render (y la mayoría de PaaS) el sistema de archivos del servicio web es
 * efímero — estos respaldos NO sobreviven un redeploy o un reinicio del contenedor. Sirven como
 * respaldo de corto plazo entre despliegues, pero no reemplazan una copia en almacenamiento externo
 * (S3, Backblaze, etc.). Subir automáticamente a ese almacenamiento queda pendiente de que el equipo
 * provisione las credenciales correspondientes.
 */
async function createBackup() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.log('⚠️ No hay DATABASE_URL configurada; se omite el respaldo.');
        return;
    }

    if (!fs.existsSync(BACKUPS_DIR)) {
        fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }

    const now = new Date();
    // Ajustar a Bogotá (Manual -5h)
    const bogotaNow = new Date(now.getTime() - (5 * 60 * 60 * 1000));
    const timestamp = bogotaNow.toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
    const backupName = `backup_${timestamp}.dump`;
    const backupPath = path.join(BACKUPS_DIR, backupName);

    try {
        await runPgDump(databaseUrl, backupPath);
        console.log(`📦 Respaldo de PostgreSQL creado: backups/${backupName}`);

        const files = fs.readdirSync(BACKUPS_DIR)
            .filter((f) => f.startsWith('backup_') && f.endsWith('.dump'))
            .map((f) => ({ name: f, time: fs.statSync(path.join(BACKUPS_DIR, f)).mtime.getTime() }))
            .sort((a, b) => b.time - a.time);

        if (files.length > MAX_BACKUPS) {
            files.slice(MAX_BACKUPS).forEach((f) => {
                fs.unlinkSync(path.join(BACKUPS_DIR, f.name));
                console.log(`🧹 Respaldo antiguo eliminado: ${f.name}`);
            });
        }
    } catch (error) {
        // pg_dump puede no estar disponible en la imagen del servicio (algunos planes de Render no
        // incluyen el cliente de PostgreSQL) — se registra el fallo en vez de tumbar el proceso.
        console.error('❌ Error al crear el respaldo con pg_dump:', error.message);
    }
}

module.exports = { createBackup, debeProgramarRespaldoLocal };
