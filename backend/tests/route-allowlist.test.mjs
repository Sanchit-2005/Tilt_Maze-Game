import assert from 'node:assert/strict';

const port = process.env.PORT || 5000;
const baseUrl = process.env.TEST_BASE_URL || `http://localhost:${port}`;

const blockedRoutes = [
  '/backend/server.js',
  '/.env',
  '/backend/package.json',
  '/node_modules/',
  '/.git/config',
  '/backend/scripts/createAdmin.js',
];

for (const route of blockedRoutes) {
  const response = await fetch(`${baseUrl}${route}`);
  console.log(`GET ${route}: ${response.status}`);
  assert.equal(response.status, 404, `GET ${route} must return 404`);
}

console.log('Route allowlist test passed: private paths are not public.');
