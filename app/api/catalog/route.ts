import mysql from 'mysql2/promise';
import { NextRequest, NextResponse } from 'next/server';

const MIN_BUDGET = 1_000_000;

export async function GET(request: NextRequest) {
  try {
    // 1. Lees de filters uit de URL (met veilige fallbacks)
    const searchParams = request.nextUrl.searchParams;
    const genre = searchParams.get('genre') || 'all';
    const talentId = searchParams.get('talentId') || 'all';
    const minBudget = parseInt(searchParams.get('minBudget') || '0', 10) * 1000000;
    const maxBudget = parseInt(searchParams.get('maxBudget') || '1000', 10) * 1000000;
    const startYear = parseInt(searchParams.get('startYear') || '1970', 10);
    const endYear = parseInt(searchParams.get('endYear') || '2026', 10);

    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE || 'imdb_project',
    });

    // Geselecteerde genres (OR-logica) — ook gebruikt voor het weergavelabel hieronder
    const genres = searchParams.getAll('genre').filter(g => g && g !== 'all');

    // Bepaal welk genre als label getoond wordt. Een titel heeft meerdere genres;
    // standaard pakken we er willekeurig één. Maar als er genres geselecteerd zijn,
    // tonen we het geselecteerde genre dat bij de titel hoort, zodat het label altijd
    // overeenkomt met het actieve filter (bijv. "Mystery" i.p.v. "Action").
    const selectParams: any[] = [];
    let genreLabelExpr = `(
      SELECT g.genre_name FROM genre g
      JOIN title_genre tg ON g.genre_id = tg.genre_id
      WHERE tg.title_id = t.title_id AND g.genre_name NOT IN ('Film-Noir', 'News')
      LIMIT 1
    )`;
    if (genres.length > 0) {
      const placeholders = genres.map(() => '?').join(',');
      genreLabelExpr = `(
        SELECT g.genre_name FROM genre g
        JOIN title_genre tg ON g.genre_id = tg.genre_id
        WHERE tg.title_id = t.title_id AND g.genre_name NOT IN ('Film-Noir', 'News')
        ORDER BY (g.genre_name IN (${placeholders})) DESC, g.genre_name
        LIMIT 1
      )`;
      selectParams.push(...genres);
    }

    // 2. Bouw de basis-query (veilig tegen SQL-injecties met '?')
    let query = `
      SELECT
        t.title_id AS id,
        t.primary_title AS title,
        ${genreLabelExpr} AS genre,
        c.content_type_name AS type,
        t.start_year AS year,
        f.budget AS budget,
        t.is_adult AS isAdultClassification,
        t.runtime_minutes AS durationMinutes,
        COALESCE(tr.average_rating / 10, 0.5) AS baseMarginFactor,
        tr.average_rating AS imdbRating
      FROM title t
      JOIN content_type c ON t.content_type_id = c.content_type_id
      JOIN title_financials f ON t.title_id = f.title_id AND f.budget >= ${MIN_BUDGET}
      LEFT JOIN title_rating tr ON t.title_id = tr.title_id
      WHERE t.start_year >= ? AND t.start_year <= ?
        AND f.budget >= ? AND f.budget <= ?
        AND t.runtime_minutes IS NOT NULL
    `;

    // Arrays met parameters voor de '?' plekken.
    // De label-subquery staat in de SELECT, dus die params komen vooraan.
    const params: any[] = [...selectParams, startYear, endYear, minBudget, maxBudget];

    // 3. Voeg Type filter toe — ondersteunt meerdere types (OR-logica)
    const types = searchParams.getAll('type').filter(t => t && t !== 'all');
    if (types.length === 1) {
      query += ` AND c.content_type_name = ?`;
      params.push(types[0]);
    } else if (types.length > 1) {
      query += ` AND c.content_type_name IN (${types.map(() => '?').join(',')})`;
      params.push(...types);
    }

    // 4. Voeg Genre filter toe — ondersteunt meerdere genres (OR-logica)
    if (genres.length === 1) {
      query += ` AND EXISTS (
        SELECT 1 FROM title_genre tg2
        JOIN genre g2 ON tg2.genre_id = g2.genre_id
        WHERE tg2.title_id = t.title_id AND g2.genre_name = ?
      )`;
      params.push(genres[0]);
    } else if (genres.length > 1) {
      query += ` AND EXISTS (
        SELECT 1 FROM title_genre tg2
        JOIN genre g2 ON tg2.genre_id = g2.genre_id
        WHERE tg2.title_id = t.title_id AND g2.genre_name IN (${genres.map(() => '?').join(',')})
      )`;
      params.push(...genres);
    }

    // 4.5 Voeg Talent/Acteur filter toe indien geselecteerd
    if (talentId !== 'all') {
      query += ` AND EXISTS (
        SELECT 1 FROM title_principal tp3
        WHERE tp3.title_id = t.title_id AND tp3.talent_id = ?
      )`;
      params.push(talentId);
    }

    // 5. Sorteer op hoogste budget en stuur max 200 resultaten terug
    query += ` ORDER BY f.budget DESC LIMIT 200;`;

    const [rows] = await connection.execute(query, params);
    await connection.end();

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Fout bij filteren van catalogus' }, { status: 500 });
  }
}