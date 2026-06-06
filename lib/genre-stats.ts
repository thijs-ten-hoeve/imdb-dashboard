import mysql from 'mysql2/promise';

export const MIN_BUDGET = 1_000_000;

export type GenreStatRow = {
  name: string;
  titleCount: number;
  avgNetProfit: number;
  avgMarginPct: number;
};

export function getDbConfig() {
  return {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD ?? 'process.env.DB_PASSWORD',
    database: process.env.DB_DATABASE || 'imdb_project',
    port: Number(process.env.DB_PORT) || 3306,
  };
}

export async function createConnection() {
  return mysql.createConnection(getDbConfig());
}

export const CREATE_GENRE_STATS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS genre_stats (
    genre_id INT NOT NULL PRIMARY KEY,
    title_count INT NOT NULL DEFAULT 0,
    avg_net_profit DECIMAL(18, 2) NOT NULL DEFAULT 0,
    avg_margin_pct DECIMAL(8, 2) NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL,
    CONSTRAINT fk_genre_stats_genre
      FOREIGN KEY (genre_id) REFERENCES genre (genre_id)
  );
`;

export async function ensureGenreStatsTable(connection: mysql.Connection) {
  await connection.execute(CREATE_GENRE_STATS_TABLE_SQL);
}

export async function refreshGenreStats(connection?: mysql.Connection) {
  const ownConnection = connection ?? await createConnection();
  const shouldClose = !connection;

  try {
    await ensureGenreStatsTable(ownConnection);

    await ownConnection.execute(`
      INSERT INTO genre_stats (genre_id, title_count, avg_net_profit, avg_margin_pct, updated_at)
      SELECT
        g.genre_id,
        COUNT(DISTINCT bt.title_id) AS title_count,
        AVG(bt.net_profit) AS avg_net_profit,
        AVG(bt.margin_pct) AS avg_margin_pct,
        NOW() AS updated_at
      FROM genre g
      JOIN title_genre tg ON g.genre_id = tg.genre_id
      JOIN (
        SELECT
          t.title_id,
          ROUND(COALESCE(tr.average_rating / 10, 0.5) * 100) AS margin_pct,
          ROUND(f.budget * (1 + ROUND(COALESCE(tr.average_rating / 10, 0.5) * 100) / 100)) - f.budget AS net_profit
        FROM title t
        JOIN title_financials f ON t.title_id = f.title_id AND f.budget >= ?
        LEFT JOIN title_rating tr ON t.title_id = tr.title_id
        WHERE t.runtime_minutes IS NOT NULL
      ) bt ON bt.title_id = tg.title_id
      GROUP BY g.genre_id
      ON DUPLICATE KEY UPDATE
        title_count = VALUES(title_count),
        avg_net_profit = VALUES(avg_net_profit),
        avg_margin_pct = VALUES(avg_margin_pct),
        updated_at = VALUES(updated_at);
    `, [MIN_BUDGET]);

    // Genres zonder kwalificerende titels op nul zetten
    await ownConnection.execute(`
      UPDATE genre_stats gs
      LEFT JOIN (
        SELECT DISTINCT g.genre_id
        FROM genre g
        JOIN title_genre tg ON g.genre_id = tg.genre_id
        JOIN title t ON tg.title_id = t.title_id
        JOIN title_financials f ON t.title_id = f.title_id AND f.budget >= ?
        WHERE t.runtime_minutes IS NOT NULL
      ) eligible ON eligible.genre_id = gs.genre_id
      SET gs.title_count = 0,
          gs.avg_net_profit = 0,
          gs.avg_margin_pct = 0,
          gs.updated_at = NOW()
      WHERE eligible.genre_id IS NULL;
    `, [MIN_BUDGET]);
  } finally {
    if (shouldClose) {
      await ownConnection.end();
    }
  }
}

export async function fetchGenreStats(connection?: mysql.Connection): Promise<GenreStatRow[]> {
  const ownConnection = connection ?? await createConnection();
  const shouldClose = !connection;

  try {
    await ensureGenreStatsTable(ownConnection);

    const [rows] = await ownConnection.execute(`
      SELECT
        g.genre_name AS name,
        gs.title_count AS titleCount,
        gs.avg_net_profit AS avgNetProfit,
        gs.avg_margin_pct AS avgMarginPct
      FROM genre g
      LEFT JOIN genre_stats gs ON gs.genre_id = g.genre_id
      ORDER BY gs.avg_net_profit DESC, g.genre_name ASC;
    `);

    return (rows as mysql.RowDataPacket[]).map((row) => ({
      name: row.name as string,
      titleCount: Number(row.titleCount ?? 0),
      avgNetProfit: Number(row.avgNetProfit ?? 0),
      avgMarginPct: Number(row.avgMarginPct ?? 0),
    }));
  } finally {
    if (shouldClose) {
      await ownConnection.end();
    }
  }
}
