import mysql from 'mysql2/promise';

// Ensure we don't create multiple pools in development due to hot reloading
const globalForDb = global as unknown as { pool: mysql.Pool };

export const pool =
  globalForDb.pool ||
  mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD ?? 'process.env.DB_PASSWORD',
    database: process.env.DB_DATABASE || 'imdb_project',
    port: Number(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool;