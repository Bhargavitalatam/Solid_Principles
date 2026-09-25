# Context: Why the legacy class was problematic.

The legacy `SubscriptionManager` / `LegacySubscriptionManager` was implemented as a monolithic "God Object" or "God Class". It violated core object-oriented and software engineering principles in multiple ways:

1. **Violation of Single Responsibility Principle (SRP)**:
   - The legacy class handled HTTP parameters, raw SQL execution against a PostgreSQL database, third-party network communication with a payment provider (Stripe), system clock temporal inspections, and domain business rules (December promotion discounts, expiration validation, expiration calculation).
   - Any change to the database schema, third-party payment API, or business promotion required modifying this single file.

2. **Violation of Dependency Inversion Principle (DIP)**:
   - The high-level business rules depended directly on low-level infrastructure implementations (`new DatabaseConnection()`, `new ThirdPartyPaymentClient()`).
   - Hardcoded dependencies were directly instantiated inside the renewal method, making it impossible to substitute test doubles.

3. **Temporal Coupling and Non-Determinism**:
   - Direct invocations of the system clock via `new Date()` tied business logic execution directly to wall-clock time.
   - Verifying time-sensitive business logic (such as whether a subscription has expired, or applying the 10% promotional discount during December) could not be tested deterministically without altering system time or patching global objects.

4. **Zero Testability and Fragility**:
   - Because database queries, payment calls, and system time calls were interleaved with business decisions, running unit tests in isolation was impossible. Any testing required spinning up live databases, configuring API keys, and setting external environment state.

---

# Decision: The architectural pattern chosen (Ports & Adapters / Dependency Injection).

To eliminate technical debt and ensure 100% deterministic testability, we refactored the engine onto **Hexagonal Architecture (Ports and Adapters)** combined with **Dependency Injection (Constructor Injection)**:

1. **Pure Domain Core (`src/domain/`)**:
   - The business logic is encapsulated in `SubscriptionBillingService`.
   - The domain layer contains zero dependencies on database drivers, ORMs, HTTP clients, or framework-specific objects.
   - Business entities (`User`, `Subscription`) represent clean data contracts.

2. **Domain Ports (`src/domain/ports/`)**:
   - Clear, abstract interfaces define all inputs and outputs required by domain logic:
     - `ITimeProvider`: Decouples business logic from the system clock, allowing deterministic date injection.
     - `IPaymentGateway`: Defines external payment execution contracts without exposing network/HTTP specifics.
     - `ISubscriptionRepository`: Dictates subscription retrieval and expiration update persistence.
     - `IUserRepository`: Dictates user entity retrieval.

3. **Infrastructure Adapters (`src/infrastructure/adapters/`)**:
   - Concrete implementations satisfy domain ports:
     - `SystemTimeProvider`: Adapts the operating system clock (`new Date()`) for production environments.
     - `PostgresSubscriptionRepository`: Implements `ISubscriptionRepository` via PostgreSQL connection pools.
     - `PostgresUserRepository`: Implements `IUserRepository` via PostgreSQL queries.
     - `MockPaymentGateway` / `StripePaymentAdapter`: Implements `IPaymentGateway` to simulate or execute payment transactions.

4. **Inversion of Control and Composition Root (`src/api/`)**:
   - Dependencies are wired and injected at the boundary layer: `BillingController` acts as a composition root, instantiating the required adapters and injecting them into `SubscriptionBillingService` via constructor injection.

---

# Consequences: Trade-offs (e.g., increased complexity/file count vs. testability).

### Positive Consequences
- **Complete Testability**: The domain service can now be tested with 100% code coverage in complete isolation using fast, in-memory stubs and spies without database or network dependencies.
- **Maintainability & Extensibility**: Adding support for a new payment gateway (e.g., PayPal) or a different database (e.g., MySQL or DynamoDB) requires creating a new adapter without touching core billing business rules (Open/Closed Principle).
- **Determinism**: Time-dependent edge cases (e.g., leap years, December promotions, expired vs unexpired subscriptions) can be simulated instantly.
- **Separation of Concerns**: Infrastructure failures (e.g., network timeout) and business rejections (e.g., subscription not expired) are clearly distinguished and decoupled.

### Trade-offs & Costs
- **Increased File Count and Boilerplate**: Rather than a single file, the architecture requires distinct folders for models, ports, services, adapters, controllers, and tests.
- **Indirection**: Developers unfamiliar with Hexagonal Architecture or Dependency Injection must navigate interfaces and adapters rather than reading linear procedural code.
- **Mapping Overhead**: Entities must be mapped between database rows and domain models.

---

# Code Smells Addressed: Explicitly mapping original smells (temporal coupling, I/O interleaving) to their solutions.

| Original Legacy Code Smell | Description in Legacy Code | Architectural Solution |
| :--- | :--- | :--- |
| **Smell 1: Hardcoded Infrastructure** | `new DatabaseConnection(process.env.DB_URL)` instantiated directly inside method; raw SQL coupled with business rules. | **Repository Pattern & Dependency Inversion (DIP)**: Extracted `ISubscriptionRepository` and `IUserRepository` interfaces. Injected concrete `PostgresSubscriptionRepository` at runtime. |
| **Smell 2: Temporal Coupling (Non-deterministic)** | Direct call to `new Date()` and `now.getMonth() === 11`; impossible to test December discount deterministically without changing machine time. | **Time Provider Port (`ITimeProvider`)**: Extracted `ITimeProvider` port. Injected `SystemTimeProvider` in production and stubbed `mockTimeProvider.getCurrentTime()` in unit tests to test December and non-December paths deterministically. |
| **Smell 3: Direct Third-Party API Calls** | `new ThirdPartyPaymentClient(process.env.PAYMENT_API_KEY)` called directly; network failures crash the service and require live Stripe credentials to test. | **Payment Gateway Port (`IPaymentGateway`)**: Created `IPaymentGateway` interface. Business logic only depends on `charge(customerId, amount): Promise<boolean>`. Concrete `MockPaymentGateway` / `StripePaymentAdapter` injected at runtime. |
| **Smell 4: I/O and Business Logic Interleaving** | Validation, discounts, queries, and network calls were interleaved inside a single procedural block. | **Single Responsibility Principle (SRP)**: Core business rules (December discount, expiration check, 1-year extension) live purely in `SubscriptionBillingService`. All I/O operations are delegated to ports. |
| **Smell 5: Untestable God Class** | Could not verify proration or renewal calculations without external database and API keys. | **Constructor-Injected Test Doubles**: Isolated unit tests in `tests/unit/SubscriptionBillingService.test.ts` execute in milliseconds with 100% branch and statement coverage. |
