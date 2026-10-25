import { execSync } from 'node:child_process';

const token = process.env.GH_TOKEN;

if (!token) {
  console.log('preinstall: GH_TOKEN not set — skipping GitHub SSH→HTTPS rewrite (ok for local dev)');
  process.exit(0);
}

const httpsUrl = `https://x-access-token:${token}@github.com/`;

try {
  execSync(`git config --global url."${httpsUrl}".insteadOf git@github.com:`, { stdio: 'inherit' });
  execSync(`git config --global url."${httpsUrl}".insteadOf ssh://git@github.com/`, { stdio: 'inherit' });
  console.log('preinstall: rewrote GitHub SSH URLs to HTTPS with token');
} catch (err) {
  console.error('preinstall: failed to configure git', err.message);
  process.exit(1);
}
