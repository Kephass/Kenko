import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const clientRoot = fileURLToPath(new URL('../', import.meta.url));
const directory = await mkdtemp(join(tmpdir(), 'kenko-tests-'));
try {
  const outfile = join(directory, 'tracking.test.cjs');
  await build({
    absWorkingDir: clientRoot, entryPoints: ['tests/tracking.test.mjs'], outfile, bundle: true, platform: 'node', format: 'cjs',
    plugins: [{ name: 'test-supabase', setup(build) {
      build.onResolve({ filter: /(?:^@\/lib\/supabase$|^\.\/supabase$)/ }, () => ({ path: resolve(clientRoot, 'tests/supabase.mock.mjs') }));
    }}],
  });
  const result = spawnSync(process.execPath, ['--test', outfile], { stdio: 'inherit', env: { ...process.env, TZ: 'Europe/Brussels' } });
  process.exitCode = result.status ?? 1;
} finally { await rm(directory, { recursive: true, force: true }); }
