export interface Subscription {
  id: string;
  userId: string;
  basePrice: number;
  expiresAt: Date;
  user_id?: string;
  base_price?: number;
  expires_at?: Date;
}
