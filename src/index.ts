#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { netlifyCommand } from './commands/netlify.js';
import { githubCommand } from './commands/github.js';
import { mongodbCommand } from './commands/mongodb.js';
import { upstashCommand } from './commands/upstash.js';

const program = new Command();

program
  .name('geenius-cli')
  .description('Management CLI for Netlify, GitHub, and MongoDB resources')
  .version('1.0.0');

async function main() {
  while (true) {
    console.log(chalk.blue.bold('🔧 Geenius Management CLI'));
    console.log(chalk.gray('Manage your Netlify, GitHub, and MongoDB resources'));
    console.log();

    const { service } = await inquirer.prompt([
      {
        type: 'list',
        name: 'service',
        message: 'What would you like to manage?',
        choices: [
          { name: '🌐 Netlify Projects (list, rename, delete)', value: 'netlify' },
          { name: '🐙 GitHub Repositories (list, rename, delete)', value: 'github' },
          { name: '🍃 MongoDB Organizations (list, rename, delete + nested projects/clusters)', value: 'mongodb' },
          { name: '🟢 Upstash Resources (Redis, QStash, Vector, Workflow, Search)', value: 'upstash' },
          { name: '❌ Exit', value: 'exit' }
        ]
      }
    ]);

    if (service === 'exit') {
      console.log(chalk.gray('Goodbye! 👋'));
      break;
    }

    switch (service) {
      case 'netlify':
        await netlifyCommand(main);
        break;
      case 'github':
        await githubCommand(main);
        break;
      case 'mongodb':
        await mongodbCommand(main);
        break;
      case 'upstash':
        await upstashCommand(main);
        break;
    }
  }
}

// Add individual commands for direct access
program
  .command('netlify')
  .description('Manage Netlify projects')
  .action(netlifyCommand);

program
  .command('github')
  .description('Manage GitHub repositories')
  .action(githubCommand);

program
  .command('mongodb')
  .description('Manage MongoDB organizations')
  .action(mongodbCommand);

program
  .command('upstash')
  .description('Manage Upstash resources')
  .action(upstashCommand);

// If no specific command is provided, show the interactive menu
if (process.argv.length === 2) {
  main().catch(console.error);
} else {
  program.parse();
}