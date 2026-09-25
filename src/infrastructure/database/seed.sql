-- Seed Data for Automated Evaluation and Local Testing
-- Matches submission.json

-- Clean up any existing records
TRUNCATE TABLE subscriptions, users CASCADE;

-- 1. Expired Subscription User (validUserId)
INSERT INTO users (id, stripe_customer_id)
VALUES ('user-expired-101', 'cus_expired_stripe_101');

INSERT INTO subscriptions (id, user_id, base_price, expires_at)
VALUES ('sub-expired-101', 'user-expired-101', 99.99, '2020-01-01 00:00:00');

-- 2. Unexpired Subscription User (unexpiredUserId)
INSERT INTO users (id, stripe_customer_id)
VALUES ('user-active-202', 'cus_active_stripe_202');

INSERT INTO subscriptions (id, user_id, base_price, expires_at)
VALUES ('sub-active-202', 'user-active-202', 149.99, '2030-01-01 00:00:00');
