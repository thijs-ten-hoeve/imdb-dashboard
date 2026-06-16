import mysql from 'mysql2/promise';

export const MIN_BUDGET = 1_000_000;

export type GenreStatRow = {
  name: string;
  titleCount: number;
  avgNetProfit: number;
  avgMarginPct: number;
  avgDuration: number | null;
  avgRevBudgetRatio: number | null;
  revenueCoverage: number | null;
  maxBudget: number | null;
};

export function getDbConfig() {
  return {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
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

export async function fetchGenreStatsForRange(
  startYear: number,
  endYear: number,
  connection?: mysql.Connection
): Promise<GenreStatRow[]> {
  const ownConnection = connection ?? await createConnection();
  const shouldClose = !connection;

  try {
    const [rows] = await ownConnection.execute(`
      SELECT
        g.genre_name AS name,
        COALESCE(stats.title_count, 0) AS titleCount,
        COALESCE(stats.avg_net_profit, 0) AS avgNetProfit,
        COALESCE(stats.avg_margin_pct, 0) AS avgMarginPct,
        stats.avg_duration AS avgDuration,
        stats.avg_rev_budget_ratio AS avg_rev_budget_ratio,
        stats.revenue_coverage AS revenue_coverage,
        stats.max_budget AS max_budget
      FROM genre g
      LEFT JOIN (
        SELECT
          g2.genre_id,
          COUNT(DISTINCT bt.title_id) AS title_count,
          AVG(bt.net_profit) AS avg_net_profit,
          AVG(bt.margin_pct) AS avg_margin_pct,
          AVG(bt.runtime_minutes) AS avg_duration,
          AVG(CASE WHEN bt.revenue > 0 THEN bt.revenue / bt.budget ELSE NULL END) AS avg_rev_budget_ratio,
          COUNT(CASE WHEN bt.revenue > 0 THEN 1 END) * 1.0 / COUNT(*) AS revenue_coverage,
          MAX(bt.budget) AS max_budget
        FROM genre g2
        JOIN title_genre tg ON g2.genre_id = tg.genre_id
        JOIN (
          SELECT
            t.title_id,
            t.runtime_minutes,
            f.budget,
            f.revenue,
            ROUND(COALESCE(tr.average_rating / 10, 0.5) * 100) AS margin_pct,
            ROUND(f.budget * (1 + ROUND(COALESCE(tr.average_rating / 10, 0.5) * 100) / 100)) - f.budget AS net_profit
          FROM title t
          JOIN title_financials f ON t.title_id = f.title_id AND f.budget >= ?
          LEFT JOIN title_rating tr ON t.title_id = tr.title_id
          WHERE t.runtime_minutes IS NOT NULL AND t.runtime_minutes > 0
            AND t.start_year >= ? AND t.start_year <= ?
        ) bt ON bt.title_id = tg.title_id
        GROUP BY g2.genre_id
      ) stats ON stats.genre_id = g.genre_id
      WHERE g.genre_name NOT IN ('Film-Noir', 'News')
      ORDER BY avgNetProfit DESC, g.genre_name ASC;
    `, [MIN_BUDGET, startYear, endYear]);

    return (rows as mysql.RowDataPacket[]).map((row) => ({
      name: row.name as string,
      titleCount: Number(row.titleCount ?? 0),
      avgNetProfit: Number(row.avgNetProfit ?? 0),
      avgMarginPct: Number(row.avgMarginPct ?? 0),
      avgDuration: row.avgDuration != null ? Math.round(Number(row.avgDuration)) : null,
      avgRevBudgetRatio: row.avg_rev_budget_ratio != null ? Number(row.avg_rev_budget_ratio) : null,
      revenueCoverage: row.revenue_coverage != null ? Number(row.revenue_coverage) : null,
      maxBudget: row.max_budget != null ? Number(row.max_budget) : null,
    }));
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
        gs.avg_margin_pct AS avgMarginPct,
        dur.avg_duration AS avgDuration,
        dur.avg_rev_budget_ratio AS avgRevBudgetRatio,
        dur.revenue_coverage AS revenueCoverage,
        dur.max_budget AS maxBudget
      FROM genre g
      LEFT JOIN genre_stats gs ON gs.genre_id = g.genre_id
      LEFT JOIN (
        SELECT
          tg.genre_id,
          AVG(t.runtime_minutes) AS avg_duration,
          AVG(CASE WHEN f.revenue > 0 THEN f.revenue / f.budget ELSE NULL END) AS avg_rev_budget_ratio,
          COUNT(CASE WHEN f.revenue > 0 THEN 1 END) * 1.0 / COUNT(*) AS revenue_coverage,
          MAX(f.budget) AS max_budget
        FROM title_genre tg
        JOIN title t ON tg.title_id = t.title_id
        JOIN title_financials f ON t.title_id = f.title_id AND f.budget >= ?
        WHERE t.runtime_minutes IS NOT NULL AND t.runtime_minutes > 0
        GROUP BY tg.genre_id
      ) dur ON dur.genre_id = g.genre_id
      WHERE g.genre_name NOT IN ('Film-Noir', 'News')
      ORDER BY gs.avg_net_profit DESC, g.genre_name ASC;
    `, [MIN_BUDGET]);

    return (rows as mysql.RowDataPacket[]).map((row) => ({
      name: row.name as string,
      titleCount: Number(row.titleCount ?? 0),
      avgNetProfit: Number(row.avgNetProfit ?? 0),
      avgMarginPct: Number(row.avgMarginPct ?? 0),
      avgDuration: row.avgDuration != null ? Math.round(Number(row.avgDuration)) : null,
      avgRevBudgetRatio: row.avgRevBudgetRatio != null ? Number(row.avgRevBudgetRatio) : null,
      revenueCoverage: row.revenueCoverage != null ? Number(row.revenueCoverage) : null,
      maxBudget: row.maxBudget != null ? Number(row.maxBudget) : null,
    }));
  } finally {
    if (shouldClose) {
      await ownConnection.end();
    }
  }
}
