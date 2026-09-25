// infrastructure/database/migrate.ts
import { pool } from './db';
import fs from 'fs';
import path from 'path';

function findSqlFile(filename: string): string {
  const possiblePaths = [
    path.join(__dirname, filename),
    path.join(__dirname, '..', '..', 'src', 'infrastructure', 'database', filename),
    path.join(process.cwd(), 'src', 'infrastructure', 'database', filename),
    path.join(process.cwd(), 'dist', 'src', 'infrastructure', 'database', filename),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, 'utf-8');
    }
  }

  throw new Error(`Could not find SQL file ${filename} in searched paths`);
}

export async function runMigrationsAndSeed(): Promise<void> {
  const client = await pool.connect();
  try {
    const schemaSql = findSqlFile('schema.sql');
    await client.query(schemaSql);

    const seedSql = findSqlFile('seed.sql');
    await client.query(seedSql);

    console.log('Database schema and seed successfully applied.');
  } catch (error) {
    console.error('Error running migrations and seed:', error);
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrationsAndSeed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
