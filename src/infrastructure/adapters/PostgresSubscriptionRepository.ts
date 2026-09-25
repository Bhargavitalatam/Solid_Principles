// infrastructure/adapters/PostgresSubscriptionRepository.ts
import { Pool } from 'pg';
import { ISubscriptionRepository } from '../../domain/ports/ISubscriptionRepository';
import { Subscription } from '../../domain/models/Subscription';
import { pool as defaultPool } from '../database/db';

export class PostgresSubscriptionRepository implements ISubscriptionRepository {
  private pool: Pool;

  constructor(pool: Pool = defaultPool) {
    this.pool = pool;
  }

  async getSubscriptionByUserId(userId: string): Promise<Subscription | null> {
    const query = 'SELECT id, user_id, base_price, expires_at FROM subscriptions WHERE user_id = $1 LIMIT 1';
    const result = await this.pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const expiresAt = new Date(row.expires_at);
    const basePrice = parseFloat(row.base_price);

    return {
      id: row.id,
      userId: row.user_id,
      user_id: row.user_id,
      basePrice,
      base_price: basePrice,
      expiresAt,
      expires_at: expiresAt,
    };
  }

  async updateExpiration(subscriptionId: string, newExpiry: Date): Promise<void> {
    const query = 'UPDATE subscriptions SET expires_at = $1 WHERE id = $2';
    await this.pool.query(query, [newExpiry, subscriptionId]);
  }
}

export const SubscriptionRepository = PostgresSubscriptionRepository;
