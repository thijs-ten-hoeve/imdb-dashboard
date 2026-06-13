import { NextRequest, NextResponse } from 'next/server';
import { createConnection } from '@/lib/genre-stats';

const DEFAULT_LIMIT = 120;
const SEARCH_LIMIT  = 80;
const GENRE_LIMIT   = 40;

type ActorRow = {
  talent_id:   string;
  name:        string;
  birth_year:  number | null;
  death_year:  number | null;
  roleCount:   number;
  primaryGenre: string | null;
  avgProfit:   number | null;
  avgRating:   number | null;
  leadScore:   number | null;
};

type Filters = {
  startYear:  number;
  endYear:    number;
  minBudget:  number;
  maxBudget:  number;
};

function formatActor(row: ActorRow, maxRoleCount: number, maxAvgProfit: number) {
  const nameParts = row.name.split(' ');
  const initials  = nameParts.length > 1
    ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
    : nameParts[0].substring(0, 2).toUpperCase();

  const normRoles  = maxRoleCount  > 0 ? row.roleCount / maxRoleCount : 0;
  const normProfit = maxAvgProfit  > 0 && row.avgProfit ? row.avgProfit / maxAvgProfit : 0;
  const normRating = row.avgRating != null ? Math.max(0, (row.avgRating - 4) / 6) : 0.5;
  // leadScore = gemiddeld 1/ord — hogere waarde = vaker top in credits
  const normLead   = row.leadScore != null ? Math.min(1, row.leadScore * 5) : 0;

  const composite = normRoles * 0.35 + normProfit * 0.40 + normRating * 0.15 + normLead * 0.10;
  const score = Math.min(99, Math.max(55, Math.round(55 + composite * 44)));

  const profitLabel = row.avgProfit
    ? ` — gem. €${Math.round(row.avgProfit / 1_000_000)}M filmwinst` : '';
  const ratingLabel = row.avgRating != null
    ? `, ${Number(row.avgRating).toFixed(1)} IMDb` : '';
  const bio = `${row.roleCount} producties in de database${profitLabel}${ratingLabel}.`;

  return {
    id:        row.talent_id,
    name:      row.name,
    initials,
    score,
    genre:     row.primaryGenre || 'Algemeen',
    birthYear: row.birth_year,
    deathYear: row.death_year,
    bio,
  };
}

async function queryActors(search: string, limit: number, filters: Filters) {
  const { startYear, endYear, minBudget, maxBudget } = filters;
  const params: (string | number)[] = [];

  // Jaar- en budgetfilter via inner joins op title en title_financials
  params.push(startYear, endYear, minBudget, maxBudget);

  if (search) params.push(`%${search}%`);

  const query = `
    SELECT
      t.talent_id,
      t.name,
      t.birth_year,
      t.death_year,
      t.roleCount,
      t.avgProfit,
      t.avgRating,
      t.leadScore,
      (
        SELECT g.genre_name
        FROM title_principal tp2
        JOIN title_genre tg ON tp2.title_id = tg.title_id
        JOIN genre g ON tg.genre_id = g.genre_id
        WHERE tp2.talent_id = t.talent_id
        GROUP BY g.genre_name
        ORDER BY COUNT(*) DESC
        LIMIT 1
      ) AS primaryGenre
    FROM (
      SELECT
        n.talent_id,
        n.talent_name                                                         AS name,
        n.birth_year,
        n.death_year,
        COUNT(DISTINCT tp.title_id)                                           AS roleCount,
        AVG(CASE WHEN tf.revenue > 0 THEN tf.revenue - tf.budget ELSE NULL END) AS avgProfit,
        AVG(tr.average_rating)                                                AS avgRating,
        AVG(1.0 / tp.ord)                                                     AS leadScore
      FROM talent n
      JOIN title_principal tp  ON n.talent_id  = tp.talent_id
      JOIN category c          ON tp.category_id = c.category_id
        AND c.category_name IN ('actor', 'actress')
      JOIN title ti            ON tp.title_id  = ti.title_id
        AND ti.start_year BETWEEN ? AND ?
      JOIN title_financials tf ON tp.title_id  = tf.title_id
        AND tf.budget BETWEEN ? AND ?
        AND tf.budget > 0
      LEFT JOIN title_rating tr ON tp.title_id = tr.title_id
      WHERE 1=1
        ${search ? 'AND n.talent_name LIKE ?' : ''}
      GROUP BY n.talent_id, n.talent_name, n.birth_year, n.death_year
      ORDER BY roleCount DESC
      LIMIT ${limit}
    ) AS t
    ORDER BY t.roleCount DESC
  `;

  const conn = await createConnection();
  try {
    const [rows] = await conn.execute(query, params);
    return rows as ActorRow[];
  } finally {
    await conn.end();
  }
}

async function queryActorsByGenre(genre: string, limit: number, filters: Filters) {
  const { startYear, endYear, minBudget, maxBudget } = filters;

  const query = `
    SELECT
      n.talent_id,
      n.talent_name                                                           AS name,
      n.birth_year,
      n.death_year,
      COUNT(DISTINCT tp.title_id)                                             AS roleCount,
      AVG(CASE WHEN tf.revenue > 0 THEN tf.revenue - tf.budget ELSE NULL END) AS avgProfit,
      AVG(tr.average_rating)                                                  AS avgRating,
      AVG(1.0 / tp.ord)                                                       AS leadScore,
      ?                                                                       AS primaryGenre
    FROM talent n
    JOIN title_principal tp  ON n.talent_id  = tp.talent_id
    JOIN category c          ON tp.category_id = c.category_id
      AND c.category_name IN ('actor', 'actress')
    JOIN title_genre tg      ON tp.title_id  = tg.title_id
    JOIN genre g             ON tg.genre_id  = g.genre_id
      AND g.genre_name = ?
    JOIN title ti            ON tp.title_id  = ti.title_id
      AND ti.start_year BETWEEN ? AND ?
    JOIN title_financials tf ON tp.title_id  = tf.title_id
      AND tf.budget BETWEEN ? AND ?
      AND tf.budget > 0
    LEFT JOIN title_rating tr ON tp.title_id = tr.title_id
    GROUP BY n.talent_id, n.talent_name, n.birth_year, n.death_year
    ORDER BY roleCount DESC
    LIMIT ${limit}
  `;

  const conn = await createConnection();
  try {
    const [rows] = await conn.execute(query, [genre, genre, startYear, endYear, minBudget, maxBudget]);
    return rows as ActorRow[];
  } finally {
    await conn.end();
  }
}

// Zoekquery — optioneel gefilterd op genre
async function queryActorsBySearch(search: string, genre: string | null) {
  const genreJoin = genre
    ? `JOIN title_genre tg2 ON tp.title_id = tg2.title_id
       JOIN genre g2        ON tg2.genre_id = g2.genre_id AND g2.genre_name = ?`
    : '';
  const params: string[] = [];
  if (genre) params.push(genre);
  params.push(`%${search}%`);

  const query = `
    SELECT
      n.talent_id,
      n.talent_name                                                                AS name,
      n.birth_year,
      n.death_year,
      COUNT(DISTINCT tp.title_id)                                                  AS roleCount,
      AVG(CASE WHEN tf.revenue > 0 AND tf.budget > 0 THEN tf.revenue - tf.budget ELSE NULL END) AS avgProfit,
      AVG(tr.average_rating)                                                       AS avgRating,
      AVG(1.0 / tp.ord)                                                            AS leadScore,
      ${genre ? `'${genre}'` : `(
        SELECT g.genre_name
        FROM title_principal tp2
        JOIN title_genre tg ON tp2.title_id = tg.title_id
        JOIN genre g ON tg.genre_id = g.genre_id
        WHERE tp2.talent_id = n.talent_id
        GROUP BY g.genre_name ORDER BY COUNT(*) DESC LIMIT 1
      )`}                                                                          AS primaryGenre
    FROM talent n
    JOIN title_principal tp ON n.talent_id = tp.talent_id
    JOIN category c         ON tp.category_id = c.category_id
      AND c.category_name IN ('actor', 'actress')
    ${genreJoin}
    LEFT JOIN title_financials tf ON tp.title_id = tf.title_id
    LEFT JOIN title_rating tr     ON tp.title_id = tr.title_id
    WHERE n.talent_name LIKE ?
    GROUP BY n.talent_id, n.talent_name, n.birth_year, n.death_year
    ORDER BY roleCount DESC
    LIMIT ${SEARCH_LIMIT}
  `;

  const conn = await createConnection();
  try {
    const [rows] = await conn.execute(query, params);
    return rows as ActorRow[];
  } finally {
    await conn.end();
  }
}

export async function GET(request: NextRequest) {
  try {
    const sp         = request.nextUrl.searchParams;
    const search     = sp.get('search')?.trim()    ?? '';
    const genre      = sp.get('genre')?.trim()     ?? '';
    const startYear  = parseInt(sp.get('startYear')  ?? '1970', 10);
    const endYear    = parseInt(sp.get('endYear')    ?? '2026', 10);
    const minBudget  = parseInt(sp.get('minBudget')  ?? '0',    10) * 1_000_000;
    const maxBudget  = parseInt(sp.get('maxBudget')  ?? '1000', 10) * 1_000_000;

    const filters: Filters = { startYear, endYear, minBudget, maxBudget };

    let actorRows: ActorRow[];
    if (search) {
      actorRows = await queryActorsBySearch(search, genre || null);
    } else if (genre) {
      actorRows = await queryActorsByGenre(genre, GENRE_LIMIT, filters);
    } else {
      actorRows = await queryActors('', DEFAULT_LIMIT, filters);
    }

    const maxRoleCount  = actorRows.length > 0 ? Math.max(...actorRows.map(r => r.roleCount))       : 0;
    const maxAvgProfit  = actorRows.length > 0 ? Math.max(...actorRows.map(r => r.avgProfit ?? 0))  : 0;

    const formattedActors = actorRows
      .map(row => formatActor(row, maxRoleCount, maxAvgProfit))
      .sort((a, b) => b.score - a.score);

    return NextResponse.json(formattedActors);
  } catch (error) {
    console.error('Database error actors:', error);
    return NextResponse.json({ error: 'Kan geen acteurs ophalen uit de database' }, { status: 500 });
  }
}
