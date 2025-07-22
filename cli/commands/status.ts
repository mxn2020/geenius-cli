// cli/commands/status.ts
import chalk from 'chalk';
import ora from 'ora';
import { ConfigManager } from '../../src/utils/config';
import { logger } from '../../src/utils/logger';
import { formatDuration } from '../../src/utils/helpers';
import { AgentService } from '../agent/agent-service';
import { NetlifyService } from '../services/netlify';
import { storage } from '../../api/shared/redis-storage';
import RedisKeys from '../../api/shared/redis-keys';

export async function statusCommand(): Promise<void> {
  const configManager = new ConfigManager();
  const spinner = ora('Loading project status...').start();
  
  let config = await configManager.loadConfig();
  let redisProject = null;
  
  // Try to get more complete project data from Redis
  try {
    if (config?.projectId) {
      redisProject = await storage.getProject(config.projectId);
    } else if (config?.name) {
      redisProject = await storage.getProjectByName(config.name);
    } else {
      // Try to find any active project
      const allProjects = await storage.getAllProjects();
      const activeProjects = allProjects.filter(p => p.status === 'active');
      if (activeProjects.length > 0) {
        redisProject = activeProjects[0];
      }
    }
  } catch (error) {
    // Redis not available, continue with local config only
    spinner.text = 'Redis not available, showing local config only...';
  }
  
  // Use Redis data if available, fallback to local config
  const projectData = redisProject || config;
  
  if (!projectData) {
    spinner.fail('No project found. Run "dev-agent init" first or initialize via web interface.');
    return;
  }

  spinner.text = 'Gathering status information...';
  
  try {
    // Initialize agent service
    const agentService = new AgentService(projectData.repositoryUrl || projectData.repoUrl, {
      type: projectData.agentMode,
      provider: projectData.aiProvider,
      orchestrationStrategy: projectData.orchestrationStrategy
    });

    await agentService.initializeProject(projectData.repositoryUrl || projectData.repoUrl);
    const analytics = await agentService.getAgentAnalytics();

    spinner.succeed('Status check complete');
    
    // Project information
    console.log(chalk.blue.bold('\n📊 Project Status'));
    console.log(chalk.gray('Name:'), projectData.name);
    console.log(chalk.gray('Template:'), projectData.template);
    console.log(chalk.gray('AI Provider:'), projectData.aiProvider.toUpperCase());
    console.log(chalk.gray('Agent Mode:'), projectData.agentMode);
    console.log(chalk.gray('Repository:'), projectData.repositoryUrl || projectData.repoUrl);
    
    if (redisProject) {
      console.log(chalk.blue('✨ Enhanced info from Redis:'));
      if (projectData.netlifyUrl) {
        console.log(chalk.gray('Live Site:'), chalk.blue(projectData.netlifyUrl));
      }
      if (projectData.mongodbDatabase) {
        console.log(chalk.gray('MongoDB Database:'), chalk.green(projectData.mongodbDatabase));
      }
      console.log(chalk.gray('Status:'), projectData.status ? chalk.green(projectData.status) : 'Unknown');
    }
    
    console.log(chalk.gray('Created:'), new Date(projectData.createdAt).toLocaleDateString());
    console.log(chalk.gray('Updated:'), new Date(projectData.updatedAt).toLocaleDateString());
    
    if (config.agentMode === 'orchestrated' || config.agentMode === 'hybrid') {
      console.log(chalk.gray('Strategy:'), config.orchestrationStrategy);
      console.log(chalk.gray('Cross-validation:'), config.crossValidation ? '✅ Enabled' : '❌ Disabled');
    }
    
    // Agent performance
    console.log(chalk.blue('\n🤖 Agent Performance:'));
    console.log(chalk.gray('Success Rate:'), `${(analytics.performance.successRate * 100).toFixed(1)}%`);
    console.log(chalk.gray('Average Time:'), formatDuration(analytics.performance.averageTime));
    console.log(chalk.gray('Tasks Completed:'), analytics.performance.tasksCompleted);
    
    // Agent statistics
    if (analytics.agentStats) {
      console.log(chalk.blue('\n👥 Agent Statistics:'));
      for (const [agent, stats] of analytics.agentStats.entries()) {
        console.log(`  ${agent}: ${stats.tasks} tasks, ${(stats.successRate * 100).toFixed(1)}% success`);
      }
    }
    
    // Usage statistics
    console.log(chalk.blue('\n📈 Usage Statistics:'));
    console.log(chalk.gray('Total Requests:'), analytics.usage.totalRequests);
    console.log(chalk.gray('Provider Breakdown:'));
    for (const [provider, count] of analytics.usage.providerBreakdown.entries()) {
      console.log(`  ${provider}: ${count} requests`);
    }
    
    // Netlify deployments
    if (config.netlifyProject) {
      const netlify = new NetlifyService();
      const deployments = await netlify.getDeployments(config.netlifyProject);
      
      console.log(chalk.blue('\n🚀 Recent Deployments:'));
      deployments.slice(0, 5).forEach(deployment => {
        const status = deployment.state === 'ready' ? '✅' : '🔄';
        const time = new Date(deployment.created_at).toLocaleDateString();
        console.log(`${status} ${deployment.branch} (${time}) - ${deployment.deploy_ssl_url}`);
      });
    }

  } catch (error) {
    spinner.fail('Status check failed');
    logger.error('Status command failed', error);
    console.error(chalk.red(`\n❌ Status check failed: ${error.message}`));
    process.exit(1);
  }
}

