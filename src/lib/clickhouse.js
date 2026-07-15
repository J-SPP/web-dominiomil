// ClickHouse HTTP Client Utility
// Handles event ingestion for the public API and data retrieval for the client dashboard.

// Verify required environment variables at module startup
const requiredEnvVars = [
  'CLICKHOUSE_API_HOST',
  'CLICKHOUSE_API_USER',
  'CLICKHOUSE_API_PASSWORD',
  'CLICKHOUSE_API_DATABASE',
  'CLICKHOUSE_DASHBOARD_HOST',
  'CLICKHOUSE_DASHBOARD_USER',
  'CLICKHOUSE_DASHBOARD_PASSWORD',
  'CLICKHOUSE_DASHBOARD_DATABASE',
];

const missingEnvVars = requiredEnvVars.filter(env => !process.env[env]);
if (missingEnvVars.length > 0) {
  console.warn(
    `[SPP ClickHouse Warning] Missing required environment variables at startup: ${missingEnvVars.join(', ')}. Analytics may not function properly.`
  );
} else {
  console.log('[SPP ClickHouse] All required ClickHouse environment variables are present.');
}

/**
 * Inserts a single event into the ClickHouse database.
 * Uses the API user credentials (write-only).
 */
export async function insertEvent(event) {
  const host = process.env.CLICKHOUSE_API_HOST || 'http://localhost:8123';
  const user = process.env.CLICKHOUSE_API_USER || 'analytics_api';
  const password = process.env.CLICKHOUSE_API_PASSWORD || '';
  const database = process.env.CLICKHOUSE_API_DATABASE || 'analytics';

  const sql = 'INSERT INTO analytics_events FORMAT JSONEachRow';
  const url = `${host}/?query=${encodeURIComponent(sql)}`;

  console.log(`[SPP ClickHouse Ingest] Ingesting event_type='${event.event_type}' for website_id='${event.website_id}'`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-ClickHouse-User': user,
        'X-ClickHouse-Key': password,
        'X-ClickHouse-Database': database,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SPP ClickHouse Ingest Error] ClickHouse insertion HTTP ${response.status} failed: ${errorText}`);
      throw new Error(`ClickHouse event insertion failed: ${errorText}`);
    }

    console.log(`[SPP ClickHouse Ingest Success] Event '${event.event_type}' ingested successfully.`);
    return true;
  } catch (error) {
    console.error('[SPP ClickHouse Ingest Exception] Failed to send insert to ClickHouse:', error);
    throw error;
  }
}

/**
 * Executes a SELECT query in ClickHouse and returns the rows array.
 * Uses the Dashboard user credentials (read-only).
 */
export async function queryAnalytics(sql) {
  const host = process.env.CLICKHOUSE_DASHBOARD_HOST || 'http://localhost:8123';
  const user = process.env.CLICKHOUSE_DASHBOARD_USER || 'analytics_dashboard';
  const password = process.env.CLICKHOUSE_DASHBOARD_PASSWORD || '';
  const database = process.env.CLICKHOUSE_DASHBOARD_DATABASE || 'analytics';

  // Ensure SQL query requests JSON format output from ClickHouse
  const cleanSql = sql.trim();
  const sqlWithFormat = cleanSql.toLowerCase().includes('format json')
    ? cleanSql
    : (cleanSql.endsWith(';') ? cleanSql.slice(0, -1) : cleanSql) + ' FORMAT JSON';

  console.log(`[SPP ClickHouse Query] Executing query on database='${database}': ${cleanSql}`);

  try {
    const response = await fetch(`${host}/`, {
      method: 'POST',
      headers: {
        'X-ClickHouse-User': user,
        'X-ClickHouse-Key': password,
        'X-ClickHouse-Database': database,
      },
      body: sqlWithFormat,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SPP ClickHouse Query Error] ClickHouse query HTTP ${response.status} failed: ${errorText}`);
      throw new Error(`ClickHouse query failed: ${errorText}`);
    }

    const result = await response.json();
    console.log(`[SPP ClickHouse Query Success] Query executed. Returned ${result.data?.length || 0} rows.`);
    return result.data || [];
  } catch (error) {
    console.error('[SPP ClickHouse Query Exception] Failed to execute query in ClickHouse:', error);
    throw error;
  }
}
