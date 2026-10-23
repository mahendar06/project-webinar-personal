import { Pool } from 'pg';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../common/logger';
import { workerConfig } from '../config/config';

let dbPool: Pool | null = null;

function getDbPool(): Pool {
  if (!dbPool) {
    dbPool = new Pool({
      connectionString: workerConfig.database.url,
    });
  }
  return dbPool;
}

/**
 * Cleanup job:
 * 1. Purges expired email verification tokens
 * 2. Deletes raw recording files older than retention policy (7 days)
 */
export async function runCleanupJob(): Promise<{ deletedTokens: number; deletedRawFiles: number }> {
  logger.info('Starting daily cleanup job', 'CleanupProcessor');
  const pool = getDbPool();
  let deletedTokens = 0;
  let deletedRawFiles = 0;

  try {
    // 1. Delete expired email verifications
    const tokenRes = await pool.query(
      'DELETE FROM email_verifications WHERE expires_at < NOW() AND verified_at IS NULL',
    );
    deletedTokens = tokenRes.rowCount || 0;
    logger.info(`Deleted ${deletedTokens} expired verification tokens`, 'CleanupProcessor');

    // 2. Scan and clean old raw recordings
    const recordingsRoot = workerConfig.storage.recordingsRoot;
    try {
      const entries = await fs.readdir(recordingsRoot, { withFileTypes: true });
      const cutoffTime = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const rawDir = path.join(recordingsRoot, entry.name, 'raw');
          try {
            const rawFiles = await fs.readdir(rawDir);
            for (const file of rawFiles) {
              const fullPath = path.join(rawDir, file);
              const stats = await fs.stat(fullPath);
              if (stats.mtimeMs < cutoffTime) {
                await fs.unlink(fullPath);
                deletedRawFiles++;
                logger.info(`Deleted aged raw file: ${fullPath}`, 'CleanupProcessor');
              }
            }
          } catch {
            // Raw directory doesn't exist for this session, ignore
          }
        }
      }
    } catch (err: any) {
      logger.warn(`Could not scan recordings directory for cleanup: ${err.message}`, 'CleanupProcessor');
    }

    logger.info(
      `Cleanup job completed. Tokens: ${deletedTokens}, Raw files: ${deletedRawFiles}`,
      'CleanupProcessor',
    );

    return { deletedTokens, deletedRawFiles };
  } catch (error: any) {
    logger.error(`Cleanup job failed: ${error.message}`, error, 'CleanupProcessor');
    throw error;
  }
}
