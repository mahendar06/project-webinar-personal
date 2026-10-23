import { Pool } from 'pg';
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

export interface AttendanceJobData {
  sessionId: string;
}

/**
 * Attendance processor: Calculates total attendee engagement duration and aggregates statistics
 * after a session concludes.
 */
export async function processAttendance(job: { data: AttendanceJobData }): Promise<void> {
  const { sessionId } = job.data;
  logger.info(`Aggregating attendance for session ${sessionId}`, 'AttendanceProcessor');

  const pool = getDbPool();

  try {
    const participantsRes = await pool.query(
      `SELECT id, user_id, display_name, role, joined_at, left_at
       FROM session_participants
       WHERE session_id = $1`,
      [sessionId],
    );

    const totalParticipants = participantsRes.rows.length;
    let totalDurationSeconds = 0;

    for (const p of participantsRes.rows) {
      if (p.joined_at) {
        const joinTime = new Date(p.joined_at).getTime();
        const leaveTime = p.left_at ? new Date(p.left_at).getTime() : Date.now();
        const durationSec = Math.max(0, Math.floor((leaveTime - joinTime) / 1000));
        totalDurationSeconds += durationSec;
      }
    }

    const avgDurationSeconds = totalParticipants > 0
      ? Math.floor(totalDurationSeconds / totalParticipants)
      : 0;

    logger.info(
      `Session ${sessionId} attendance summary: ${totalParticipants} participants, avg duration ${avgDurationSeconds}s`,
      'AttendanceProcessor',
    );

    await pool.query(
      `INSERT INTO audit_logs (action, session_id, metadata, timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [
        'attendance_aggregation_completed',
        sessionId,
        JSON.stringify({
          totalParticipants,
          totalDurationSeconds,
          avgDurationSeconds,
        }),
      ],
    );
  } catch (error: any) {
    logger.error(`Attendance aggregation failed for session ${sessionId}: ${error.message}`, error, 'AttendanceProcessor');
    throw error;
  }
}
