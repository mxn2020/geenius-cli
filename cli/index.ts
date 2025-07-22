// cli/index.ts
import 'dotenv/config';
import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init';
import { developCommand } from './commands/develop';
import { statusCommand } from './commands/status';
import { compareAgentsCommand } from './commands/compare-agents';
import { memoryCommand } from './commands/memory';
import { switchProviderCommand } from './commands/switch-provider';
import { manageCommand } from './commands/manage';
import { logger } from '../src/utils/logger';

const program = new Command();

program
  .name('dev-agent')
  .description('AI-powered development workflow with custom agents and multi-provider support')
  .version('3.0.0');

program
  .command('init')
  .description('Initialize a new project with AI agent and auto-setup (GitHub, Netlify, MongoDB)')
  .action(async () => {
    try {
      await initCommand();
    } catch (error) {
      logger.error('Init command error', error);
      process.exit(1);
    }
  });

program
  .command('develop')
  .description('Start AI-powered development session')
  .option('-f, --feature <name>', 'Feature branch name')
  .option('-c, --complexity <level>', 'Task complexity (simple/medium/complex)')
  .option('-m, --mode <mode>', 'Agent mode override (single/orchestrated/auto)')
  .option('-p, --priority <level>', 'Task priority (low/medium/high/urgent)')
  .action(async (options) => {
    try {
      await developCommand(options);
    } catch (error) {
      logger.error('Develop command error', error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show comprehensive project and agent status')
  .action(async () => {
    try {
      await statusCommand();
    } catch (error) {
      logger.error('Status command error', error);
      process.exit(1);
    }
  });

program
  .command('compare-agents')
  .description('Compare different AI providers on a task')
  .option('-p, --providers <providers>', 'Comma-separated list of providers')
  .action(async (options) => {
    try {
      await compareAgentsCommand(options);
    } catch (error) {
      logger.error('Compare agents command error', error);
      process.exit(1);
    }
  });

program
  .command('memory')
  .description('Manage agent memory')
  .option('-e, --export', 'Export agent memory')
  .option('-i, --import <file>', 'Import agent memory')
  .option('-c, --clear', 'Clear agent memory')
  .action(async (options) => {
    try {
      await memoryCommand(options);
    } catch (error) {
      logger.error('Memory command error', error);
      process.exit(1);
    }
  });

program
  .command('switch-provider')
  .description('Switch AI provider for existing project')
  .action(async () => {
    try {
      await switchProviderCommand();
    } catch (error) {
      logger.error('Switch provider command error', error);
      process.exit(1);
    }
  });

program
  .command('manage')
  .description('Manage Netlify projects, GitHub repositories, and MongoDB clusters')
  .action(async () => {
    try {
      await manageCommand();
    } catch (error) {
      logger.error('Manage command error', error);
      process.exit(1);
    }
  });

program
  .command('setup')
  .description('Show setup instructions for environment variables')
  .action(async () => {
    try {
      console.log(chalk.blue.bold('🔧 Environment Setup Guide\n'));
      
      console.log(chalk.yellow('Required:'));
      console.log(chalk.white('  GITHUB_TOKEN - GitHub Personal Access Token'));
      console.log(chalk.gray('    Get from: https://github.com/settings/tokens'));
      console.log(chalk.gray('    Required scopes: repo, user, read:org\n'));
      
      console.log(chalk.white('  AI Provider API Key (at least one):'));
      console.log(chalk.gray('    ANTHROPIC_API_KEY - https://console.anthropic.com/'));
      console.log(chalk.gray('    OPENAI_API_KEY - https://platform.openai.com/api-keys'));
      console.log(chalk.gray('    GOOGLE_API_KEY - https://makersuite.google.com/app/apikey'));
      console.log(chalk.gray('    GROK_API_KEY - https://x.ai/api\n'));
      
      console.log(chalk.yellow('Optional (for auto-setup):'));
      console.log(chalk.white('  NETLIFY_TOKEN - Netlify Personal Access Token'));
      console.log(chalk.gray('    Get from: https://app.netlify.com/user/applications#personal-access-tokens\n'));
      
      console.log(chalk.white('  MongoDB Atlas API Keys:'));
      console.log(chalk.gray('    MONGODB_ATLAS_PUBLIC_KEY & MONGODB_ATLAS_PRIVATE_KEY'));
      console.log(chalk.gray('    Get from: https://cloud.mongodb.com/v2#/org/YOUR_ORG_ID/access/apiKeys'));
      console.log(chalk.gray('    Required permissions: Project Creator\n'));
      
      console.log(chalk.green('💡 Copy .env.example to .env and fill in your values!'));
    } catch (error) {
      logger.error('Setup command error', error);
      process.exit(1);
    }
  });

// Global error handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

program.parse();