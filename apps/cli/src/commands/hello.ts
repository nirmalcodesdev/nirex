import chalk from 'chalk';
import { APP_NAME } from '@nirex/shared';

export function helloCommand(name: string = 'World'): void {
  console.log(chalk.green(`Hello, ${name}!`));
  console.log(chalk.blue(`Welcome to the ${APP_NAME} monorepo!`));
}
