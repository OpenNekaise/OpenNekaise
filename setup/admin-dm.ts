/**
 * Step: admin-dm — Configure the admin DM JID allowlist in .env.
 * This forces DM access through explicit channel IDs.
 */
import fs from 'fs';
import path from 'path';

import { logger } from '../src/logger.js';
import { emitStatus } from './status.js';

interface AdminDmArgs {
  jid: string;
}

function parseArgs(args: string[]): AdminDmArgs {
  const result: AdminDmArgs = { jid: '' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--jid') result.jid = (args[i + 1] || '').trim();
  }
  return result;
}

function isDmJid(jid: string): boolean {
  return jid.startsWith('slack:D') || jid.endsWith('@s.whatsapp.net');
}

function upsertEnvVar(content: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(content)) return content.replace(pattern, line);
  const suffix = content.endsWith('\n') || content.length === 0 ? '' : '\n';
  return `${content}${suffix}${line}\n`;
}

export async function run(args: string[]): Promise<void> {
  const projectRoot = process.cwd();
  const parsed = parseArgs(args);

  if (!parsed.jid || !isDmJid(parsed.jid)) {
    emitStatus('ADMIN_DM', {
      STATUS: 'failed',
      ERROR: 'invalid_or_missing_dm_jid',
      LOG: 'logs/setup.log',
    });
    process.exit(4);
  }

  const envFile = path.join(projectRoot, '.env');
  let envContent = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf-8') : '';

  envContent = upsertEnvVar(envContent, 'ADMIN_DM_JID', parsed.jid);
  envContent = upsertEnvVar(envContent, 'ALLOWED_DM_JIDS', parsed.jid);
  fs.writeFileSync(envFile, envContent);

  // Keep container env in sync with host .env
  const containerEnvDir = path.join(projectRoot, 'data', 'env');
  fs.mkdirSync(containerEnvDir, { recursive: true });
  fs.copyFileSync(envFile, path.join(containerEnvDir, 'env'));

  logger.info(
    { adminDmJid: parsed.jid },
    'Configured admin DM JID and DM allowlist',
  );

  emitStatus('ADMIN_DM', {
    ADMIN_DM_JID: parsed.jid,
    ALLOWED_DM_JIDS: parsed.jid,
    STATUS: 'success',
    LOG: 'logs/setup.log',
  });
}

