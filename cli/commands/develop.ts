// cli/commands/develop.ts
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { ConfigManager } from '../../src/utils/config';
import { validateInput, DevelopCommandSchema } from '../../src/utils/validation';
import { logger } from '../../src/utils/logger';
import { generateTaskId } from '../../src/utils/helpers';
import { GitHubService } from '../services/github';
import { AgentService } from '../agent/agent-service';
import type { DevelopOptions } from '../../src/types/config';

export async function developCommand(options: any = {}): Promise<void> {
  const configManager = new ConfigManager();
  const config = await configManager.loadConfig();
  
  if (!config) {
    console.log(chalk.red('No project found. Run "dev-agent init" first.'));
    return;
  }

  try {
    const developmentOptions = await inquirer.prompt([
      {
        type: 'input',
        name: 'featureName',
        message: 'Feature branch name:',
        default: options.feature || `feature/ai-${Date.now()}`
      },
      {
        type: 'list',
        name: 'complexity',
        message: 'Task complexity:',
        choices: [
          { name: '🟢 Simple - Bug fixes, small updates', value: 'simple' },
          { name: '🟡 Medium - New features, refactoring', value: 'medium' },
          { name: '🔴 Complex - Architecture changes, integrations', value: 'complex' }
        ],
        default: options.complexity || 'medium'
      },
      {
        type: 'list',
        name: 'priority',
        message: 'Task priority:',
        choices: [
          { name: '🔥 Urgent - Critical fixes', value: 'urgent' },
          { name: '🔴 High - Important features', value: 'high' },
          { name: '🟡 Medium - Regular development', value: 'medium' },
          { name: '🟢 Low - Nice to have', value: 'low' }
        ],
        default: options.priority || 'medium'
      },
      {
        type: 'list',
        name: 'preferredMode',
        message: 'Agent mode for this task:',
        choices: [
          { name: '🎯 Single Agent - Fast execution', value: 'single' },
          { name: '👥 Multi-Agent Team - Comprehensive approach', value: 'orchestrated' },
          { name: '🤖 Auto-select - Let AI decide', value: 'auto' }
        ],
        default: options.mode || 'auto'
      },
      {
        type: 'editor',
        name: 'taskDescription',
        message: 'Describe what you want to build:',
        default: `# Feature Requirements\n\n## Description\nDescribe your feature here...\n\n## Acceptance Criteria\n- [ ] Criterion 1\n- [ ] Criterion 2\n\n## Technical Notes\n- Implementation details\n- Performance considerations\n- Security requirements\n\n## Testing Requirements\n- Unit tests\n- Integration tests\n- E2E tests if applicable`
      }
    ]);

    // Validate input
    const validatedInput = validateInput(DevelopCommandSchema, developmentOptions);
    
    const taskId = generateTaskId();
    const spinner = ora('Starting AI development session...').start();
    
    logger.logTaskStart(taskId, validatedInput.taskDescription, config.aiProvider);
    
    const startTime = Date.now();
    
    // Initialize services
    const github = new GitHubService();
    
    // Create feature branch
    spinner.text = 'Creating feature branch...';
    await github.createBranch(config.repoUrl, validatedInput.featureName, 'develop');
    
    logger.info('Feature branch created', { 
      branch: validatedInput.featureName, 
      taskId 
    });
    
    // Initialize agent service
    const agentService = new AgentService(config.repoUrl, {
      type: config.agentMode,
      provider: config.aiProvider,
      orchestrationStrategy: config.orchestrationStrategy
    });

    await agentService.initializeProject(config.repoUrl, validatedInput.featureName);

    // Start development with progress tracking
    spinner.text = 'AI agents analyzing requirements...';
    
    const result = await agentService.developFeature(validatedInput.taskDescription, {
      complexity: validatedInput.complexity,
      priority: validatedInput.priority,
      preferredMode: validatedInput.preferredMode,
      maxIterations: validatedInput.maxIterations,
      onProgress: (step, agent) => {
        const message = agent ? `${agent}: ${step}` : `🤖 ${step}`;
        spinner.text = message;
        logger.logAgentActivity(agent || 'system', 'progress', { step, taskId });
      },
      onCommit: (message) => {
        console.log(chalk.green(`\n📝 ${message}`));
        logger.info('Commit created', { message, taskId });
      }
    });

    const duration = Date.now() - startTime;
    
    if (result.success) {
      spinner.succeed('Development completed successfully!');
      logger.logTaskComplete(taskId, true, duration);
      
      console.log(chalk.green('\n✅ Feature development complete!'));
      console.log(chalk.gray('Branch:'), validatedInput.featureName);
      console.log(chalk.gray('Approach:'), result.approach);
      console.log(chalk.gray('AI Provider:'), config.aiProvider.toUpperCase());
      console.log(chalk.gray('Duration:'), `${(duration / 1000).toFixed(1)}s`);
      
      if (result.agentContributions) {
        console.log(chalk.gray('Agent Contributions:'), result.agentContributions.size);
      }
    } else {
      spinner.warn('Development completed with issues');
      logger.logTaskComplete(taskId, false, duration);
      
      console.log(chalk.yellow('\n⚠️  Development completed with some issues'));
      console.log(chalk.gray('Check the logs for details'));
    }

    // Show timeline for orchestrated mode
    if (result.timeline && result.timeline.length > 0) {
      console.log(chalk.blue('\n📋 Development Timeline:'));
      result.timeline.forEach(event => {
        const time = new Date(event.timestamp).toLocaleTimeString();
        console.log(chalk.gray(`${time} [${event.agent}]: ${event.event}`));
      });
    }

  } catch (error) {
    logger.error('Develop command failed', error);
    console.error(chalk.red(`\n❌ Development failed: ${error.message}`));
    process.exit(1);
  }
}

