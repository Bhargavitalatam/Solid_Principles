// infrastructure/adapters/PostgresUserRepository.ts
import { Pool } from 'pg';
import { IUserRepository } from '../../domain/ports/IUserRepository';
import { User } from '../../domain/models/User';
import { pool as defaultPool } from '../database/db';

export class PostgresUserRepository implements IUserRepository {
  private pool: Pool;

  constructor(pool: Pool = defaultPool) {
    this.pool = pool;
  }

  async getUserById(userId: string): Promise<User | null> {
    const query = 'SELECT id, stripe_customer_id FROM users WHERE id = $1 LIMIT 1';
    const result = await this.pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      stripeCustomerId: row.stripe_customer_id,
      stripe_customer_id: row.stripe_customer_id,
    };
  }
}
