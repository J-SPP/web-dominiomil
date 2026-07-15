// ClickHouse HTTP Client Utility
// Handles event ingestion for the public API and data retrieval for the client dashboard.

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
    throw new Error(`ClickHouse event insertion failed: ${errorText}`);
  }
  return true;
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
    throw new Error(`ClickHouse query failed: ${errorText}`);
  }

  const result = await response.json();
  return result.data || [];
}
