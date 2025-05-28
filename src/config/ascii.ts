import chalk from 'chalk';
import gradient from 'gradient-string';

export const ASCII_LOGO = gradient.pastel(`
    ███████╗██╗    ██╗██╗████████╗ ██████╗██╗  ██╗    █████╗ ██╗
    ██╔════╝██║    ██║██║╚══██╔══╝██╔════╝██║  ██║  ██╔══██╗██║
    ███████╗██║ █╗ ██║██║   ██║   ██║     ███████║  ███████║██║     
    ╚════██║██║███╗██║██║   ██║   ██║     ██╔══██║  ██╔══██║██║
    ███████║╚███╔███╔╝██║   ██║   ╚██████╗██║  ██║  ██║  ██║██║
    ╚══════╝ ╚══╝╚══╝ ╚═╝   ╚═╝    ╚═════╝╚═╝  ╚═╝  ╚═╝  ╚═╝╚═╝

    Your Mechanical Switch Assistant
`);

export const ENV_INFO = (env: string) => chalk.yellow(`Environment: ${env}`);

export const SERVICE_READY = chalk.green('✓ Service Ready!');

export const DATABASE_CONNECTED = chalk.green('✓ Database Connection Success!');

export const LLM_READY = chalk.green('✓ LLM Service Ready!');

export const SERVER_READY = (port: number) =>
  chalk.green(`✓ Server Ready! 🚀 http://localhost:${port}`);
