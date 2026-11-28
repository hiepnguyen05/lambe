const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const database = new URL(
  process.env.TEST_DATABASE_URL || 'postgresql://localhost/',
).pathname.slice(1);

if (!/^lambe_booking_test_[a-z0-9_]+$/.test(database)) {
  throw new Error(
    'TEST_DATABASE_URL must identify an isolated lambe_booking_test_* database.',
  );
}

function temporarySchema(prefix) {
  return `${prefix}_${randomUUID().replaceAll('-', '')}`;
}

function readMigration(relativePath, stripTransaction = false) {
  const migration = readFileSync(join(__dirname, relativePath), 'utf8');
  return stripTransaction
    ? migration.replace(/^BEGIN;\s*/, '').replace(/COMMIT;\s*$/, '')
    : migration;
}

function runRehearsal(sql, successMessage) {
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      'lambe-postgres',
      'psql',
      '-U',
      'postgres',
      '-d',
      database,
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { input: sql, encoding: 'utf8' },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }
  console.log(successMessage);
}

module.exports = { readMigration, runRehearsal, temporarySchema };
