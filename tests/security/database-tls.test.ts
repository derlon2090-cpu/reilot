import { describe, it, expect } from 'vitest';
import { databaseConnectionOptions } from '../../src/server/db.js';

describe('database TLS configuration', () => {
  it('verifies server certificates and prevents URL parameters overriding the configured CA', () => {
    const options = databaseConnectionOptions({ DATABASE_URL: 'postgres://test:test@db.example/test?sslmode=no-verify', DATABASE_SSL_CA: 'certificate\\nline' });
    expect(options.ssl).toEqual({ rejectUnauthorized: true, ca: 'certificate\nline' });
    expect(options.connectionString).not.toContain('sslmode');
  });
  it('keeps an explicit private-network non-TLS configuration supported', () => {
    expect(databaseConnectionOptions({ DATABASE_URL: 'postgres://test:test@database/test', DATABASE_SSL: 'false' }).ssl).toBe(false);
  });
});
