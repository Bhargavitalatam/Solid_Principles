-- Database Schema for Subscription Billing Engine
-- Core Requirement 9

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
