import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { GitHubService } from '../services/github.js';

export async function githubCommand(returnToMain?: () => Promise<void>): Promise<void> {
  console.log(chalk.blue.bold('\n🐙 GitHub Repository Management'));
  console.log(chalk.gray('Manage your GitHub repositories'));
  console.log();

  if (!process.env.GITHUB_TOKEN) {
    console.log(chalk.red('❌ GITHUB_TOKEN environment variable is required'));
    console.log(chalk.gray('Please set your GitHub API token in your environment variables'));
    return;
  }

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '📋 List repositories', value: 'list' },
        { name: '✏️  Rename a repository', value: 'rename' },
        { name: '🗑️  Delete a repository', value: 'delete' },
        { name: '🧹 Bulk delete test- repos', value: 'bulk-delete' },
        { name: '🔍 View repository details', value: 'details' },
        { name: '🔙 Back to main menu', value: 'back' }
      ]
    }
  ]);

  if (action === 'back') {
    if (returnToMain) {
      console.clear();
      return;
    }
    return;
  }

  const github = new GitHubService();

  switch (action) {
    case 'list':
      await listRepositories(github);
      break;
    case 'rename':
      await renameRepository(github);
      break;
    case 'delete':
      await deleteRepository(github);
      break;
    case 'bulk-delete':
      await bulkDeleteTestRepositories(github);
      break;
    case 'details':
      await viewRepositoryDetails(github);
      break;
  }

  // Ask if user wants to perform another action
  const { continueAction } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'continueAction',
      message: 'Would you like to perform another action?',
      default: true
    }
  ]);

  if (continueAction) {
    await githubCommand(returnToMain);
  }
}

async function listRepositories(github: GitHubService): Promise<void> {
  const spinner = ora('Loading GitHub repositories...').start();
  
  try {
    const repos = await github.listRepositories();
    spinner.stop();
    
    if (repos.length === 0) {
      console.log(chalk.yellow('📭 No repositories found'));
      return;
    }

    console.log(chalk.green(`\n📋 Found ${repos.length} repositories:\n`));
    
    repos.forEach((repo, index) => {
      console.log(chalk.blue(`${index + 1}. ${repo.name}`));
      console.log(chalk.gray(`   Full Name: ${repo.full_name}`));
      console.log(chalk.gray(`   URL: ${repo.html_url}`));
      console.log(chalk.gray(`   Language: ${repo.language || 'N/A'}`));
      console.log(chalk.gray(`   Stars: ${repo.stargazers_count}`));
      console.log(chalk.gray(`   Private: ${repo.private ? 'Yes' : 'No'}`));
      console.log(chalk.gray(`   Created: ${new Date(repo.created_at).toLocaleDateString()}`));
      console.log();
    });
  } catch (error: any) {
    spinner.fail('Failed to load repositories');
    console.log(chalk.red(`Error: ${error.message}`));
  }
}

async function renameRepository(github: GitHubService): Promise<void> {
  const spinner = ora('Loading repositories...').start();
  
  try {
    const repos = await github.listRepositories();
    spinner.stop();
    
    if (repos.length === 0) {
      console.log(chalk.yellow('📭 No repositories found'));
      return;
    }

    const { selectedRepo } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedRepo',
        message: 'Select a repository to rename:',
        choices: repos.map(repo => ({
          name: `${repo.name} (${repo.full_name})`,
          value: repo
        }))
      }
    ]);

    const { newName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'newName',
        message: 'Enter new repository name:',
        default: selectedRepo.name,
        validate: (input) => {
          if (input.length === 0) return 'Repository name cannot be empty';
          if (!/^[a-zA-Z0-9._-]+$/.test(input)) return 'Repository name can only contain letters, numbers, dots, hyphens, and underscores';
          return true;
        }
      }
    ]);

    console.log(chalk.yellow(`\n⚠️  You are about to rename:`));
    console.log(chalk.yellow(`   Repository: ${selectedRepo.name}`));
    console.log(chalk.yellow(`   New Name: ${newName}`));
    console.log(chalk.yellow(`   This will change the repository URL and may break existing links!`));

    const { confirmRename } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmRename',
        message: 'Are you sure you want to rename this repository?',
        default: false
      }
    ]);

    if (!confirmRename) {
      console.log(chalk.gray('Rename cancelled'));
      return;
    }

    const confirmSpinner = ora(`Renaming repository to ${newName}...`).start();
    
    try {
      await github.renameRepository(selectedRepo.owner.login, selectedRepo.name, newName);
      confirmSpinner.succeed(chalk.green(`Repository renamed to ${newName}`));
      console.log(chalk.blue(`New URL: https://github.com/${selectedRepo.owner.login}/${newName}`));
    } catch (error: any) {
      confirmSpinner.fail('Failed to rename repository');
      console.log(chalk.red(`Error: ${error.message}`));
    }
  } catch (error: any) {
    spinner.fail('Failed to load repositories');
    console.log(chalk.red(`Error: ${error.message}`));
  }
}

async function deleteRepository(github: GitHubService): Promise<void> {
  const spinner = ora('Loading repositories...').start();
  
  try {
    const repos = await github.listRepositories();
    spinner.stop();
    
    if (repos.length === 0) {
      console.log(chalk.yellow('📭 No repositories found'));
      return;
    }

    const { selectedRepo } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedRepo',
        message: 'Select a repository to delete:',
        choices: repos.map(repo => ({
          name: `${repo.name} (${repo.full_name})`,
          value: repo
        }))
      }
    ]);

    console.log(chalk.red(`\n⚠️  DANGER: You are about to delete:`));
    console.log(chalk.red(`   Repository: ${selectedRepo.name}`));
    console.log(chalk.red(`   Full Name: ${selectedRepo.full_name}`));
    console.log(chalk.red(`   URL: ${selectedRepo.html_url}`));
    console.log(chalk.red(`   THIS ACTION CANNOT BE UNDONE!`));
    console.log(chalk.red(`   All code, issues, and pull requests will be permanently lost!`));

    const { confirmDelete } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmDelete',
        message: 'Are you absolutely sure you want to delete this repository?',
        default: false
      }
    ]);

    if (!confirmDelete) {
      console.log(chalk.gray('Delete cancelled'));
      return;
    }

    // Double confirmation for safety
    const { finalConfirm } = await inquirer.prompt([
      {
        type: 'input',
        name: 'finalConfirm',
        message: `Type the repository name "${selectedRepo.name}" to confirm deletion:`,
        validate: (input) => input === selectedRepo.name || 'Repository name does not match'
      }
    ]);

    const deleteSpinner = ora(`Deleting repository ${selectedRepo.name}...`).start();
    
    try {
      await github.deleteRepository(selectedRepo.owner.login, selectedRepo.name);
      deleteSpinner.succeed(chalk.green(`Repository ${selectedRepo.name} deleted successfully`));
    } catch (error: any) {
      deleteSpinner.fail('Failed to delete repository');
      console.log(chalk.red(`Error: ${error.message}`));
    }
  } catch (error: any) {
    spinner.fail('Failed to load repositories');
    console.log(chalk.red(`Error: ${error.message}`));
  }
}

async function viewRepositoryDetails(github: GitHubService): Promise<void> {
  const spinner = ora('Loading repositories...').start();
  
  try {
    const repos = await github.listRepositories();
    spinner.stop();
    
    if (repos.length === 0) {
      console.log(chalk.yellow('📭 No repositories found'));
      return;
    }

    const { selectedRepo } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedRepo',
        message: 'Select a repository to view details:',
        choices: repos.map(repo => ({
          name: `${repo.name} (${repo.full_name})`,
          value: repo
        }))
      }
    ]);

    const detailsSpinner = ora('Loading repository details...').start();
    
    try {
      const repoDetails = await github.getRepository(selectedRepo.owner.login, selectedRepo.name);
      const branches = await github.listBranches(selectedRepo.owner.login, selectedRepo.name);
      
      detailsSpinner.stop();
      
      console.log(chalk.blue(`\n📋 Repository Details: ${repoDetails.name}\n`));
      console.log(chalk.gray(`Full Name: ${repoDetails.full_name}`));
      console.log(chalk.gray(`Description: ${repoDetails.description || 'No description'}`));
      console.log(chalk.gray(`URL: ${repoDetails.html_url}`));
      console.log(chalk.gray(`Language: ${repoDetails.language || 'N/A'}`));
      console.log(chalk.gray(`Stars: ${repoDetails.stargazers_count}`));
      console.log(chalk.gray(`Forks: ${repoDetails.forks_count}`));
      console.log(chalk.gray(`Size: ${repoDetails.size} KB`));
      console.log(chalk.gray(`Private: ${repoDetails.private ? 'Yes' : 'No'}`));
      console.log(chalk.gray(`Default Branch: ${repoDetails.default_branch}`));
      console.log(chalk.gray(`Created: ${new Date(repoDetails.created_at).toLocaleDateString()}`));
      console.log(chalk.gray(`Updated: ${new Date(repoDetails.updated_at).toLocaleDateString()}`));
      
      if (branches.length > 0) {
        console.log(chalk.blue(`\n🌳 Branches (${branches.length} total):\n`));
        branches.slice(0, 10).forEach((branch, index) => {
          console.log(chalk.gray(`${index + 1}. ${branch.name}${branch.name === repoDetails.default_branch ? ' (default)' : ''}`));
        });
        if (branches.length > 10) {
          console.log(chalk.gray(`... and ${branches.length - 10} more`));
        }
      }
    } catch (error: any) {
      detailsSpinner.fail('Failed to load repository details');
      console.log(chalk.red(`Error: ${error.message}`));
    }
  } catch (error: any) {
    spinner.fail('Failed to load repositories');
    console.log(chalk.red(`Error: ${error.message}`));
  }
}

async function bulkDeleteTestRepositories(github: GitHubService): Promise<void> {
  const spinner = ora('Loading repositories...').start();
  
  try {
    const repos = await github.listRepositories();
    spinner.stop();
    
    if (repos.length === 0) {
      console.log(chalk.yellow('📭 No repositories found'));
      return;
    }

    const testRepos = repos.filter(repo => repo.name.startsWith('test-'));
    
    if (testRepos.length === 0) {
      console.log(chalk.yellow('📭 No repositories found with names starting with "test-"'));
      return;
    }

    console.log(chalk.blue(`\n🔍 Found ${testRepos.length} repositories with names starting with "test-":\n`));
    
    testRepos.forEach((repo, index) => {
      console.log(chalk.yellow(`${index + 1}. ${repo.name}`));
      console.log(chalk.gray(`   Full Name: ${repo.full_name}`));
      console.log(chalk.gray(`   URL: ${repo.html_url}`));
      console.log(chalk.gray(`   Private: ${repo.private ? 'Yes' : 'No'}`));
      console.log();
    });

    console.log(chalk.red(`⚠️  DANGER: You are about to delete ${testRepos.length} repositories!`));
    console.log(chalk.red(`This action cannot be undone!`));
    console.log(chalk.red(`All code, issues, and pull requests will be permanently lost!`));

    const { confirmBulkDelete } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmBulkDelete',
        message: `Are you absolutely sure you want to delete all ${testRepos.length} repositories starting with "test-"?`,
        default: false
      }
    ]);

    if (!confirmBulkDelete) {
      console.log(chalk.gray('Bulk delete cancelled'));
      return;
    }

    const { finalConfirm } = await inquirer.prompt([
      {
        type: 'input',
        name: 'finalConfirm',
        message: 'Type "DELETE ALL TEST REPOS" to confirm:',
        validate: (input) => input === 'DELETE ALL TEST REPOS' || 'Please type exactly "DELETE ALL TEST REPOS"'
      }
    ]);

    const deleteSpinner = ora(`Deleting ${testRepos.length} test repositories...`).start();
    
    try {
      let deletedCount = 0;
      let errorCount = 0;
      
      for (const repo of testRepos) {
        try {
          await github.deleteRepository(repo.owner.login, repo.name);
          deletedCount++;
          deleteSpinner.text = `Deleted ${deletedCount}/${testRepos.length} repositories...`;
        } catch (error: any) {
          errorCount++;
          console.log(chalk.red(`\nFailed to delete ${repo.name}: ${error.message}`));
        }
      }
      
      deleteSpinner.stop();
      
      if (deletedCount > 0) {
        console.log(chalk.green(`✅ Successfully deleted ${deletedCount} test repositories`));
      }
      if (errorCount > 0) {
        console.log(chalk.red(`❌ Failed to delete ${errorCount} repositories`));
      }
    } catch (error: any) {
      deleteSpinner.fail('Bulk delete failed');
      console.log(chalk.red(`Error: ${error.message}`));
    }
  } catch (error: any) {
    spinner.fail('Failed to load repositories');
    console.log(chalk.red(`Error: ${error.message}`));
  }
}