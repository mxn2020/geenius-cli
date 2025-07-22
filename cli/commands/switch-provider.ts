// cli/commands/switch-provider.ts
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { ConfigManager } from '../../src/utils/config';
import { logger } from '../../src/utils/logger';
import { validateApiKey } from '../../src/utils/validation';
import { AgentService } from '../agent/agent-service';

export async function switchProviderCommand(): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.loadConfig();
  
  if (!config) {
    console.log(chalk.red('No project found. Run "dev-agent init" first.'));
    return;
  }

  try {
    const { newProvider, newApiKey, newModel } = await inquirer.prompt([
      {
        type: 'list',
        name: 'newProvider',
        message: `Switch from ${config.aiProvider.toUpperCase()} to:`,
        choices: [
          { name: '🤖 Claude (Anthropic)', value: 'anthropic' },
          { name: '🧠 GPT-4 (OpenAI)', value: 'openai' },
          { name: '✨ Gemini (Google)', value: 'google' },
          { name: '⚡ Grok (X.AI)', value: 'grok' }
        ].filter(choice => choice.value !== config.aiProvider)
      },
      {
        type: 'password',
        name: 'newApiKey',
        message: 'Enter new API key:',
        mask: '*',
        validate: (input, answers) => {
          if (!input) return 'API key is required';
          if (!validateApiKey(answers.newProvider, input)) {
            return 'Invalid API key format for this provider';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'newModel',
        message: 'Model (optional):',
        default: (answers) => getDefaultModel(answers.newProvider)
      }
    ]);

    const spinner = ora('Switching AI provider...').start();
    
    try {
      // Initialize agent service with current config
      const agentService = new AgentService(config.repoUrl, {
        type: config.agentMode,
        provider: config.aiProvider
      });

      await agentService.initializeProject(config.repoUrl);
      
      // Switch provider
      await agentService.switchProvider(newProvider, newApiKey);

      // Update configuration
      const updatedConfig = {
        ...config,
        aiProvider: newProvider,
        apiKey: newApiKey,
        model: newModel,
        updatedAt: new Date().toISOString()
      };

      await configManager.saveConfig(updatedConfig);
      
      spinner.succeed(`Switched to ${newProvider.toUpperCase()}!`);
      
      logger.info('AI provider switched', {
        from: config.aiProvider,
        to: newProvider,
        project: config.name
      });
      
      console.log(chalk.green(`\n✅ Successfully switched to ${newProvider.toUpperCase()}`));
      console.log(chalk.gray('Model:'), newModel);
      console.log(chalk.gray('Updated:'), new Date().toLocaleString());
      
    } catch (error) {
      spinner.fail('Provider switch failed');
      throw error;
    }

  } catch (error) {
    logger.error('Switch provider command failed', error);
    console.error(chalk.red(`\n❌ Provider switch failed: ${error.message}`));
    process.exit(1);
  }
}

function getDefaultModel(provider: string): string {
  const defaults = {
    anthropic: 'claude-sonnet-4-20250514',
    openai: 'gpt-4-turbo',
    google: 'gemini-pro',
    grok: 'grok-beta'
  };
  
  return defaults[provider] || 'gpt-4';
}

