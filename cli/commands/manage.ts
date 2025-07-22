// cli/commands/manage.ts
import inquirer from 'inquirer';
import chalk from 'chalk';
import { logger } from '../../src/utils/logger';
import { NetlifyService } from '../services/netlify';
import { GitHubService } from '../services/github';
import { MongoDBService } from '../services/mongodb';

export async function manageCommand() {
  try {
    console.log(chalk.blue.bold('🔧 Geenius Management Console\n'));
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to manage?',
        choices: [
          { name: '🌐 Netlify Projects', value: 'netlify' },
          { name: '📂 GitHub Repositories', value: 'github' },
          { name: '🍃 MongoDB Clusters', value: 'mongodb' },
          { name: '↩️  Back to Main Menu', value: 'back' }
        ]
      }
    ]);

    switch (action) {
      case 'netlify':
        await manageNetlifyProjects();
        break;
      case 'github':
        await manageGitHubRepositories();
        break;
      case 'mongodb':
        await manageMongoDBClusters();
        break;
      case 'back':
        return;
    }
  } catch (error) {
    logger.error('Management command error', error);
    console.log(chalk.red('❌ Error in management console:'), error.message);
  }
}

async function manageNetlifyProjects() {
  try {
    console.log(chalk.blue.bold('\n🌐 Netlify Project Management\n'));
    
    const netlifyService = new NetlifyService();
    const sites = await netlifyService.listSites();
    
    if (sites.length === 0) {
      console.log(chalk.yellow('No Netlify sites found in your account.'));
      return;
    }

    const { selectedSite } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedSite',
        message: 'Select a site to manage:',
        choices: [
          ...sites.map(site => ({
            name: `${site.name} (${site.url})`,
            value: site
          })),
          { name: '↩️  Back to Management Menu', value: 'back' }
        ]
      }
    ]);

    if (selectedSite === 'back') return;

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: `What would you like to do with "${selectedSite.name}"?`,
        choices: [
          { name: '📝 Change Site Name', value: 'rename' },
          { name: '🗑️  Delete Site', value: 'delete' },
          { name: '📊 View Site Details', value: 'details' },
          { name: '🚀 View Deployments', value: 'deployments' },
          { name: '↩️  Back to Site Selection', value: 'back' }
        ]
      }
    ]);

    switch (action) {
      case 'rename':
        await renameSite(netlifyService, selectedSite);
        break;
      case 'delete':
        await deleteSite(netlifyService, selectedSite);
        break;
      case 'details':
        await showSiteDetails(selectedSite);
        break;
      case 'deployments':
        await manageDeployments(netlifyService, selectedSite);
        break;
      case 'back':
        await manageNetlifyProjects();
        break;
    }
  } catch (error) {
    logger.error('Netlify management error', error);
    console.log(chalk.red('❌ Error managing Netlify projects:'), error.message);
  }
}

async function renameSite(netlifyService: NetlifyService, site: any) {
  try {
    const { newName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'newName',
        message: 'Enter new site name:',
        validate: (input) => {
          if (!input.trim()) return 'Site name cannot be empty';
          if (input.length > 63) return 'Site name must be 63 characters or less';
          if (!/^[a-zA-Z0-9-]+$/.test(input)) return 'Site name can only contain letters, numbers, and hyphens';
          return true;
        }
      }
    ]);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Are you sure you want to rename "${site.name}" to "${newName}"?`,
        default: false
      }
    ]);

    if (confirm) {
      await netlifyService.updateSite(site.id, { name: newName });
      console.log(chalk.green(`✅ Site renamed to "${newName}" successfully!`));
    }
  } catch (error) {
    console.log(chalk.red('❌ Error renaming site:'), error.message);
  }
}

async function deleteSite(netlifyService: NetlifyService, site: any) {
  try {
    console.log(chalk.yellow(`⚠️  You are about to delete the site "${site.name}"`));
    console.log(chalk.yellow('This action cannot be undone and will:'));
    console.log(chalk.yellow('- Delete all deployments'));
    console.log(chalk.yellow('- Remove all environment variables'));
    console.log(chalk.yellow('- Disable the site URL'));

    const { confirmName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'confirmName',
        message: `Type "${site.name}" to confirm deletion:`,
        validate: (input) => input === site.name || 'Site name does not match'
      }
    ]);

    const { finalConfirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'finalConfirm',
        message: 'Are you absolutely sure you want to delete this site?',
        default: false
      }
    ]);

    if (finalConfirm) {
      await netlifyService.deleteSite(site.id);
      console.log(chalk.green(`✅ Site "${site.name}" deleted successfully!`));
    }
  } catch (error) {
    console.log(chalk.red('❌ Error deleting site:'), error.message);
  }
}

async function showSiteDetails(site: any) {
  console.log(chalk.blue.bold('\n📊 Site Details\n'));
  console.log(chalk.cyan('Name:'), site.name);
  console.log(chalk.cyan('URL:'), site.url);
  console.log(chalk.cyan('Admin URL:'), site.admin_url);
  console.log(chalk.cyan('Created:'), new Date(site.created_at).toLocaleDateString());
  console.log(chalk.cyan('Updated:'), new Date(site.updated_at).toLocaleDateString());
  console.log(chalk.cyan('State:'), site.state);
  
  if (site.build_settings) {
    console.log(chalk.cyan('Build Command:'), site.build_settings.cmd || 'Not set');
    console.log(chalk.cyan('Publish Directory:'), site.build_settings.dir || 'Not set');
  }
}

async function manageDeployments(netlifyService: NetlifyService, site: any) {
  try {
    console.log(chalk.blue.bold('\n🚀 Deployment Management\n'));
    
    const deployments = await netlifyService.listDeployments(site.id);
    
    if (deployments.length === 0) {
      console.log(chalk.yellow('No deployments found for this site.'));
      return;
    }

    const { selectedDeployment } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedDeployment',
        message: 'Select a deployment:',
        choices: [
          ...deployments.slice(0, 10).map(deploy => ({
            name: `${deploy.state} - ${deploy.branch || 'main'} (${new Date(deploy.created_at).toLocaleDateString()})`,
            value: deploy
          })),
          { name: '↩️  Back to Site Management', value: 'back' }
        ]
      }
    ]);

    if (selectedDeployment === 'back') return;

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: '🗑️  Delete Deployment', value: 'delete' },
          { name: '📊 View Deployment Details', value: 'details' },
          { name: '↩️  Back to Deployment List', value: 'back' }
        ]
      }
    ]);

    switch (action) {
      case 'delete':
        await deleteDeployment(netlifyService, selectedDeployment);
        break;
      case 'details':
        await showDeploymentDetails(selectedDeployment);
        break;
      case 'back':
        await manageDeployments(netlifyService, site);
        break;
    }
  } catch (error) {
    console.log(chalk.red('❌ Error managing deployments:'), error.message);
  }
}

async function deleteDeployment(netlifyService: NetlifyService, deployment: any) {
  try {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Are you sure you want to delete deployment ${deployment.id}?`,
        default: false
      }
    ]);

    if (confirm) {
      await netlifyService.deleteDeployment(deployment.id);
      console.log(chalk.green('✅ Deployment deleted successfully!'));
    }
  } catch (error) {
    console.log(chalk.red('❌ Error deleting deployment:'), error.message);
  }
}

async function showDeploymentDetails(deployment: any) {
  console.log(chalk.blue.bold('\n📊 Deployment Details\n'));
  console.log(chalk.cyan('ID:'), deployment.id);
  console.log(chalk.cyan('State:'), deployment.state);
  console.log(chalk.cyan('Branch:'), deployment.branch || 'main');
  console.log(chalk.cyan('Created:'), new Date(deployment.created_at).toLocaleDateString());
  console.log(chalk.cyan('Deploy URL:'), deployment.deploy_url);
  console.log(chalk.cyan('Commit:'), deployment.commit_ref || 'Not available');
}

async function manageGitHubRepositories() {
  try {
    console.log(chalk.blue.bold('\n📂 GitHub Repository Management\n'));
    
    const githubService = new GitHubService();
    const repos = await githubService.listRepositories();
    
    if (repos.length === 0) {
      console.log(chalk.yellow('No repositories found in your account.'));
      return;
    }

    const { selectedRepo } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedRepo',
        message: 'Select a repository to manage:',
        choices: [
          ...repos.map(repo => ({
            name: `${repo.full_name} ${repo.private ? '(private)' : '(public)'}`,
            value: repo
          })),
          { name: '↩️  Back to Management Menu', value: 'back' }
        ]
      }
    ]);

    if (selectedRepo === 'back') return;

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: `What would you like to do with "${selectedRepo.name}"?`,
        choices: [
          { name: '📝 Change Repository Name', value: 'rename' },
          { name: '🗑️  Delete Repository', value: 'delete' },
          { name: '📊 View Repository Details', value: 'details' },
          { name: '🔑 Manage Deploy Keys', value: 'keys' },
          { name: '↩️  Back to Repository Selection', value: 'back' }
        ]
      }
    ]);

    switch (action) {
      case 'rename':
        await renameRepository(githubService, selectedRepo);
        break;
      case 'delete':
        await deleteRepository(githubService, selectedRepo);
        break;
      case 'details':
        await showRepositoryDetails(selectedRepo);
        break;
      case 'keys':
        await manageDeployKeys(githubService, selectedRepo);
        break;
      case 'back':
        await manageGitHubRepositories();
        break;
    }
  } catch (error) {
    logger.error('GitHub management error', error);
    console.log(chalk.red('❌ Error managing GitHub repositories:'), error.message);
  }
}

async function renameRepository(githubService: GitHubService, repo: any) {
  try {
    const { newName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'newName',
        message: 'Enter new repository name:',
        validate: (input) => {
          if (!input.trim()) return 'Repository name cannot be empty';
          if (input.length > 100) return 'Repository name must be 100 characters or less';
          if (!/^[a-zA-Z0-9._-]+$/.test(input)) return 'Repository name can only contain letters, numbers, periods, hyphens, and underscores';
          return true;
        }
      }
    ]);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Are you sure you want to rename "${repo.name}" to "${newName}"?`,
        default: false
      }
    ]);

    if (confirm) {
      await githubService.updateRepository(repo.owner.login, repo.name, { name: newName });
      console.log(chalk.green(`✅ Repository renamed to "${newName}" successfully!`));
    }
  } catch (error) {
    console.log(chalk.red('❌ Error renaming repository:'), error.message);
  }
}

async function deleteRepository(githubService: GitHubService, repo: any) {
  try {
    console.log(chalk.yellow(`⚠️  You are about to delete the repository "${repo.full_name}"`));
    console.log(chalk.yellow('This action cannot be undone and will:'));
    console.log(chalk.yellow('- Delete all code and history'));
    console.log(chalk.yellow('- Remove all issues and pull requests'));
    console.log(chalk.yellow('- Remove all releases and assets'));

    const { confirmName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'confirmName',
        message: `Type "${repo.name}" to confirm deletion:`,
        validate: (input) => input === repo.name || 'Repository name does not match'
      }
    ]);

    const { finalConfirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'finalConfirm',
        message: 'Are you absolutely sure you want to delete this repository?',
        default: false
      }
    ]);

    if (finalConfirm) {
      await githubService.deleteRepository(repo.owner.login, repo.name);
      console.log(chalk.green(`✅ Repository "${repo.name}" deleted successfully!`));
    }
  } catch (error) {
    console.log(chalk.red('❌ Error deleting repository:'), error.message);
  }
}

async function showRepositoryDetails(repo: any) {
  console.log(chalk.blue.bold('\n📊 Repository Details\n'));
  console.log(chalk.cyan('Name:'), repo.full_name);
  console.log(chalk.cyan('Description:'), repo.description || 'No description');
  console.log(chalk.cyan('Language:'), repo.language || 'Not specified');
  console.log(chalk.cyan('Visibility:'), repo.private ? 'Private' : 'Public');
  console.log(chalk.cyan('Clone URL:'), repo.clone_url);
  console.log(chalk.cyan('Created:'), new Date(repo.created_at).toLocaleDateString());
  console.log(chalk.cyan('Updated:'), new Date(repo.updated_at).toLocaleDateString());
  console.log(chalk.cyan('Stars:'), repo.stargazers_count);
  console.log(chalk.cyan('Forks:'), repo.forks_count);
  console.log(chalk.cyan('Open Issues:'), repo.open_issues_count);
}

async function manageDeployKeys(githubService: GitHubService, repo: any) {
  try {
    console.log(chalk.blue.bold('\n🔑 Deploy Key Management\n'));
    
    const keys = await githubService.listDeployKeys(repo.owner.login, repo.name);
    
    if (keys.length === 0) {
      console.log(chalk.yellow('No deploy keys found for this repository.'));
      return;
    }

    const { selectedKey } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedKey',
        message: 'Select a deploy key:',
        choices: [
          ...keys.map(key => ({
            name: `${key.title} (${key.read_only ? 'Read-only' : 'Read-write'})`,
            value: key
          })),
          { name: '↩️  Back to Repository Management', value: 'back' }
        ]
      }
    ]);

    if (selectedKey === 'back') return;

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: '🗑️  Delete Deploy Key', value: 'delete' },
          { name: '📊 View Key Details', value: 'details' },
          { name: '↩️  Back to Key List', value: 'back' }
        ]
      }
    ]);

    switch (action) {
      case 'delete':
        await deleteDeployKey(githubService, repo, selectedKey);
        break;
      case 'details':
        await showDeployKeyDetails(selectedKey);
        break;
      case 'back':
        await manageDeployKeys(githubService, repo);
        break;
    }
  } catch (error) {
    console.log(chalk.red('❌ Error managing deploy keys:'), error.message);
  }
}

async function deleteDeployKey(githubService: GitHubService, repo: any, key: any) {
  try {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Are you sure you want to delete deploy key "${key.title}"?`,
        default: false
      }
    ]);

    if (confirm) {
      await githubService.deleteDeployKey(repo.owner.login, repo.name, key.id);
      console.log(chalk.green('✅ Deploy key deleted successfully!'));
    }
  } catch (error) {
    console.log(chalk.red('❌ Error deleting deploy key:'), error.message);
  }
}

async function showDeployKeyDetails(key: any) {
  console.log(chalk.blue.bold('\n📊 Deploy Key Details\n'));
  console.log(chalk.cyan('Title:'), key.title);
  console.log(chalk.cyan('ID:'), key.id);
  console.log(chalk.cyan('Access:'), key.read_only ? 'Read-only' : 'Read-write');
  console.log(chalk.cyan('Created:'), new Date(key.created_at).toLocaleDateString());
  console.log(chalk.cyan('Key (last 20 chars):'), `...${key.key.slice(-20)}`);
}

async function manageMongoDBClusters() {
  try {
    console.log(chalk.blue.bold('\n🍃 MongoDB Cluster Management\n'));
    
    const mongoService = new MongoDBService();
    
    // First, get organizations
    const organizations = await mongoService.getOrganizations();
    
    if (organizations.length === 0) {
      console.log(chalk.yellow('No MongoDB organizations found.'));
      return;
    }

    const { selectedOrg } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedOrg',
        message: 'Select an organization:',
        choices: [
          ...organizations.map(org => ({
            name: org.name,
            value: org
          })),
          { name: '↩️  Back to Management Menu', value: 'back' }
        ]
      }
    ]);

    if (selectedOrg === 'back') return;

    // Get projects for the selected organization
    const projects = await mongoService.getProjects(selectedOrg.id);
    
    if (projects.length === 0) {
      console.log(chalk.yellow('No projects found in this organization.'));
      return;
    }

    const { selectedProject } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedProject',
        message: 'Select a project:',
        choices: [
          ...projects.map(project => ({
            name: project.name,
            value: project
          })),
          { name: '↩️  Back to Organization Selection', value: 'back' }
        ]
      }
    ]);

    if (selectedProject === 'back') return await manageMongoDBClusters();

    // Get clusters for the selected project
    const clusters = await mongoService.getClusters(selectedProject.id);
    
    if (clusters.length === 0) {
      console.log(chalk.yellow('No clusters found in this project.'));
      return;
    }

    const { selectedCluster } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedCluster',
        message: 'Select a cluster to manage:',
        choices: [
          ...clusters.map(cluster => ({
            name: `${cluster.name} (${cluster.mongoDBVersion})`,
            value: cluster
          })),
          { name: '↩️  Back to Project Selection', value: 'back' }
        ]
      }
    ]);

    if (selectedCluster === 'back') return await manageMongoDBClusters();

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: `What would you like to do with "${selectedCluster.name}"?`,
        choices: [
          { name: '📝 Change Cluster Name', value: 'rename' },
          { name: '🗑️  Delete Cluster', value: 'delete' },
          { name: '📊 View Cluster Details', value: 'details' },
          { name: '↩️  Back to Cluster Selection', value: 'back' }
        ]
      }
    ]);

    switch (action) {
      case 'rename':
        await renameCluster(mongoService, selectedProject.id, selectedCluster);
        break;
      case 'delete':
        await deleteCluster(mongoService, selectedProject.id, selectedCluster);
        break;
      case 'details':
        await showClusterDetails(selectedCluster);
        break;
      case 'back':
        await manageMongoDBClusters();
        break;
    }
  } catch (error) {
    logger.error('MongoDB management error', error);
    console.log(chalk.red('❌ Error managing MongoDB clusters:'), error.message);
  }
}

async function renameCluster(mongoService: MongoDBService, projectId: string, cluster: any) {
  try {
    const { newName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'newName',
        message: 'Enter new cluster name:',
        validate: (input) => {
          if (!input.trim()) return 'Cluster name cannot be empty';
          if (input.length > 64) return 'Cluster name must be 64 characters or less';
          if (!/^[a-zA-Z0-9-]+$/.test(input)) return 'Cluster name can only contain letters, numbers, and hyphens';
          return true;
        }
      }
    ]);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Are you sure you want to rename "${cluster.name}" to "${newName}"?`,
        default: false
      }
    ]);

    if (confirm) {
      await mongoService.updateCluster(projectId, cluster.name, { name: newName });
      console.log(chalk.green(`✅ Cluster renamed to "${newName}" successfully!`));
    }
  } catch (error) {
    console.log(chalk.red('❌ Error renaming cluster:'), error.message);
  }
}

async function deleteCluster(mongoService: MongoDBService, projectId: string, cluster: any) {
  try {
    console.log(chalk.yellow(`⚠️  You are about to delete the cluster "${cluster.name}"`));
    console.log(chalk.yellow('This action cannot be undone and will:'));
    console.log(chalk.yellow('- Delete all databases and collections'));
    console.log(chalk.yellow('- Remove all data permanently'));
    console.log(chalk.yellow('- Disable all connection strings'));

    const { confirmName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'confirmName',
        message: `Type "${cluster.name}" to confirm deletion:`,
        validate: (input) => input === cluster.name || 'Cluster name does not match'
      }
    ]);

    const { finalConfirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'finalConfirm',
        message: 'Are you absolutely sure you want to delete this cluster?',
        default: false
      }
    ]);

    if (finalConfirm) {
      await mongoService.deleteCluster(projectId, cluster.name);
      console.log(chalk.green(`✅ Cluster "${cluster.name}" deleted successfully!`));
    }
  } catch (error) {
    console.log(chalk.red('❌ Error deleting cluster:'), error.message);
  }
}

async function showClusterDetails(cluster: any) {
  console.log(chalk.blue.bold('\n📊 Cluster Details\n'));
  console.log(chalk.cyan('Name:'), cluster.name);
  console.log(chalk.cyan('MongoDB Version:'), cluster.mongoDBVersion);
  console.log(chalk.cyan('State:'), cluster.stateName);
  console.log(chalk.cyan('Created:'), new Date(cluster.createDate).toLocaleDateString());
  console.log(chalk.cyan('Cluster Type:'), cluster.clusterType);
  console.log(chalk.cyan('Backup Enabled:'), cluster.backupEnabled ? 'Yes' : 'No');
  console.log(chalk.cyan('Encryption at Rest:'), cluster.encryptionAtRestProvider || 'Not enabled');
  
  if (cluster.providerSettings) {
    console.log(chalk.cyan('Provider:'), cluster.providerSettings.providerName);
    console.log(chalk.cyan('Instance Size:'), cluster.providerSettings.instanceSizeName);
    console.log(chalk.cyan('Region:'), cluster.providerSettings.regionName);
  }
}