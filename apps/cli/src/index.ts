#!/usr/bin/env node
import { Command } from 'commander';
import { APP_NAME } from '@nirex/shared';
import { helloCommand } from './commands/hello.js';
import { checkPlanExpiryCommand } from './commands/check-plan-expiry.js';
import { loadConfig } from './utils/config.js';

const program = new Command();

program
  .name(APP_NAME.toLowerCase())
  .description(`${APP_NAME} Project CLI`)
  .version('1.0.0');

program
  .command('hello')
  .description('Say hello to the user')
  .argument('[name]', 'The name of the user', 'World')
  .action((name: string) => {
    helloCommand(name);
  });

program
  .command('check-plan-expiry')
  .description('Verify billing plan expiry behavior through live billing APIs')
  .option(
    '--base-url <url>',
    'Backend API base URL',
    process.env.NIREX_API_BASE_URL ?? 'http://localhost:3001/api/v1',
  )
  .option(
    '--api-key <key>',
    'API key with billing:read and billing:write scopes',
    process.env.NIREX_API_KEY,
  )
  .option('--plan-id <planId>', 'Plan to use for checkout probe', 'pro')
  .option('--billing-cycle <cycle>', 'Billing cycle for checkout probe', 'month')
  .option(
    '--timeout-ms <ms>',
    'HTTP timeout in milliseconds',
    (value: string) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed < 1000) {
        throw new Error('timeout-ms must be an integer >= 1000');
      }
      return parsed;
    },
    15000,
  )
  .option('--skip-checkout-probe', 'Skip checkout-session behavior check', false)
  .action(
    async (opts: {
      baseUrl: string;
      apiKey?: string;
      planId: string;
      billingCycle: string;
      timeoutMs: number;
      skipCheckoutProbe: boolean;
    }) => {
      await checkPlanExpiryCommand(opts);
    },
  );

program
  .command('config')
  .description('Manage Nirex CLI configuration')
  .command('show')
  .description('Show current effective configuration')
  .action(() => {
    const config = loadConfig();
    console.log(JSON.stringify(config, null, 2));
  });

void program.parseAsync(process.argv);
