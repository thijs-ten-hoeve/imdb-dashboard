import mysql from 'mysql2/promise';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const talentId = searchParams.get('talentId');

    if (!talentId) {
      return NextResponse.json({ error: 'talentId is verplicht' }, { status: 400 });
    }

    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'process.env.DB_PASSWORD',
      database: 'imdb_project',
    });

    const query = `
      SELECT DISTINCT
        t.title_id AS id, 
        t.primary_title AS title, 
        (SELECT g.genre_name FROM genre g JOIN title_genre tg ON g.genre_id = tg.genre_id WHERE tg.title_id = t.title_id LIMIT 1) AS genre,
        c.content_type_name AS type, 
        t.start_year AS year, 
        COALESCE(f.budget, 0) AS budget, 
        COALESCE(f.revenue, 0) AS revenue,
        t.is_adult AS isAdultClassification, 
        t.runtime_minutes AS durationMinutes,
        COALESCE(tr.average_rating, 0.0) AS imdbRating
      FROM title t
      JOIN title_principal tp ON t.title_id = tp.title_id
      JOIN content_type c ON t.content_type_id = c.content_type_id
      LEFT JOIN title_financials f ON t.title_id = f.title_id
      LEFT JOIN title_rating tr ON t.title_id = tr.title_id
      WHERE tp.talent_id = ? AND c.content_type_name = 'movie'
      ORDER BY imdbRating DESC, year DESC
      LIMIT 5;
    `;

    const [rows] = await connection.execute(query, [talentId]);
    await connection.end();

    const movies = (rows as any[]).map(row => ({
      ...row,
      genre: row.genre || 'Algemeen',
      imdbRating: Number(row.imdbRating)
    }));

    return NextResponse.json(movies);
  } catch (error) {
    console.error('Database error in actor movies route:', error);
    return NextResponse.json({ error: 'Kan films van acteur niet ophalen' }, { status: 500 });
  }
}
