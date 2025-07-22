// cli/commands/compare-agents.ts
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { ConfigManager } from '../../src/utils/config';
import { logger } from '../../src/utils/logger';
import { formatDuration } from '../../src/utils/helpers';
import { AgentService } from '../agent/agent-service';

export async function compareAgentsCommand(options: any = {}): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.loadConfig();
  
  if (!config) {
    console.log(chalk.red('No project found. Run "dev-agent init" first.'));
    return;
  }

  try {
    const providers = options.providers ? options.providers.split(',') : ['openai', 'anthropic', 'google', 'grok'];
    
    const { taskDescription } = await inquirer.prompt([
      {
        type: 'input',
        name: 'taskDescription',
        message: 'Task for comparison:',
        default: 'Create a simple React component with state management and TypeScript'
      }
    ]);

    const spinner = ora('Running agent comparison...').start();
    
    logger.info('Starting agent comparison', { 
      providers, 
      task: taskDescription,
      project: config.name
    });
    
    // Initialize agent service
    const agentService = new AgentService(config.repoUrl, {
      type: 'single',
      provider: config.aiProvider
    });

    await agentService.initializeProject(config.repoUrl);
    
    spinner.text = 'Comparing agents across providers...';
    const comparison = await agentService.runAgentComparison(taskDescription, providers);

    spinner.succeed('Agent comparison completed!');
    
    logger.info('Agent comparison completed', {
      bestApproach: comparison.bestApproach,
      providersCompared: providers.length
    });
    
    // Display results
    console.log(chalk.blue('\n📊 Agent Comparison Results'));
    console.log(chalk.gray('Task:'), taskDescription);
    console.log(chalk.gray('Best Approach:'), chalk.green(comparison.bestApproach.toUpperCase()));
    console.log(chalk.gray('Providers Compared:'), providers.length);
    
    // Speed comparison
    console.log(chalk.blue('\n⚡ Speed Comparison:'));
    const speedEntries = Array.from(comparison.comparison.speed.entries())
      .sort((a, b) => a[1] - b[1]);
    
    speedEntries.forEach(([provider, time], index) => {
      const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
      console.log(`${emoji} ${provider}: ${formatDuration(time)}`);
    });
    
    // Quality comparison
    console.log(chalk.blue('\n🎯 Quality Scores:'));
    const qualityEntries = Array.from(comparison.comparison.quality.entries())
      .sort((a, b) => b[1] - a[1]);
    
    qualityEntries.forEach(([provider, score], index) => {
      const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
      const color = score >= 90 ? chalk.green : score >= 70 ? chalk.yellow : chalk.red;
      console.log(`${emoji} ${provider}: ${color(score + '/100')}`);
    });
    
    // Creativity comparison
    console.log(chalk.blue('\n🎨 Creativity Scores:'));
    const creativityEntries = Array.from(comparison.comparison.creativity.entries())
      .sort((a, b) => b[1] - a[1]);
    
    creativityEntries.forEach(([provider, score], index) => {
      const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
      const color = score >= 90 ? chalk.green : score >= 70 ? chalk.yellow : chalk.red;
      console.log(`${emoji} ${provider}: ${color(score + '/100')}`);
    });

    // Recommendations
    console.log(chalk.blue('\n💡 Recommendations:'));
    const best = comparison.bestApproach;
    const fastestProvider = speedEntries[0][0];
    const highestQuality = qualityEntries[0][0];
    const mostCreative = creativityEntries[0][0];
    
    console.log(chalk.gray('• Overall Best:'), chalk.green(best));
    console.log(chalk.gray('• Fastest:'), chalk.cyan(fastestProvider));
    console.log(chalk.gray('• Highest Quality:'), chalk.blue(highestQuality));
    console.log(chalk.gray('• Most Creative:'), chalk.magenta(mostCreative));

  } catch (error) {
    logger.error('Compare agents command failed', error);
    console.error(chalk.red(`\n❌ Comparison failed: ${error.message}`));
    process.exit(1);
  }
}

