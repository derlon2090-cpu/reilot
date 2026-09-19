import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

describe('static preview file isolation', () => {
  it('serves public assets while rejecting project files, dotfiles and encoded traversal', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'renvix-preview-test-'));
    await mkdir(path.join(root, 'public/app'), { recursive: true });
    await writeFile(path.join(root, 'index.html'), '<p>preview</p>');
    await writeFile(path.join(root, 'public/app/test.js'), 'public asset');
    await writeFile(path.join(root, '.env'), 'SENSITIVE_TEST_VALUE');
    await writeFile(path.join(root, 'package.json'), '{"private":"SENSITIVE_TEST_VALUE"}');
    await writeFile(path.join(root, 'public/app/.env'), 'SENSITIVE_TEST_VALUE');
    const child = spawn(process.execPath, [path.resolve('server.mjs')], {
      env: { ...process.env, NODE_ENV: 'test', SERVE_DIR: root, PORT: '0', PREVIEW_BIND_HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe']
    });
    try {
      const base = await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Preview did not start')), 5000);
        child.once('error', error => { clearTimeout(timer); reject(error); });
        child.stdout.on('data', data => {
          const match = String(data).match(/http:\/\/127\.0\.0\.1:\d+/);
          if (match) { clearTimeout(timer); resolve(match[0]); }
        });
      });
      expect((await fetch(base)).status).toBe(200);
      expect((await fetch(`${base}/pricing`)).status).toBe(200);
      expect(await (await fetch(`${base}/app/test.js`)).text()).toBe('public asset');
      for (const probe of ['/.env', '/package.json', '/src/server/db.js', '/app/.env', '/app/%2e%2e%2f%2e%2e%2f.env', '/app/%5c..%5c.env']) {
        const response = await fetch(`${base}${probe}`);
        expect(response.status, probe).toBe(404);
        expect(await response.text()).not.toContain('SENSITIVE_TEST_VALUE');
      }
    } finally {
      child.kill();
      // Wait for the process to release its file handles before fixture cleanup.
      if (child.exitCode === null) await new Promise(resolve => child.once('exit', resolve));
      if (path.dirname(path.resolve(root)) !== path.resolve(os.tmpdir())
        || !path.basename(root).startsWith('renvix-preview-test-')) throw new Error('Invalid fixture cleanup target');
      await rm(root, { recursive: true, force: true });
    }
  });
});
