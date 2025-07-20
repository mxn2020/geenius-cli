import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { MongoDBService } from '../services/mongodb.js';
import { bulkDeleteTestProjects, bulkDeleteTestClusters } from './mongodb-bulk.js';

export async function mongodbCommand(returnToMain?: () => Promise<void>): Promise<void> {
  console.log(chalk.blue.bold('\n🍃 MongoDB Atlas Management'));
  console.log(chalk.gray('Manage your MongoDB organizations, projects, and clusters'));
  console.log();

  if (!process.env.MONGODB_ATLAS_PUBLIC_KEY || !process.env.MONGODB_ATLAS_PRIVATE_KEY) {
    console.log(chalk.red('❌ MongoDB Atlas API keys are required'));
    console.log(chalk.gray('Please set MONGODB_ATLAS_PUBLIC_KEY and MONGODB_ATLAS_PRIVATE_KEY in your environment variables'));
    return;
  }

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to manage?',
      choices: [
        { name: '🏢 Organizations', value: 'organizations' },
        { name: '📁 Projects', value: 'projects' },
        { name: '🔗 Clusters', value: 'clusters' },
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

  const mongodb = new MongoDBService();

  switch (action) {
    case 'organizations':
      await manageOrganizations(mongodb);
      break;
    case 'projects':
      await manageProjects(mongodb);
      break;
    case 'clusters':
      await manageClusters(mongodb);
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
    await mongodbCommand(returnToMain);
  }
}

async function manageOrganizations(mongodb: MongoDBService): Promise<void> {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Organization management:',
      choices: [
        { name: '📋 List organizations', value: 'list' },
        { name: '🔍 View organization details', value: 'details' },
        { name: '🔙 Back', value: 'back' }
      ]
    }
  ]);

  if (action === 'back') return;

  switch (action) {
    case 'list':
      await listOrganizations(mongodb);
      break;
    case 'details':
      await viewOrganizationDetails(mongodb);
      break;
  }
}

async function manageProjects(mongodb: MongoDBService): Promise<void> {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Project management:',
      choices: [
        { name: '📋 List projects', value: 'list' },
        { name: '🗑️  Delete a project', value: 'delete' },
        { name: '🧹 Bulk delete test- projects', value: 'bulk-delete' },
        { name: '🔍 View project details', value: 'details' },
        { name: '🔙 Back', value: 'back' }
      ]
    }
  ]);

  if (action === 'back') return;

  switch (action) {
    case 'list':
      await listProjects(mongodb);
      break;
    case 'delete':
      await deleteProject(mongodb);
      break;
    case 'bulk-delete':
      await bulkDeleteTestProjects(mongodb);
      break;
    case 'details':
      await viewProjectDetails(mongodb);
      break;
  }
}

async function manageClusters(mongodb: MongoDBService): Promise<void> {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Cluster management:',
      choices: [
        { name: '📋 List clusters', value: 'list' },
        { name: '🗑️  Delete a cluster', value: 'delete' },
        { name: '🧹 Bulk delete test- clusters', value: 'bulk-delete' },
        { name: '🔍 View cluster details', value: 'details' },
        { name: '🔙 Back', value: 'back' }
      ]
    }
  ]);

  if (action === 'back') return;

  switch (action) {
    case 'list':
      await listClusters(mongodb);
      break;
    case 'delete':
      await deleteCluster(mongodb);
      break;
    case 'bulk-delete':
      await bulkDeleteTestClusters(mongodb);
      break;
    case 'details':
      await viewClusterDetails(mongodb);
      break;
  }
}

async function listOrganizations(mongodb: MongoDBService): Promise<void> {
  const spinner = ora('Loading organizations...').start();
  
  try {
    const organizations = await mongodb.getOrganizations();
    spinner.stop();
    
    if (organizations.length === 0) {
      console.log(chalk.yellow('📭 No organizations found'));
      return;
    }

    console.log(chalk.green(`\n📋 Found ${organizations.length} organizations:\n`));
    
    organizations.forEach((org, index) => {
      console.log(chalk.blue(`${index + 1}. ${org.name}`));
      console.log(chalk.gray(`   ID: ${org.id}`));
      console.log(chalk.gray(`   Created: ${new Date(org.created).toLocaleDateString()}`));
      console.log();
    });
  } catch (error: any) {
    spinner.fail('Failed to load organizations');
    console.log(chalk.red(`Error: ${error.message}`));
  }
}

async function viewOrganizationDetails(mongodb: MongoDBService): Promise<void> {
  const spinner = ora('Loading organizations...').start();
  
  try {
    const organizations = await mongodb.getOrganizations();
    spinner.stop();
    
    if (organizations.length === 0) {
      console.log(chalk.yellow('📭 No organizations found'));
      return;
    }

    const { selectedOrg } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedOrg',
        message: 'Select an organization to view details:',
        choices: organizations.map(org => ({
          name: `${org.name} (${org.id})`,
          value: org
        }))
      }
    ]);

    const detailsSpinner = ora('Loading organization details...').start();
    
    try {
      const projects = await mongodb.getProjects(selectedOrg.id);
      detailsSpinner.stop();
      
      console.log(chalk.blue(`\n📋 Organization Details: ${selectedOrg.name}\n`));
      console.log(chalk.gray(`ID: ${selectedOrg.id}`));
      console.log(chalk.gray(`Created: ${new Date(selectedOrg.created).toLocaleDateString()}`));
      console.log(chalk.gray(`Projects: ${projects.length}`));
      
      if (projects.length > 0) {
        console.log(chalk.blue(`\n📁 Projects:\n`));
        projects.forEach((project, index) => {
          console.log(chalk.gray(`${index + 1}. ${project.name} (${project.id})`));
          console.log(chalk.gray(`   Created: ${new Date(project.created).toLocaleDateString()}`));
          console.log();
        });
      }
    } catch (error: any) {
      detailsSpinner.fail('Failed to load organization details');
      console.log(chalk.red(`Error: ${error.message}`));
    }
  } catch (error: any) {
    spinner.fail('Failed to load organizations');
    console.log(chalk.red(`Error: ${error.message}`));
  }
}

async function listProjects(mongodb: MongoDBService): Promise<void> {
  const spinner = ora('Loading organizations...').start();
  
  try {
    const organizations = await mongodb.getOrganizations();
    spinner.stop();
    
    if (organizations.length === 0) {
      console.log(chalk.yellow('📭 No organizations found'));
      return;
    }

    const { selectedOrg } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedOrg',
        message: 'Select an organization to list projects:',
        choices: organizations.map(org => ({
          name: `${org.name} (${org.id})`,
          value: org
        }))
      }
    ]);

    const projectsSpinner = ora('Loading projects...').start();
    
    try {
      const projects = await mongodb.getProjects(selectedOrg.id);
      projectsSpinner.stop();
      
      if (projects.length === 0) {
        console.log(chalk.yellow('📭 No projects found in this organization'));
        return;
      }

      console.log(chalk.green(`\n📋 Found ${projects.length} projects in ${selectedOrg.name}:\n`));
      
      projects.forEach((project, index) => {
        console.log(chalk.blue(`${index + 1}. ${project.name}`));
        console.log(chalk.gray(`   ID: ${project.id}`));
        console.log(chalk.gray(`   Created: ${new Date(project.created).toLocaleDateString()}`));
        console.log();
      });
    } catch (error: any) {
      projectsSpinner.fail('Failed to load projects');
      console.log(chalk.red(`Error: ${error.message}`));
    }
  } catch (error: any) {
    spinner.fail('Failed to load organizations');
    console.log(chalk.red(`Error: ${error.message}`));
  }
}

async function deleteProject(mongodb: MongoDBService): Promise<void> {
  const spinner = ora('Loading organizations...').start();
  
  try {
    const organizations = await mongodb.getOrganizations();
    spinner.stop();
    
    if (organizations.length === 0) {
      console.log(chalk.yellow('📭 No organizations found'));
      return;
    }

    const { selectedOrg } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedOrg',
        message: 'Select an organization:',
        choices: organizations.map(org => ({
          name: `${org.name} (${org.id})`,
          value: org
        }))
      }
    ]);

    const projectsSpinner = ora('Loading projects...').start();
    
    try {
      const projects = await mongodb.getProjects(selectedOrg.id);
      projectsSpinner.stop();
      
      if (projects.length === 0) {
        console.log(chalk.yellow('📭 No projects found in this organization'));
        return;
      }

      const { selectedProject } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedProject',
          message: 'Select a project to delete:',
          choices: projects.map(project => ({
            name: `${project.name} (${project.id})`,
            value: project
          }))
        }
      ]);

      console.log(chalk.red(`\n⚠️  DANGER: You are about to delete:`));
      console.log(chalk.red(`   Project: ${selectedProject.name}`));
      console.log(chalk.red(`   ID: ${selectedProject.id}`));
      console.log(chalk.red(`   Organization: ${selectedOrg.name}`));
      console.log(chalk.red(`   THIS ACTION CANNOT BE UNDONE!`));
      console.log(chalk.red(`   All clusters, databases, and data will be permanently lost!`));

      const { confirmDelete } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmDelete',
          message: 'Are you absolutely sure you want to delete this project?',
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
          message: `Type the project name "${selectedProject.name}" to confirm deletion:`,
          validate: (input) => input === selectedProject.name || 'Project name does not match'
        }
      ]);

      const deleteSpinner = ora(`Deleting project ${selectedProject.name}...`).start();
      
      try {
        await mongodb.deleteProject(selectedProject.id);
        deleteSpinner.succeed(chalk.green(`Project ${selectedProject.name} deleted successfully`));
      } catch (error: any) {
        deleteSpinner.fail('Failed to delete project');
        console.log(chalk.red(`Error: ${error.message}`));
      }
    } catch (error: any) {
      projectsSpinner.fail('Failed to load projects');
      console.log(chalk.red(`Error: ${error.message}`));
    }
  } catch (error: any) {
    spinner.fail('Failed to load organizations');
    console.log(chalk.red(`Error: ${error.message}`));
  }
}

async function viewProjectDetails(mongodb: MongoDBService): Promise<void> {
  const spinner = ora('Loading organizations...').start();
  
  try {
    const organizations = await mongodb.getOrganizations();
    spinner.stop();
    
    if (organizations.length === 0) {
      console.log(chalk.yellow('📭 No organizations found'));
      return;
    }

    const { selectedOrg } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedOrg',
        message: 'Select an organization:',
        choices: organizations.map(org => ({
          name: `${org.name} (${org.id})`,
          value: org
        }))
      }
    ]);

    const projectsSpinner = ora('Loading projects...').start();
    
    try {
      const projects = await mongodb.getProjects(selectedOrg.id);
      projectsSpinner.stop();
      
      if (projects.length === 0) {
        console.log(chalk.yellow('📭 No projects found in this organization'));
        return;
      }

      const { selectedProject } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedProject',
          message: 'Select a project to view details:',
          choices: projects.map(project => ({
            name: `${project.name} (${project.id})`,
            value: project
          }))
        }
      ]);

      const detailsSpinner = ora('Loading project details...').start();
      
      try {
        const clusters = await mongodb.getClusters(selectedProject.id);
        detailsSpinner.stop();
        
        console.log(chalk.blue(`\n📋 Project Details: ${selectedProject.name}\n`));
        console.log(chalk.gray(`ID: ${selectedProject.id}`));
        console.log(chalk.gray(`Organization: ${selectedOrg.name}`));
        console.log(chalk.gray(`Created: ${new Date(selectedProject.created).toLocaleDateString()}`));
        console.log(chalk.gray(`Clusters: ${clusters.length}`));
        
        if (clusters.length > 0) {
          console.log(chalk.blue(`\n🔗 Clusters:\n`));
          clusters.forEach((cluster, index) => {
            console.log(chalk.gray(`${index + 1}. ${cluster.name}`));
            console.log(chalk.gray(`   State: ${cluster.stateName}`));
            console.log(chalk.gray(`   Provider: ${cluster.providerSettings?.providerName || 'N/A'}`));
            console.log(chalk.gray(`   Instance Size: ${cluster.providerSettings?.instanceSizeName || 'N/A'}`));
            console.log(chalk.gray(`   Created: ${new Date(cluster.createDate).toLocaleDateString()}`));
            console.log();
          });
        }
      } catch (error: any) {
        detailsSpinner.fail('Failed to load project details');
        console.log(chalk.red(`Error: ${error.message}`));
      }
    } catch (error: any) {
      projectsSpinner.fail('Failed to load projects');
      console.log(chalk.red(`Error: ${error.message}`));
    }
  } catch (error: any) {
    spinner.fail('Failed to load organizations');
    console.log(chalk.red(`Error: ${error.message}`));
  }
}

async function listClusters(mongodb: MongoDBService): Promise<void> {
  // Similar implementation to listProjects but for clusters
  const spinner = ora('Loading organizations...').start();
  
  try {
    const organizations = await mongodb.getOrganizations();
    spinner.stop();
    
    if (organizations.length === 0) {
      console.log(chalk.yellow('📭 No organizations found'));
      return;
    }

    const { selectedOrg } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedOrg',
        message: 'Select an organization:',
        choices: organizations.map(org => ({
          name: `${org.name} (${org.id})`,
          value: org
        }))
      }
    ]);

    const projectsSpinner = ora('Loading projects...').start();
    
    try {
      const projects = await mongodb.getProjects(selectedOrg.id);
      projectsSpinner.stop();
      
      if (projects.length === 0) {
        console.log(chalk.yellow('📭 No projects found in this organization'));
        return;
      }

      const { selectedProject } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedProject',
          message: 'Select a project to list clusters:',
          choices: projects.map(project => ({
            name: `${project.name} (${project.id})`,
            value: project
          }))
        }
      ]);

      const clustersSpinner = ora('Loading clusters...').start();
      
      try {
        const clusters = await mongodb.getClusters(selectedProject.id);
        clustersSpinner.stop();
        
        if (clusters.length === 0) {
          console.log(chalk.yellow('📭 No clusters found in this project'));
          return;
        }

        console.log(chalk.green(`\n📋 Found ${clusters.length} clusters in ${selectedProject.name}:\n`));
        
        clusters.forEach((cluster, index) => {
          console.log(chalk.blue(`${index + 1}. ${cluster.name}`));
          console.log(chalk.gray(`   State: ${cluster.stateName}`));
          console.log(chalk.gray(`   Provider: ${cluster.providerSettings?.providerName || 'N/A'}`));
          console.log(chalk.gray(`   Instance Size: ${cluster.providerSettings?.instanceSizeName || 'N/A'}`));
          console.log(chalk.gray(`   Region: ${cluster.providerSettings?.regionName || 'N/A'}`));
          console.log(chalk.gray(`   Created: ${new Date(cluster.createDate).toLocaleDateString()}`));
          console.log();
        });
      } catch (error: any) {
        clustersSpinner.fail('Failed to load clusters');
        console.log(chalk.red(`Error: ${error.message}`));
      }
    } catch (error: any) {
      projectsSpinner.fail('Failed to load projects');
      console.log(chalk.red(`Error: ${error.message}`));
    }
  } catch (error: any) {
    spinner.fail('Failed to load organizations');
    console.log(chalk.red(`Error: ${error.message}`));
  }
}

async function deleteCluster(mongodb: MongoDBService): Promise<void> {
  // Implementation for deleting clusters
  const spinner = ora('Loading organizations...').start();
  
  try {
    const organizations = await mongodb.getOrganizations();
    spinner.stop();
    
    if (organizations.length === 0) {
      console.log(chalk.yellow('📭 No organizations found'));
      return;
    }

    const { selectedOrg } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedOrg',
        message: 'Select an organization:',
        choices: organizations.map(org => ({
          name: `${org.name} (${org.id})`,
          value: org
        }))
      }
    ]);

    const projectsSpinner = ora('Loading projects...').start();
    
    try {
      const projects = await mongodb.getProjects(selectedOrg.id);
      projectsSpinner.stop();
      
      if (projects.length === 0) {
        console.log(chalk.yellow('📭 No projects found in this organization'));
        return;
      }

      const { selectedProject } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedProject',
          message: 'Select a project:',
          choices: projects.map(project => ({
            name: `${project.name} (${project.id})`,
            value: project
          }))
        }
      ]);

      const clustersSpinner = ora('Loading clusters...').start();
      
      try {
        const clusters = await mongodb.getClusters(selectedProject.id);
        clustersSpinner.stop();
        
        if (clusters.length === 0) {
          console.log(chalk.yellow('📭 No clusters found in this project'));
          return;
        }

        const { selectedCluster } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedCluster',
            message: 'Select a cluster to delete:',
            choices: clusters.map(cluster => ({
              name: `${cluster.name} (${cluster.stateName})`,
              value: cluster
            }))
          }
        ]);

        console.log(chalk.red(`\n⚠️  DANGER: You are about to delete:`));
        console.log(chalk.red(`   Cluster: ${selectedCluster.name}`));
        console.log(chalk.red(`   Project: ${selectedProject.name}`));
        console.log(chalk.red(`   State: ${selectedCluster.stateName}`));
        console.log(chalk.red(`   THIS ACTION CANNOT BE UNDONE!`));
        console.log(chalk.red(`   All databases and data will be permanently lost!`));

        const { confirmDelete } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmDelete',
            message: 'Are you absolutely sure you want to delete this cluster?',
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
            message: `Type the cluster name "${selectedCluster.name}" to confirm deletion:`,
            validate: (input) => input === selectedCluster.name || 'Cluster name does not match'
          }
        ]);

        const deleteSpinner = ora(`Deleting cluster ${selectedCluster.name}...`).start();
        
        try {
          await mongodb.deleteCluster(selectedProject.id, selectedCluster.name);
          deleteSpinner.succeed(chalk.green(`Cluster ${selectedCluster.name} deleted successfully`));
        } catch (error: any) {
          deleteSpinner.fail('Failed to delete cluster');
          console.log(chalk.red(`Error: ${error.message}`));
        }
      } catch (error: any) {
        clustersSpinner.fail('Failed to load clusters');
        console.log(chalk.red(`Error: ${error.message}`));
      }
    } catch (error: any) {
      projectsSpinner.fail('Failed to load projects');
      console.log(chalk.red(`Error: ${error.message}`));
    }
  } catch (error: any) {
    spinner.fail('Failed to load organizations');
    console.log(chalk.red(`Error: ${error.message}`));
  }
}

async function viewClusterDetails(mongodb: MongoDBService): Promise<void> {
  // Implementation for viewing cluster details
  const spinner = ora('Loading organizations...').start();
  
  try {
    const organizations = await mongodb.getOrganizations();
    spinner.stop();
    
    if (organizations.length === 0) {
      console.log(chalk.yellow('📭 No organizations found'));
      return;
    }

    const { selectedOrg } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedOrg',
        message: 'Select an organization:',
        choices: organizations.map(org => ({
          name: `${org.name} (${org.id})`,
          value: org
        }))
      }
    ]);

    const projectsSpinner = ora('Loading projects...').start();
    
    try {
      const projects = await mongodb.getProjects(selectedOrg.id);
      projectsSpinner.stop();
      
      if (projects.length === 0) {
        console.log(chalk.yellow('📭 No projects found in this organization'));
        return;
      }

      const { selectedProject } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedProject',
          message: 'Select a project:',
          choices: projects.map(project => ({
            name: `${project.name} (${project.id})`,
            value: project
          }))
        }
      ]);

      const clustersSpinner = ora('Loading clusters...').start();
      
      try {
        const clusters = await mongodb.getClusters(selectedProject.id);
        clustersSpinner.stop();
        
        if (clusters.length === 0) {
          console.log(chalk.yellow('📭 No clusters found in this project'));
          return;
        }

        const { selectedCluster } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedCluster',
            message: 'Select a cluster to view details:',
            choices: clusters.map(cluster => ({
              name: `${cluster.name} (${cluster.stateName})`,
              value: cluster
            }))
          }
        ]);

        console.log(chalk.blue(`\n📋 Cluster Details: ${selectedCluster.name}\n`));
        console.log(chalk.gray(`State: ${selectedCluster.stateName}`));
        console.log(chalk.gray(`Provider: ${selectedCluster.providerSettings?.providerName || 'N/A'}`));
        console.log(chalk.gray(`Instance Size: ${selectedCluster.providerSettings?.instanceSizeName || 'N/A'}`));
        console.log(chalk.gray(`Region: ${selectedCluster.providerSettings?.regionName || 'N/A'}`));
        console.log(chalk.gray(`MongoDB Version: ${selectedCluster.mongoDBVersion || 'N/A'}`));
        console.log(chalk.gray(`Created: ${new Date(selectedCluster.createDate).toLocaleDateString()}`));
        
        if (selectedCluster.connectionStrings) {
          console.log(chalk.blue(`\n🔗 Connection Strings:\n`));
          if (selectedCluster.connectionStrings.standard) {
            console.log(chalk.gray(`Standard: ${selectedCluster.connectionStrings.standard}`));
          }
          if (selectedCluster.connectionStrings.standardSrv) {
            console.log(chalk.gray(`Standard SRV: ${selectedCluster.connectionStrings.standardSrv}`));
          }
        }
      } catch (error: any) {
        clustersSpinner.fail('Failed to load clusters');
        console.log(chalk.red(`Error: ${error.message}`));
      }
    } catch (error: any) {
      projectsSpinner.fail('Failed to load projects');
      console.log(chalk.red(`Error: ${error.message}`));
    }
  } catch (error: any) {
    spinner.fail('Failed to load organizations');
    console.log(chalk.red(`Error: ${error.message}`));
  }
}