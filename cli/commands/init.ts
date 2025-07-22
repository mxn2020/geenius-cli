// cli/commands/init.ts
import 'dotenv/config';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { randomBytes } from 'crypto'; // Add this import
import { ConfigManager } from '../../src/utils/config';
import { validateInput, InitCommandSchema } from '../../src/utils/validation';
import { logger } from '../../src/utils/logger';
import { TemplateRegistry } from '../repo-templates/index';
import { GitHubService } from '../services/github';
import { NetlifyService } from '../services/netlify';
import { MongoDBService } from '../services/mongodb';
import { AgentService } from '../agent/agent-service';
import { storage } from '../../api/shared/redis-storage';
import RedisKeys from '../../api/shared/redis-keys';
import type { InitOptions, ProjectConfig } from '../../src/types/config';

export async function initCommand(): Promise<void> {
  console.log(chalk.blue.bold('🚀 AI Development Agent v3.0'));
  console.log(chalk.gray('Advanced AI agents with orchestration capabilities!'));
  console.log(chalk.gray('🔧 Auto-setup: GitHub repos, Netlify deployment, MongoDB databases'));

  // Show environment setup status
  const envStatus = {
    github: !!process.env.GITHUB_TOKEN,
    netlify: !!process.env.NETLIFY_TOKEN,
    mongodb: !!(process.env.MONGODB_ATLAS_PUBLIC_KEY && process.env.MONGODB_ATLAS_PRIVATE_KEY)
  };

  console.log(chalk.gray('\n📋 Environment Setup Status:'));
  console.log(chalk.gray(`   GitHub: ${envStatus.github ? '✅ Configured' : '❌ Missing GITHUB_TOKEN'}`));
  console.log(chalk.gray(`   Netlify: ${envStatus.netlify ? '✅ Configured' : '⚠️  Missing NETLIFY_TOKEN (optional)'}`));
  console.log(chalk.gray(`   MongoDB: ${envStatus.mongodb ? '✅ Configured' : '⚠️  Missing MONGODB_ATLAS_* keys (optional)'}`));
  console.log();

  const configManager = new ConfigManager();

  // Check if config already exists
  if (await configManager.configExists()) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: 'Project already initialized. Overwrite existing configuration?',
        default: false
      }
    ]);

    if (!overwrite) {
      console.log(chalk.yellow('Init cancelled.'));
      return;
    }
  }

  try {
    // Get template registry
    const templateRegistry = new TemplateRegistry(process.env.GITHUB_TOKEN);
    const templates = await templateRegistry.getAllTemplates();

    // Check for existing API keys and show status
    const availableProviders = [];
    if (process.env.ANTHROPIC_API_KEY) availableProviders.push('anthropic');
    if (process.env.OPENAI_API_KEY) availableProviders.push('openai');
    if (process.env.GOOGLE_API_KEY) availableProviders.push('google');
    if (process.env.GROK_API_KEY) availableProviders.push('grok');

    if (availableProviders.length > 0) {
      console.log(chalk.green(`✅ Found API keys for: ${availableProviders.map(p => p.toUpperCase()).join(', ')}`));
    } else {
      console.log(chalk.yellow('⚠️  No API keys found in environment. You will be prompted to enter them.'));
    }

    // Check for existing GitHub configuration
    const githubConfig = [];
    if (process.env.GITHUB_USERNAME) githubConfig.push('username');
    if (process.env.GITHUB_ORG) githubConfig.push('organization');
    if (githubConfig.length > 0) {
      console.log(chalk.green(`✅ Found GitHub ${githubConfig.join(', ')} in environment`));
    }

    console.log(); // Add spacing

    // AI Provider and mode selection
    const responses = await inquirer.prompt([
      {
        type: 'list',
        name: 'aiProvider',
        message: 'Choose your AI provider:',
        choices: [
          { name: '🤖 Claude (Anthropic) - Best for coding', value: 'anthropic' },
          { name: '🧠 GPT-4 (OpenAI) - Most versatile', value: 'openai' },
          { name: '✨ Gemini (Google) - Creative problem solving', value: 'google' },
          { name: '⚡ Grok (X.AI) - Fast and witty', value: 'grok' }
        ]
      },
      {
        type: 'list',
        name: 'agentMode',
        message: 'Choose agent architecture:',
        choices: [
          { name: '🎯 Single Agent - Fast and focused', value: 'single' },
          { name: '👥 Multi-Agent Team - Specialized roles', value: 'orchestrated' },
          { name: '🔄 Hybrid - Best of both worlds', value: 'hybrid' }
        ]
      },
      {
        type: 'list',
        name: 'orchestrationStrategy',
        message: 'Team coordination strategy:',
        choices: [
          { name: '📋 Hierarchical - Lead manages team', value: 'hierarchical' },
          { name: '🤝 Collaborative - Agents work together', value: 'collaborative' },
          { name: '⚡ Parallel - Maximum speed', value: 'parallel' },
          { name: '📐 Sequential - Step by step', value: 'sequential' }
        ],
        when: (answers) => answers.agentMode === 'orchestrated' || answers.agentMode === 'hybrid'
      },
      {
        type: 'list',
        name: 'templateId',
        message: 'Choose your project template:',
        choices: templates.map(t => ({
          name: `${t.name} - ${t.description}`,
          value: t.id
        }))
      },
      {
        type: 'input',
        name: 'projectName',
        message: 'Project name:',
        validate: (input) => input.length > 0 || 'Project name is required'
      },
      {
        type: 'input',
        name: 'githubOrg',
        message: 'GitHub organization/username (where to fork the repo):',
        default: process.env.GITHUB_ORG || process.env.GITHUB_USERNAME,
        validate: (input) => input.length > 0 || 'GitHub org/username is required',
        when: () => !process.env.GITHUB_ORG && !process.env.GITHUB_USERNAME
      },
      {
        type: 'input',
        name: 'model',
        message: (answers) => `${answers.aiProvider.toUpperCase()} model (optional):`,
        default: (answers) => getDefaultModel(answers.aiProvider)
      },
      {
        type: 'confirm',
        name: 'autoSetup',
        message: 'Auto-setup GitHub repo and Netlify project?',
        default: true
      }
    ]);

    // Validate that API key is available in environment
    if (!getExistingApiKey(responses.aiProvider)) {
      throw new Error(`No API key found for ${responses.aiProvider}. Please set ${getApiKeyEnvName(responses.aiProvider)} in your .env file.`);
    }

    // Use existing GitHub org/username if available, otherwise use the prompted one
    const finalGithubOrg = responses.githubOrg || process.env.GITHUB_ORG || process.env.GITHUB_USERNAME;
    if (!finalGithubOrg) {
      throw new Error('No GitHub organization/username found. Please set GITHUB_ORG or GITHUB_USERNAME in your .env file or enter it when prompted.');
    }
    responses.githubOrg = finalGithubOrg;

    // Validate input
    const validatedInput = validateInput(InitCommandSchema, responses);

    const spinner = ora('Initializing advanced AI development environment...').start();

    // Initialize services
    const github = new GitHubService();
    const netlify = new NetlifyService();
    const template = templates.find(t => t.id === validatedInput.templateId)!;

    // Fork template repository
    spinner.text = 'Forking template repository...';
    const repoUrl = await github.forkTemplate(
      template.repository,
      validatedInput.projectName,
      validatedInput.githubOrg
    );

    logger.info('Repository forked successfully', { repoUrl, template: template.id });

    // Extract the final repository name from the URL for Netlify
    const repoMatch = repoUrl.match(/github\.com\/[^\/]+\/([^\/]+)/);
    const finalRepoName = repoMatch ? repoMatch[1] : validatedInput.projectName;

    console.log(`Using repository name '${finalRepoName}' for Netlify project`);

    // Setup MongoDB database if template requires it
    let mongodbProject;
    if (template.envVars.includes('MONGODB_URI') || template.envVars.includes('DATABASE_URL')) {
      if (!process.env.MONGODB_ATLAS_PUBLIC_KEY || !process.env.MONGODB_ATLAS_PRIVATE_KEY) {
        spinner.warn('MongoDB Atlas API keys not found - skipping database setup');
        console.log(chalk.yellow('⚠️  MongoDB Atlas API keys not found. Skipping MongoDB setup.'));
        console.log(chalk.gray('Add MONGODB_ATLAS_PUBLIC_KEY and MONGODB_ATLAS_PRIVATE_KEY to your .env file to enable auto-database creation.'));
        mongodbProject = null;
      } else {
        try {
          spinner.text = 'Loading MongoDB Atlas organizations...';
          const mongodb = new MongoDBService();
          const organizations = await mongodb.getOrganizations();

          if (organizations.length === 0) {
            throw new Error('No organizations found. Please ensure your API keys have proper permissions.');
          }

          spinner.stop();

          // Let user select organization
          const { selectedOrgId } = await inquirer.prompt([
            {
              type: 'list',
              name: 'selectedOrgId',
              message: 'Select MongoDB Atlas organization:',
              choices: organizations.map(org => ({
                name: `${org.name} (${org.id})`,
                value: org.id
              }))
            }
          ]);

          const selectedOrg = organizations.find(org => org.id === selectedOrgId);
          console.log(chalk.blue(`📁 Loading projects for organization: ${selectedOrg.name}`));

          // Get projects for selected organization
          const projects = await mongodb.getProjects(selectedOrgId);
          
          // Create project choices
          const projectChoices = projects.map(project => ({
            name: `${project.name} (${project.id})`,
            value: project.id
          }));

          // Add option to create new project
          projectChoices.push({
            name: `➕ Create new project: "${validatedInput.projectName}"`,
            value: 'CREATE_NEW'
          });

          // Let user select project
          const { selectedProjectId } = await inquirer.prompt([
            {
              type: 'list',
              name: 'selectedProjectId',
              message: 'Select MongoDB Atlas project:',
              choices: projectChoices
            }
          ]);

          const useExistingProject = selectedProjectId !== 'CREATE_NEW';
          let targetProjectId = useExistingProject ? selectedProjectId : null;

          spinner.start('Creating MongoDB Atlas database...');
          
          // Try to create the cluster, handling free cluster limit errors
          let retryCount = 0;
          const maxRetries = 3;
          
          while (retryCount < maxRetries) {
            try {
              mongodbProject = await mongodb.createProjectWithSelection(
                finalRepoName,
                selectedOrgId,
                targetProjectId
              );
              break; // Success, exit loop
            } catch (error: any) {
              // Check if this is a free cluster limit error
              if (error.message.includes('CANNOT_CREATE_FREE_CLUSTER_VIA_PUBLIC_API') || 
                  error.message.includes('reached the limit for the number of free clusters')) {
                
                spinner.stop();
                console.log(chalk.red('❌ Cannot create cluster: This project has reached the limit for free clusters (M0).'));
                console.log(chalk.yellow('💡 You can either:'));
                console.log(chalk.yellow('   1. Select a different project'));
                console.log(chalk.yellow('   2. Create a new project'));
                console.log(chalk.yellow('   3. Skip MongoDB setup and configure manually later'));
                
                const { retryAction } = await inquirer.prompt([
                  {
                    type: 'list',
                    name: 'retryAction',
                    message: 'What would you like to do?',
                    choices: [
                      { name: '🔄 Select a different project', value: 'select_different' },
                      { name: '➕ Create a new project', value: 'create_new' },
                      { name: '⏭️  Skip MongoDB setup', value: 'skip' }
                    ]
                  }
                ]);
                
                if (retryAction === 'skip') {
                  console.log(chalk.yellow('⏭️  Skipping MongoDB setup. You can configure it manually later.'));
                  mongodbProject = null;
                  break;
                } else if (retryAction === 'create_new') {
                  targetProjectId = null; // Force new project creation
                  retryCount++;
                  spinner.start('Creating new MongoDB Atlas project...');
                } else if (retryAction === 'select_different') {
                  // Let user select a different project
                  const updatedProjects = await mongodb.getProjects(selectedOrgId);
                  const updatedProjectChoices = updatedProjects.map(project => ({
                    name: `${project.name} (${project.id})`,
                    value: project.id
                  }));
                  
                  // Add option to create new project
                  updatedProjectChoices.push({
                    name: `➕ Create new project: "${validatedInput.projectName}"`,
                    value: 'CREATE_NEW'
                  });
                  
                  const { newSelectedProjectId } = await inquirer.prompt([
                    {
                      type: 'list',
                      name: 'newSelectedProjectId',
                      message: 'Select a different MongoDB Atlas project:',
                      choices: updatedProjectChoices
                    }
                  ]);
                  
                  targetProjectId = newSelectedProjectId !== 'CREATE_NEW' ? newSelectedProjectId : null;
                  retryCount++;
                  spinner.start('Creating MongoDB Atlas database...');
                }
              } else {
                // Different error, don't retry
                throw error;
              }
            }
          }
          
          if (retryCount >= maxRetries && !mongodbProject) {
            throw new Error('Failed to create MongoDB cluster after multiple attempts. Please try again with a different project or create a new project.');
          }

          console.log(chalk.green(`🍃 MongoDB database created successfully!`));
          console.log(chalk.green(`   📊 Database: ${mongodbProject.databaseName}`));
          console.log(chalk.green(`   🔗 Cluster: ${mongodbProject.clusterName}`));
          console.log(chalk.green(`   👤 Username: ${mongodbProject.username}`));
          console.log(chalk.gray(`   🔐 Password: ${mongodbProject.password}`));

          logger.info('MongoDB project created', {
            projectId: mongodbProject.id,
            clusterName: mongodbProject.clusterName,
            databaseName: mongodbProject.databaseName
          });
        } catch (error) {
          spinner.fail('MongoDB setup failed');
          console.log(chalk.red(`❌ MongoDB setup failed: ${error.message}`));
          console.log(chalk.yellow('💡 You can create a MongoDB database manually and update the environment variables later.'));
          mongodbProject = null;
        }
      }
    }

    // Setup Netlify project
    let netlifyProject;
    if (validatedInput.autoSetup) {
      if (!process.env.NETLIFY_TOKEN) {
        spinner.warn('Netlify token not found - skipping deployment setup');
        console.log(chalk.yellow('⚠️  NETLIFY_TOKEN not found in environment. Skipping Netlify setup.'));
        console.log(chalk.gray('Add NETLIFY_TOKEN to your .env file to enable auto-deployment.'));
        netlifyProject = null;
      } else {
        try {
          spinner.text = 'Setting up Netlify project...';
          // Use the final repository name instead of the original project name
          netlifyProject = await netlify.createProject(finalRepoName, repoUrl);

          // Prepare environment variables
          const templateEnvVars = template.envVars.reduce((acc, envVar) => ({ ...acc, [envVar]: '' }), {});

          // Add MongoDB connection details if database was created
          if (mongodbProject) {
            if (template.envVars.includes('MONGODB_URI')) {
              templateEnvVars['MONGODB_URI'] = mongodbProject.connectionString;
            }
            if (template.envVars.includes('DATABASE_URL')) {
              templateEnvVars['DATABASE_URL'] = mongodbProject.connectionString;
            }
            // Add additional MongoDB variables
            templateEnvVars['MONGODB_DATABASE_NAME'] = mongodbProject.databaseName;
            templateEnvVars['MONGODB_CLUSTER_NAME'] = mongodbProject.clusterName;
            templateEnvVars['MONGODB_USERNAME'] = mongodbProject.username;
            templateEnvVars['MONGODB_PASSWORD'] = mongodbProject.password;
          }

          // Generate secure secrets for auth
          if (template.envVars.includes('BETTER_AUTH_SECRET')) {
            templateEnvVars['BETTER_AUTH_SECRET'] = generateSecureSecret();
          }

          if (template.envVars.includes('BETTER_AUTH_URL')) {
            templateEnvVars['BETTER_AUTH_URL'] = netlifyProject ? netlifyProject.ssl_url : 'http://localhost:5176';
          }

          if (template.envVars.includes('JWT_SECRET')) {
            templateEnvVars['JWT_SECRET'] = generateSecureSecret();
          }

          // Set default app configuration
          if (template.envVars.includes('VITE_APP_NAME')) {
            templateEnvVars['VITE_APP_NAME'] = finalRepoName;
          }

          if (template.envVars.includes('VITE_APP_VERSION')) {
            templateEnvVars['VITE_APP_VERSION'] = '1.0.0';
          }

          if (template.envVars.includes('VITE_APP_DESCRIPTION')) {
            templateEnvVars['VITE_APP_DESCRIPTION'] = `${template.description} - ${finalRepoName}`;
          }

          if (template.envVars.includes('NODE_ENV')) {
            templateEnvVars['NODE_ENV'] = 'production';
          }

          if (template.envVars.includes('PORT')) {
            templateEnvVars['PORT'] = '5173';
          }

          // Set API URLs based on Netlify project
          if (netlifyProject) {
            if (template.envVars.includes('VITE_APP_URL')) {
              templateEnvVars['VITE_APP_URL'] = netlifyProject.ssl_url;
            }
            if (template.envVars.includes('VITE_API_URL')) {
              templateEnvVars['VITE_API_URL'] = `${netlifyProject.ssl_url}/api`;
            }
            if (template.envVars.includes('VITE_API_BASE_URL')) {
              templateEnvVars['VITE_API_BASE_URL'] = netlifyProject.ssl_url;
            }
            if (template.envVars.includes('NETLIFY_FUNCTIONS_URL')) {
              templateEnvVars['NETLIFY_FUNCTIONS_URL'] = '/api';
            }
            if (template.envVars.includes('CORS_ORIGIN')) {
              templateEnvVars['CORS_ORIGIN'] = netlifyProject.ssl_url;
            }
          }

          // Set rate limiting defaults
          if (template.envVars.includes('RATE_LIMIT_WINDOW_MS')) {
            templateEnvVars['RATE_LIMIT_WINDOW_MS'] = '900000'; // 15 minutes
          }

          if (template.envVars.includes('RATE_LIMIT_MAX_REQUESTS')) {
            templateEnvVars['RATE_LIMIT_MAX_REQUESTS'] = '100';
          }

          // Set Geenius API URL to the current Netlify site URL
          if (template.envVars.includes('VITE_GEENIUS_API_URL')) {
            templateEnvVars['VITE_GEENIUS_API_URL'] = netlifyProject.ssl_url || netlifyProject.url;
          }

          // Set environment variables including user's repository URL
          const netlifyVars = await netlify.setupEnvironmentVariables(netlifyProject.id, {
            ...getEnvVarsForProvider(validatedInput.aiProvider, configManager.getApiKey(validatedInput.aiProvider), validatedInput.model),
            ...getGitHubEnvVars(validatedInput.githubOrg, repoUrl),
            ...templateEnvVars,
            // Fix: Set user's repository URL instead of template URL
            'VITE_REPOSITORY_URL': repoUrl,
            'VITE_BASE_BRANCH': 'main'
          });

          // Log the important URLs for the user
          if (netlifyVars.NETLIFY_FUNCTIONS_URL) {
            console.log(chalk.green(`🔗 Netlify Functions URL: ${netlifyVars.NETLIFY_FUNCTIONS_URL}`));
          }
          if (netlifyVars.NETLIFY_SITE_URL) {
            console.log(chalk.green(`🌐 Site URL: ${netlifyVars.NETLIFY_SITE_URL}`));
          }

          // Configure branch deployments
          await netlify.configureBranchDeployments(netlifyProject.id, {
            main: { production: true },
            develop: { preview: true },
            'feature/*': { preview: true }
          });

          // Wait for initial deployment to complete
          try {
            console.log(chalk.blue('🚀 Checking Netlify deployment status...'));
            const deployment = await netlify.waitForInitialDeployment(netlifyProject.id, 180000); // 3 minutes timeout
            
            if (deployment.state === 'ready') {
              console.log(chalk.green('✅ Netlify deployment completed successfully!'));
              console.log(chalk.gray(`   🌐 Site is live at: ${deployment.deploy_ssl_url || netlifyProject.ssl_url}`));
            } else if (deployment.state === 'error') {
              console.log(chalk.red('❌ Netlify deployment failed'));
              console.log(chalk.gray(`   💡 You can check the deployment logs at: https://app.netlify.com/sites/${netlifyProject.id}/deploys`));
            }
          } catch (error: any) {
            console.log(chalk.yellow('⚠️  Could not wait for deployment completion'));
            console.log(chalk.gray(`   💡 Check deployment status at: https://app.netlify.com/sites/${netlifyProject.id}/deploys`));
          }

          logger.info('Netlify project configured', { projectId: netlifyProject.id });
        } catch (error) {
          spinner.fail('Netlify setup failed');
          console.log(chalk.red(`❌ Netlify setup failed: ${error.message}`));
          throw error; // Don't continue if Netlify setup was requested but failed
        }
      }
    }

    // Initialize AI agent service
    spinner.text = 'Initializing AI agent system...';
    const agentService = new AgentService(repoUrl, {
      type: validatedInput.agentMode,
      provider: validatedInput.aiProvider,
      orchestrationStrategy: validatedInput.orchestrationStrategy || 'hierarchical'
    });

    await agentService.initializeProject(repoUrl);

    logger.info('AI agent system initialized', {
      provider: validatedInput.aiProvider,
      mode: validatedInput.agentMode
    });

    spinner.succeed('Advanced AI development environment initialized!');

    // Create project configuration
    const projectConfig: ProjectConfig = {
      template: template.id,
      name: finalRepoName, // Use the final repository name
      repoUrl,
      aiProvider: validatedInput.aiProvider,
      agentMode: validatedInput.agentMode,
      orchestrationStrategy: validatedInput.orchestrationStrategy,
      model: validatedInput.model,
      netlifyProject: netlifyProject?.id,
      systemPrompt: getSystemPromptForTemplate(template.id),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await configManager.saveConfig(projectConfig);

    // Also save to Redis for cross-process compatibility
    try {
      const projectId = RedisKeys.generateProjectId();
      const redisProjectData = {
        id: projectId,
        name: projectConfig.name,
        template: projectConfig.template,
        aiProvider: projectConfig.aiProvider,
        agentMode: projectConfig.agentMode,
        orchestrationStrategy: projectConfig.orchestrationStrategy,
        githubOrg: projectConfig.githubOrg || validatedInput.githubOrg,
        repositoryUrl: repoUrl,
        netlifyUrl: netlifyProject?.ssl_url,
        mongodbOrgId: mongodbData?.orgId,
        mongodbProjectId: mongodbData?.projectId,
        mongodbDatabase: mongodbData?.databaseName,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'active' as const
      };

      await storage.storeProject(projectId, redisProjectData);
      
      // Update local config with project ID for future reference
      const updatedConfig = { ...projectConfig, projectId };
      await configManager.saveConfig(updatedConfig);
      
      console.log(chalk.blue(`💾 Project saved with ID: ${projectId}`));
    } catch (error) {
      console.log(chalk.yellow(`⚠️  Could not save to Redis: ${error.message}`));
    }

    // Success output
    console.log(chalk.green('\n✅ Setup complete!'));
    console.log(chalk.gray('Repository:'), repoUrl);
    console.log(chalk.gray('AI Provider:'), validatedInput.aiProvider.toUpperCase());
    console.log(chalk.gray('Agent Mode:'), validatedInput.agentMode);
    console.log(chalk.gray('Template:'), template.name);

    if (validatedInput.agentMode === 'orchestrated' || validatedInput.agentMode === 'hybrid') {
      console.log(chalk.gray('Strategy:'), validatedInput.orchestrationStrategy);
    }

    if (netlifyProject) {
      console.log(chalk.gray('Netlify:'), netlifyProject.ssl_url);
      console.log(chalk.gray('Netlify Project:'), `https://app.netlify.com/sites/${netlifyProject.id}/overview`);
    }

    if (mongodbProject) {
      console.log(chalk.gray('MongoDB:'), mongodbProject.connectionString);
      console.log(chalk.gray('Database:'), mongodbProject.databaseName);
      console.log(chalk.gray('MongoDB Project:'), `https://cloud.mongodb.com/v2/${mongodbProject.id}#/overview`);
    }

    // Show BetterAuth setup info if applicable
    if (template.envVars.includes('BETTER_AUTH_SECRET')) {
      console.log(chalk.green('🔐 BetterAuth configured with secure secret'));
      console.log(chalk.gray('   Authentication ready for production'));
    }

    console.log(chalk.blue('\n🎉 Ready to develop!'));
    console.log(chalk.gray('💡 Your environment variables have been automatically configured in Netlify.'));
    console.log(chalk.gray('💡 For local development, copy the .env.example file to .env and update the values.'));

    // Show interactive menu
    const { nextAction } = await inquirer.prompt([
      {
        type: 'list',
        name: 'nextAction',
        message: 'What would you like to do next?',
        choices: [
          { name: '🚀 Start Development Session', value: 'develop' },
          { name: '📊 Check Project Status', value: 'status' },
          { name: '⚖️  Compare AI Providers', value: 'compare' },
          { name: '🚪 Exit', value: 'exit' }
        ]
      }
    ]);

    switch (nextAction) {
      case 'develop':
        const { developCommand } = await import('./develop');
        await developCommand();
        break;
      case 'status':
        const { statusCommand } = await import('./status');
        await statusCommand();
        break;
      case 'compare':
        const { compareAgentsCommand } = await import('./compare-agents');
        await compareAgentsCommand();
        break;
      case 'exit':
        console.log(chalk.green('\n👋 Thanks for using Geenius! Happy coding!'));
        process.exit(0);
        break;
    }

  } catch (error) {
    logger.error('Init command failed', error);
    console.error(chalk.red(`\n❌ Setup failed: ${error.message}`));
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

function getExistingApiKey(provider: string): string | null {
  const envVarName = getApiKeyEnvName(provider);
  return process.env[envVarName] || null;
}

function getApiKeyEnvName(provider: string): string {
  const envNames = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    google: 'GOOGLE_API_KEY',
    grok: 'GROK_API_KEY'
  };

  return envNames[provider] || 'API_KEY';
}

function getSystemPromptForTemplate(templateId: string): string {
  const prompts = {
    'nextjs-supabase': 'You are a Next.js expert working with Supabase. Focus on type-safe code, proper error handling, and following Next.js best practices.',
    'vite-react-mongo': 'You are a React developer using Vite, MongoDB, and BetterAuth. Focus on modern React patterns, hooks, efficient database operations, and secure authentication with BetterAuth. Emphasize performance, type safety, and following React best practices.',
    'react-indexeddb-jwt': 'You are a React developer focusing on client-side applications. Emphasize performance, offline capability, and secure authentication.',
    'vue-pinia-firebase': 'You are a Vue.js expert working with Firebase. Focus on composition API, reactive patterns, and Firebase best practices.',
    'svelte-drizzle-planetscale': 'You are a SvelteKit expert working with modern database tools. Focus on performance, type safety, and edge-ready applications.',
    'astro-content-collections': 'You are an Astro expert focusing on static site generation and content management. Emphasize performance, SEO, and content structure.',
    'express-prisma-postgres': 'You are a backend API expert using Express.js and Prisma. Focus on scalable architecture, security, and database optimization.',
    'remix-sqlite-auth': 'You are a Remix expert focusing on full-stack development. Emphasize progressive enhancement, web standards, and performance.'
  };

  return prompts[templateId] || 'You are an expert developer. Focus on writing clean, maintainable, and well-documented code following industry best practices.';
}

// Fixed: Use ES6 import instead of require
function generateSecureSecret(): string {
  return randomBytes(32).toString('hex');
}

function getEnvVarsForProvider(provider: string, apiKey: string, model?: string): Record<string, string> {
  const vars: Record<string, string> = {};

  switch (provider) {
    case 'anthropic':
      vars.ANTHROPIC_API_KEY = apiKey;
      if (model) vars.CLAUDE_MODEL = model;
      break;
    case 'openai':
      vars.OPENAI_API_KEY = apiKey;
      if (model) vars.OPENAI_MODEL = model;
      break;
    case 'google':
      vars.GOOGLE_API_KEY = apiKey;
      if (model) vars.GEMINI_MODEL = model;
      break;
    case 'grok':
      vars.GROK_API_KEY = apiKey;
      if (model) vars.GROK_MODEL = model;
      break;
  }

  return vars;
}

function getGitHubEnvVars(githubOrg: string, repoUrl: string): Record<string, string> {
  const vars: Record<string, string> = {};

  // Add GitHub credentials if available
  if (process.env.GITHUB_TOKEN) {
    vars.GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  }

  // Add GitHub organization/username
  vars.GITHUB_ORG = githubOrg;
  vars.GITHUB_USERNAME = githubOrg; // Some templates might use this instead

  // Extract repo name from URL
  const repoMatch = repoUrl.match(/github\.com\/[^\/]+\/([^\/]+)/);
  if (repoMatch) {
    vars.GITHUB_REPO = repoMatch[1];
    vars.GITHUB_REPOSITORY = `${githubOrg}/${repoMatch[1]}`;
  }

  // Add repo URL
  vars.GITHUB_REPO_URL = repoUrl;

  return vars;
}