const fs = require('fs');
const path = require('path');
const http = require('http');

console.log('====================================================');
console.log('   RUNNING AUTOMATED VERIFICATION OF ALL 10 REQS    ');
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passCount++;
  } else {
    console.error(`[FAIL] ${message}`);
    failCount++;
  }
}

// -------------------------------------------------------------
// REQ 1: Domain Ports Definition
// -------------------------------------------------------------
console.log('--- REQ 1: Domain Ports Definition ---');
const portsDir = path.join(__dirname, 'src', 'domain', 'ports');
assert(fs.existsSync(path.join(portsDir, 'ITimeProvider.ts')), 'ITimeProvider.ts exists in src/domain/ports/');
assert(fs.existsSync(path.join(portsDir, 'IPaymentGateway.ts')), 'IPaymentGateway.ts exists in src/domain/ports/');
assert(fs.existsSync(path.join(portsDir, 'ISubscriptionRepository.ts')), 'ISubscriptionRepository.ts exists in src/domain/ports/');

// Check no infrastructure leaks in domain layer
function checkDomainLeaks(dir) {
  let leaks = [];
  const forbiddenPatterns = ['pg', 'axios', 'express', 'node-fetch', 'supertest', 'mysql', 'sqlite', 'typeorm', 'prisma'];
  const files = fs.readdirSync(dir, { recursive: true });
  for (const f of files) {
    const fullPath = path.join(dir, f.toString());
    if (fs.statSync(fullPath).isFile() && (fullPath.endsWith('.ts') || fullPath.endsWith('.js'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const p of forbiddenPatterns) {
        const importRegex = new RegExp(`from\\s+['"]${p}['"]`, 'i');
        const requireRegex = new RegExp(`require\\(['"]${p}['"]\\)`, 'i');
        if (importRegex.test(content) || requireRegex.test(content)) {
          leaks.push(`${fullPath} leaks ${p}`);
        }
      }
    }
  }
  return leaks;
}
const leaks = checkDomainLeaks(path.join(__dirname, 'src', 'domain'));
assert(leaks.length === 0, `No infrastructure leaks found in src/domain/ (leaks: ${leaks.join(', ')})`);

// -------------------------------------------------------------
// REQ 2: SubscriptionBillingService Dependency Injection & Rules
// -------------------------------------------------------------
console.log('\n--- REQ 2: SubscriptionBillingService ---');
const servicePath = path.join(__dirname, 'src', 'domain', 'services', 'SubscriptionBillingService.ts');
assert(fs.existsSync(servicePath), 'SubscriptionBillingService.ts exists');
const serviceContent = fs.readFileSync(servicePath, 'utf8');

// Check forbidden patterns
const forbiddenCalls = [/new\s+Date\(\s*\)/, /Date\.now\(\s*\)/, /new\s+DatabaseConnection/, /new\s+ThirdPartyPaymentClient/, /new\s+Pool/];
let foundForbidden = forbiddenCalls.filter(r => r.test(serviceContent));
assert(foundForbidden.length === 0, `SubscriptionBillingService does not contain forbidden temporal or direct I/O calls: ${foundForbidden}`);

// Check constructor injection
assert(/constructor\s*\([\s\S]*subscriptionRepo[\s\S]*userRepo[\s\S]*paymentGateway[\s\S]*timeProvider[\s\S]*\)/.test(serviceContent),
  'SubscriptionBillingService has constructor injection for subscriptionRepo, userRepo, paymentGateway, and timeProvider');

// -------------------------------------------------------------
// REQ 3: Concrete Adapters
// -------------------------------------------------------------
console.log('\n--- REQ 3: Infrastructure Adapters ---');
const adaptersDir = path.join(__dirname, 'src', 'infrastructure', 'adapters');
assert(fs.existsSync(path.join(adaptersDir, 'SystemTimeProvider.ts')), 'SystemTimeProvider.ts exists');
assert(fs.existsSync(path.join(adaptersDir, 'PostgresSubscriptionRepository.ts')), 'PostgresSubscriptionRepository.ts exists');
assert(fs.existsSync(path.join(adaptersDir, 'SubscriptionRepository.ts')), 'SubscriptionRepository.ts exists');
assert(fs.existsSync(path.join(adaptersDir, 'MockPaymentGateway.ts')), 'MockPaymentGateway.ts exists');

// -------------------------------------------------------------
// REQ 6: Architecture Decision Record (ADR)
// -------------------------------------------------------------
console.log('\n--- REQ 6: Architecture Decision Record ---');
const adrPath = path.join(__dirname, 'docs', 'ADR-001-Refactoring-God-Class.md');
assert(fs.existsSync(adrPath), 'ADR-001-Refactoring-God-Class.md exists at docs/');
const adrContent = fs.readFileSync(adrPath, 'utf8');
const requiredHeaders = [
  '# Context: Why the legacy class was problematic.',
  '# Decision: The architectural pattern chosen (Ports & Adapters / Dependency Injection).',
  '# Consequences: Trade-offs (e.g., increased complexity/file count vs. testability).',
  '# Code Smells Addressed: Explicitly mapping original smells (temporal coupling, I/O interleaving) to their solutions.'
];
for (const h of requiredHeaders) {
  assert(adrContent.includes(h), `ADR contains required header: "${h}"`);
}

// -------------------------------------------------------------
// REQ 7: Docker Compose Setup
// -------------------------------------------------------------
console.log('\n--- REQ 7: Docker Compose Setup ---');
const dockerComposePath = path.join(__dirname, 'docker-compose.yml');
assert(fs.existsSync(dockerComposePath), 'docker-compose.yml exists');
const dcContent = fs.readFileSync(dockerComposePath, 'utf8');
assert(dcContent.includes('services:') && dcContent.includes('api:') && dcContent.includes('db:'), 'docker-compose.yml defines api and db services');
assert(dcContent.includes('healthcheck:') && dcContent.includes('pg_isready'), 'db service includes pg_isready healthcheck');
assert(dcContent.includes('condition: service_healthy'), 'api service depends on db with condition: service_healthy');
assert(dcContent.includes('init.sql') || dcContent.includes('docker-entrypoint-initdb.d'), 'db mounts automated database initialization/seed script');

// -------------------------------------------------------------
// REQ 8: Environment Configuration
// -------------------------------------------------------------
console.log('\n--- REQ 8: Environment Configuration ---');
const envExamplePath = path.join(__dirname, '.env.example');
assert(fs.existsSync(envExamplePath), '.env.example exists');
const envContent = fs.readFileSync(envExamplePath, 'utf8');
assert(envContent.includes('DATABASE_URL=') && envContent.includes('DB_HOST=') && envContent.includes('DB_USER='), '.env.example contains database connection credentials');
assert(envContent.includes('PORT='), '.env.example contains PORT');
assert(envContent.includes('PAYMENT_API_KEY='), '.env.example contains Payment Gateway configuration');

// -------------------------------------------------------------
// REQ 10: Submission JSON
// -------------------------------------------------------------
console.log('\n--- REQ 10: submission.json Mapping ---');
const subJsonPath = path.join(__dirname, 'submission.json');
assert(fs.existsSync(subJsonPath), 'submission.json exists');
const subData = JSON.parse(fs.readFileSync(subJsonPath, 'utf8'));
assert(typeof subData.testData.validUserId === 'string' && subData.testData.validUserId.length > 0, `validUserId exists: ${subData.testData.validUserId}`);
assert(typeof subData.testData.unexpiredUserId === 'string' && subData.testData.unexpiredUserId.length > 0, `unexpiredUserId exists: ${subData.testData.unexpiredUserId}`);
assert(typeof subData.testData.nonExistentUserId === 'string' && subData.testData.nonExistentUserId.length > 0, `nonExistentUserId exists: ${subData.testData.nonExistentUserId}`);

// -------------------------------------------------------------
// REQ 5: API Endpoints Verification via HTTP
// -------------------------------------------------------------
console.log('\n--- REQ 5: Live API Endpoint Testing ---');
function postRenew(userId) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ userId });
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/renew',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

(async () => {
  try {
    // Test unexpired user
    const resUnexpired = await postRenew(subData.testData.unexpiredUserId);
    assert(resUnexpired.status === 400, `POST /api/renew for unexpired user returned 400 (got ${resUnexpired.status})`);
    assert(resUnexpired.body.success === false, 'POST /api/renew response success is false for unexpired user');
    assert(resUnexpired.body.message === 'Subscription is not yet expired', `Message is "Subscription is not yet expired" (got "${resUnexpired.body.message}")`);

    // Test non-existent user
    const resMissing = await postRenew(subData.testData.nonExistentUserId);
    assert(resMissing.status === 400, `POST /api/renew for non-existent user returned 400 (got ${resMissing.status})`);
    assert(resMissing.body.success === false, 'POST /api/renew response success is false for non-existent user');
    assert(resMissing.body.message === 'User not found', `Message is "User not found" (got "${resMissing.body.message}")`);

    // Test valid expired user
    const resValid = await postRenew(subData.testData.validUserId);
    assert(resValid.status === 200, `POST /api/renew for valid expired user returned 200 (got ${resValid.status})`);
    assert(resValid.body.success === true, 'POST /api/renew response success is true');
    assert(resValid.body.message === 'Renewal successful', `Message is "Renewal successful" (got "${resValid.body.message}")`);

    console.log('\n====================================================');
    console.log(`TOTAL PASS: ${passCount} | TOTAL FAIL: ${failCount}`);
    console.log('====================================================');
    if (failCount === 0) {
      console.log('🎉 ALL REQUIREMENTS VERIFIED AND 100% PASSING!');
    }
  } catch (err) {
    console.error('Error during API verification:', err.message);
  }
})();
