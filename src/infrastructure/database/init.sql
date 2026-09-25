-- Database Initialization: Schema and Seed Data
-- Automatically executed by PostgreSQL container upon initial startup

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    stripe_customer_id VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    base_price DECIMAL(10, 2) NOT NULL,
    expires_at TIMESTAMP NOT NULL
);

-- Seed Data
INSERT INTO users (id, stripe_customer_id)
VALUES 
    ('user-expired-101', 'cus_expired_stripe_101'),
    ('user-active-202', 'cus_active_stripe_202')
ON CONFLICT (id) DO NOTHING;

INSERT INTO subscriptions (id, user_id, base_price, expires_at)
VALUES 
    ('sub-expired-101', 'user-expired-101', 99.99, '2020-01-01 00:00:00'),
    ('sub-active-202', 'user-active-202', 149.99, '2030-01-01 00:00:00')
ON CONFLICT (id) DO NOTHING;
