import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { NetlifyService } from '../services/netlify.js';

export async function netlifyCommand(returnToMain?: () => Promise<void>): Promise<void> {
  console.log(chalk.blue.bold('\n🌐 Netlify Project Management'));
  console.log(chalk.gray('Manage your Netlify projects and sites'));
  console.log();

  if (!process.env.NETLIFY_TOKEN) {
    console.log(chalk.red('❌ NETLIFY_TOKEN environment variable is required'));
    console.log(chalk.gray('Please set your Netlify API token in your environment variables'));
    return;
  }

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: '📋 List all sites', value: 'list' },
        { name: '✏️  Rename a site', value: 'rename' },
        { name: '🗑️  Delete a site', value: 'delete' },
        { name: '🧹 Bulk delete test- sites', value: 'bulk-delete' },
        { name: '🔍 View site details', value: 'details' },
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

  const netlify = new NetlifyService();

  switch (action) {
    case 'list':
      await listSites(netlify);
      break;
    case 'rename':
      await renameSite(netlify);
      break;
    case 'delete':
      await deleteSite(netlify);
      break;
    case 'bulk-delete':
      await bulkDeleteTestSites(netlify);
      break;
    case 'details':
      await viewSiteDetails(netlify);
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
    await netlifyCommand(returnToMain);
  }
}

async function listSites(netlify: NetlifyService): Promise<void> {
  const spinner = ora('Loading Netlify sites...').start();
  
  try {
    const sites = await netlify.listSites();
    spinner.stop();
    
    if (sites.length === 0) {
      console.log(chalk.yellow('📭 No sites found'));
      return;
    }

    console.log(chalk.green(`\n📋 Found ${sites.length} sites:\n`));
    
    sites.forEach((site, index) => {
      console.log(chalk.blue(`${index + 1}. ${site.name}`));
      console.log(chalk.gray(`   ID: ${site.id}`));
      console.log(chalk.gray(`   URL: ${site.ssl_url || site.url}`));
      console.log(chalk.gray(`   State: ${site.state}`));
      console.log(chalk.gray(`   Created: ${new Date(site.created_at).toLocaleDateString()}`));
      console.log();
    });
  } catch (error: any) {
    spinner.fail('Failed to load sites');
    console.log(chalk.red(`Error: ${error.message}`));
  }
}

async function renameSite(netlify: NetlifyService): Promise<void> {
  const spinner = ora('Loading sites...').start();
  
  try {
    const sites = await netlify.listSites();
    spinner.stop();
    
    if (sites.length === 0) {
      console.log(chalk.yellow('📭 No sites found'));
      return;
    }

    const { selectedSite } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedSite',
        message: 'Select a site to rename:',
        choices: sites.map(site => ({
          name: `${site.name} (${site.ssl_url || site.url})`,
          value: site
        }))
      }
    ]);

    const { newName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'newName',
        message: 'Enter new site name:',
        default: selectedSite.name,
        validate: (input) => input.length > 0 || 'Site name cannot be empty'
      }
    ]);

    const confirmSpinner = ora(`Renaming site to ${newName}...`).start();
    
    try {
      await netlify.updateSite(selectedSite.id, { name: newName });
      confirmSpinner.succeed(chalk.green(`Site renamed to ${newName}`));
    } catch (error: any) {
      confirmSpinner.fail('Failed to rename site');
      console.log(chalk.red(`Error: ${error.message}`));
    }
  } catch (error: any) {
    spinner.fail('Failed to load sites');
    console.log(chalk.red(`Error: ${error.message}`));
  }
}

async function deleteSite(netlify: NetlifyService): Promise<void> {
  const spinner = ora('Loading sites...').start();
  
  try {
    const sites = await netlify.listSites();
    spinner.stop();
    
    if (sites.length === 0) {
      console.log(chalk.yellow('📭 No sites found'));
      return;
    }

    const { selectedSite } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedSite',
        message: 'Select a site to delete:',
        choices: sites.map(site => ({
          name: `${site.name} (${site.ssl_url || site.url})`,
          value: site
        }))
      }
    ]);

    console.log(chalk.yellow(`\n⚠️  You are about to delete:`));
    console.log(chalk.yellow(`   Site: ${selectedSite.name}`));
    console.log(chalk.yellow(`   URL: ${selectedSite.ssl_url || selectedSite.url}`));
    console.log(chalk.red(`   This action cannot be undone!`));

    const { confirmDelete } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmDelete',
        message: 'Are you sure you want to delete this site?',
        default: false
      }
    ]);

    if (!confirmDelete) {
      console.log(chalk.gray('Delete cancelled'));
      return;
    }

    const deleteSpinner = ora(`Deleting site ${selectedSite.name}...`).start();
    
    try {
      await netlify.deleteSite(selectedSite.id);
      deleteSpinner.succeed(chalk.green(`Site ${selectedSite.name} deleted successfully`));
    } catch (error: any) {
      deleteSpinner.fail('Failed to delete site');
      console.log(chalk.red(`Error: ${error.message}`));
    }
  } catch (error: any) {
    spinner.fail('Failed to load sites');
    console.log(chalk.red(`Error: ${error.message}`));
  }
}

async function viewSiteDetails(netlify: NetlifyService): Promise<void> {
  const spinner = ora('Loading sites...').start();
  
  try {
    const sites = await netlify.listSites();
    spinner.stop();
    
    if (sites.length === 0) {
      console.log(chalk.yellow('📭 No sites found'));
      return;
    }

    const { selectedSite } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedSite',
        message: 'Select a site to view details:',
        choices: sites.map(site => ({
          name: `${site.name} (${site.ssl_url || site.url})`,
          value: site
        }))
      }
    ]);

    const detailsSpinner = ora('Loading site details...').start();
    
    try {
      const siteDetails = await netlify.getSiteInfo(selectedSite.id);
      const deployments = await netlify.listDeployments(selectedSite.id);
      
      detailsSpinner.stop();
      
      console.log(chalk.blue(`\n📋 Site Details: ${siteDetails.name}\n`));
      console.log(chalk.gray(`ID: ${siteDetails.id}`));
      console.log(chalk.gray(`URL: ${siteDetails.ssl_url || siteDetails.url}`));
      console.log(chalk.gray(`Admin URL: ${siteDetails.project_url}`));
      console.log(chalk.gray(`State: ${siteDetails.state}`));
      console.log(chalk.gray(`Created: ${new Date(siteDetails.created_at).toLocaleDateString()}`));
      console.log(chalk.gray(`Updated: ${new Date(siteDetails.updated_at).toLocaleDateString()}`));
      
      if (deployments.length > 0) {
        console.log(chalk.blue(`\n🚀 Recent Deployments (${deployments.length} total):\n`));
        deployments.slice(0, 5).forEach((deployment, index) => {
          console.log(chalk.gray(`${index + 1}. ${deployment.id}`));
          console.log(chalk.gray(`   State: ${deployment.state}`));
          console.log(chalk.gray(`   Branch: ${deployment.branch || 'main'}`));
          console.log(chalk.gray(`   Created: ${new Date(deployment.created_at).toLocaleDateString()}`));
          console.log();
        });
      }
    } catch (error: any) {
      detailsSpinner.fail('Failed to load site details');
      console.log(chalk.red(`Error: ${error.message}`));
    }
  } catch (error: any) {
    spinner.fail('Failed to load sites');
    console.log(chalk.red(`Error: ${error.message}`));
  }
}

async function bulkDeleteTestSites(netlify: NetlifyService): Promise<void> {
  const spinner = ora('Loading sites...').start();
  
  try {
    const sites = await netlify.listSites();
    spinner.stop();
    
    if (sites.length === 0) {
      console.log(chalk.yellow('📭 No sites found'));
      return;
    }

    const testSites = sites.filter(site => site.name.startsWith('test-'));
    
    if (testSites.length === 0) {
      console.log(chalk.yellow('📭 No sites found with names starting with "test-"'));
      return;
    }

    console.log(chalk.blue(`\n🔍 Found ${testSites.length} sites with names starting with "test-":\n`));
    
    testSites.forEach((site, index) => {
      console.log(chalk.yellow(`${index + 1}. ${site.name}`));
      console.log(chalk.gray(`   URL: ${site.ssl_url || site.url}`));
      console.log(chalk.gray(`   State: ${site.state}`));
      console.log();
    });

    console.log(chalk.red(`⚠️  You are about to delete ${testSites.length} sites!`));
    console.log(chalk.red(`This action cannot be undone!`));

    const { confirmBulkDelete } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmBulkDelete',
        message: `Are you sure you want to delete all ${testSites.length} sites starting with "test-"?`,
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
        message: 'Type "DELETE ALL TEST SITES" to confirm:',
        validate: (input) => input === 'DELETE ALL TEST SITES' || 'Please type exactly "DELETE ALL TEST SITES"'
      }
    ]);

    const deleteSpinner = ora(`Deleting ${testSites.length} test sites...`).start();
    
    try {
      let deletedCount = 0;
      let errorCount = 0;
      
      for (const site of testSites) {
        try {
          await netlify.deleteSite(site.id);
          deletedCount++;
          deleteSpinner.text = `Deleted ${deletedCount}/${testSites.length} sites...`;
        } catch (error: any) {
          errorCount++;
          console.log(chalk.red(`\nFailed to delete ${site.name}: ${error.message}`));
        }
      }
      
      deleteSpinner.stop();
      
      if (deletedCount > 0) {
        console.log(chalk.green(`✅ Successfully deleted ${deletedCount} test sites`));
      }
      if (errorCount > 0) {
        console.log(chalk.red(`❌ Failed to delete ${errorCount} sites`));
      }
    } catch (error: any) {
      deleteSpinner.fail('Bulk delete failed');
      console.log(chalk.red(`Error: ${error.message}`));
    }
  } catch (error: any) {
    spinner.fail('Failed to load sites');
    console.log(chalk.red(`Error: ${error.message}`));
  }
}