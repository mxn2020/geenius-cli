// cli/commands/memory.ts
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { ConfigManager } from '../../src/utils/config';
import { logger } from '../../src/utils/logger';
import { AgentService } from '../agent/agent-service';

export async function memoryCommand(options: any = {}): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.loadConfig();
  
  if (!config) {
    console.log(chalk.red('No project found. Run "dev-agent init" first.'));
    return;
  }

  try {
    const agentService = new AgentService(config.repoUrl, {
      type: config.agentMode,
      provider: config.aiProvider
    });

    await agentService.initializeProject(config.repoUrl);

    if (options.export) {
      const spinner = ora('Exporting agent memory...').start();
      
      const memory = await agentService.exportAgentMemory();
      const fs = await import('fs/promises');
      const filename = `agent-memory-${Date.now()}.json`;
      
      await fs.writeFile(filename, memory);
      
      spinner.succeed(`Agent memory exported to ${filename}`);
      logger.info('Agent memory exported', { filename });
      
      console.log(chalk.green(`✅ Agent memory exported to ${filename}`));
    }

    if (options.import) {
      const spinner = ora('Importing agent memory...').start();
      
      const fs = await import('fs/promises');
      const memory = await fs.readFile(options.import, 'utf-8');
      
      await agentService.importAgentMemory(memory);
      
      spinner.succeed('Agent memory imported successfully');
      logger.info('Agent memory imported', { filename: options.import });
      
      console.log(chalk.green('✅ Agent memory imported successfully'));
    }

    if (options.clear) {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Are you sure you want to clear all agent memory?',
          default: false
        }
      ]);

      if (confirm) {
        const spinner = ora('Clearing agent memory...').start();
        
        // Clear memory implementation would go here
        await agentService.clearAgentMemory();
        
        spinner.succeed('Agent memory cleared');
        logger.info('Agent memory cleared');
        
        console.log(chalk.green('✅ Agent memory cleared'));
      } else {
        console.log(chalk.yellow('Memory clear cancelled'));
      }
    }

    if (!options.export && !options.import && !options.clear) {
      // Show memory stats
      const spinner = ora('Analyzing agent memory...').start();
      
      const analytics = await agentService.getAgentAnalytics();
      const memoryStats = analytics.agentStats;
      
      spinner.succeed('Memory analysis complete');
      
      console.log(chalk.blue.bold('\n🧠 Agent Memory Status'));
      
      if (memoryStats) {
        for (const [agent, stats] of memoryStats.entries()) {
          console.log(chalk.blue(`\n📊 ${agent.toUpperCase()} Agent:`));
          console.log(chalk.gray('  Conversations:'), stats.conversations);
          console.log(chalk.gray('  Tasks:'), stats.tasks);
          console.log(chalk.gray('  Patterns:'), stats.patterns);
          console.log(chalk.gray('  Success Rate:'), `${(stats.successRate * 100).toFixed(1)}%`);
        }
      }
      
      console.log(chalk.blue('\n💡 Memory Management:'));
      console.log(chalk.gray('  Export:'), 'dev-agent memory --export');
      console.log(chalk.gray('  Import:'), 'dev-agent memory --import <file>');
      console.log(chalk.gray('  Clear:'), 'dev-agent memory --clear');
    }

  } catch (error) {
    logger.error('Memory command failed', error);
    console.error(chalk.red(`\n❌ Memory operation failed: ${error.message}`));
    process.exit(1);
  }
}

