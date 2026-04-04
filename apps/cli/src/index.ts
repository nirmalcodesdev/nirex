#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { APP_NAME } from '@nirex/shared';

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
    console.log(chalk.green(`Hello, ${name}!`));
    console.log(chalk.blue(`Welcome to the ${APP_NAME} monorepo!`));
  });

program.parse(process.argv);
