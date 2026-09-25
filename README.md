# Subscription Billing Engine Refactoring (SOLID Principles)

A production-grade refactoring of a legacy monolithic subscription billing engine ("God class") into a decoupled, highly testable architecture using **Hexagonal Architecture (Ports and Adapters)**, **Dependency Injection**, and **SOLID Principles**.

---

## 🏛️ Architecture Overview

The system strictly decouples domain logic from infrastructure details:

```
                  +---------------------------+
                  |   HTTP API / Controller   |
                  +-------------+-------------+
                                | (Injects Adapters)
                                v
+---------------------------------------------------------------+
|                        DOMAIN LAYER                           |
|                                                               |
|   +-------------------------------------------------------+   |
|   |             SubscriptionBillingService                |   |
|   +-------------------------------------------------------+   |
|          |                    |                    |          |
|          v                    v                    v          |
|    ITimeProvider      IPaymentGateway    ISubscriptionRepo    |
|     (Domain Port)      (Domain Port)       (Domain Port)      |
+----------^--------------------^--------------------^----------+
           |                    |                    |
           | (Implements)       | (Implements)       | (Implements)
+----------+--------------------+--------------------+----------+
|                     INFRASTRUCTURE LAYER                      |
|                                                               |
|  SystemTimeProvider   MockPaymentGateway   PostgresSubRepo    |
|   (OS System Clock)    (Stripe Adapter)     (PostgreSQL)      |
+---------------------------------------------------------------+
```

### Applied SOLID Principles:
- **Single Responsibility Principle (SRP)**: Domain business rules (expiration check, December 10% discount, 1-year renewal extension) reside solely within `SubscriptionBillingService`. All database queries, payment calls, and clock reads are isolated in dedicated adapters.
- **Open/Closed Principle (OCP)**: New payment processors (e.g. PayPal) or database storage engines (e.g. DynamoDB) can be introduced by creating new adapters without modifying domain logic.
- **Liskov Substitution Principle (LSP)**: Any adapter fulfilling `IPaymentGateway` or `ISubscriptionRepository` can be substituted interchangeably without altering domain behavior.
- **Interface Segregation Principle (ISP)**: Focused, minimal ports (`ITimeProvider`, `IPaymentGateway`, `ISubscriptionRepository`, `IUserRepository`) ensure classes only depend on the methods they use.
- **Dependency Inversion Principle (DIP)**: High-level domain services depend strictly on domain ports (abstractions), never on low-level drivers or third-party SDKs.

---

## 📁 Repository Structure

```
├── docs/
│   └── ADR-001-Refactoring-God-Class.md  # Architectural Decision Record
├── legacy/
│   ├── LegacySubscriptionManager.ts      # Original legacy smelly God-class
│   └── SubscriptionManager.ts            # Legacy entrypoint
├── src/
│   ├── domain/
│   │   ├── models/                       # Plain data entities (User, Subscription)
│   │   ├── ports/                        # Interfaces (ITimeProvider, IPaymentGateway, etc.)
│   │   └── services/                     # Core domain service (SubscriptionBillingService)
│   ├── infrastructure/
│   │   ├── adapters/                     # Concrete adapters (Postgres, Stripe, SystemClock)
│   │   └── database/                     # PostgreSQL schema, seed, and migration scripts
│   └── api/
│       ├── controllers/                  # BillingController (Composition root)
│       ├── app.ts                        # Express application configuration
│       └── server.ts                     # HTTP Server entrypoint
├── tests/
│   ├── unit/                             # Isolated domain unit tests (100% coverage, 0 I/O)
│   └── integration/                      # API endpoint integration tests
├── .env.example                          # Environment variable documentation
├── docker-compose.yml                    # Docker orchestration with healthchecks & seeding
├── Dockerfile                            # Multi-stage production container build
├── submission.json                       # Seeded test data mapping
└── package.json
```

---

## 🧪 Testing

### Running Unit Tests (Sandboxed, 100% In-Memory)
```bash
npm run test:unit
```
To run tests with code coverage analysis:
```bash
npm run test:coverage
```
*Achieves 100% line, statement, and branch coverage on domain service without touching network or database.*

### Running Integration Tests
```bash
npm run test:integration
```

### Running All Tests
```bash
npm test
```

---

## 🚀 Running via Docker Compose

Run the entire system (PostgreSQL with automatic schema creation and seeding + API server) with a single command:

```bash
docker-compose up -d --build
```

### Verifying Service Health
```bash
docker-compose ps
```

The database container `subscription_billing_db` runs automated healthchecks via `pg_isready`, and the `api` service automatically waits until `db` is healthy before starting and serving requests.

---

## 🌐 API Specification

### Endpoint: `POST /api/renew`

#### Request:
- Headers: `Content-Type: application/json`
- Body:
```json
{
  "userId": "user-expired-101"
}
```

#### Successful Renewal Response (`200 OK`):
```json
{
  "success": true,
  "message": "Renewal successful"
}
```

#### Business Rule Failure Response (`400 Bad Request`):
```json
{
  "success": false,
  "message": "Subscription is not yet expired"
}
```

---

## 📊 Seeded Test Data (`submission.json`)

The database is pre-seeded with test data for automated evaluation:

| Identifier | User ID | Subscription ID | State | Base Price | Expiration Date |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `validUserId` | `user-expired-101` | `sub-expired-101` | Expired | $99.99 | `2020-01-01` |
| `unexpiredUserId` | `user-active-202` | `sub-active-202` | Active | $149.99 | `2030-01-01` |
| `nonExistentUserId`| `user-non-existent-999` | N/A | Missing | N/A | N/A |
