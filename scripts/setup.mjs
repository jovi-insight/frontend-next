import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
if (!existsSync('.env.local')) {
  writeFileSync('.env.local', `NEXT_PUBLIC_API_URL=https://backend-rhlz.onrender.com\nSESSION_SECRET=${randomBytes(32).toString('hex')}\nDEMO_EMAIL=professor@insight.com\nDEMO_PASSWORD=Insight@2026\n`, { mode: 0o600 });
  console.log('.env.local criado com chave de sessão exclusiva.');
} else console.log('.env.local já existe; configuração preservada.');
