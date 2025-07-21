import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { MongoDBService } from '../services/mongodb.js';

export async function bulkDeleteTestProjects(mongodb: MongoDBService): Promise<void> {
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
        message: 'Select an organization to bulk delete test projects from:',
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

      const testProjects = projects.filter(project => project.name.toLowerCase().startsWith('test-'));
      
      if (testProjects.length === 0) {
        console.log(chalk.yellow('📭 No projects found with names starting with "test-" (case-insensitive)'));
        return;
      }

      console.log(chalk.blue(`\n🔍 Found ${testProjects.length} projects with names starting with "test-" (case-insensitive):\n`));
      
      testProjects.forEach((project, index) => {
        console.log(chalk.yellow(`${index + 1}. ${project.name}`));
        console.log(chalk.gray(`   ID: ${project.id}`));
        console.log(chalk.gray(`   Created: ${new Date(project.created).toLocaleDateString()}`));
        console.log();
      });

      console.log(chalk.red(`⚠️  DANGER: You are about to delete ${testProjects.length} projects!`));
      console.log(chalk.red(`This action cannot be undone!`));
      console.log(chalk.red(`ALL clusters (regardless of name), databases, and data in these projects will be permanently lost!`));

      const { confirmBulkDelete } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmBulkDelete',
          message: `Are you absolutely sure you want to delete all ${testProjects.length} projects starting with "test-" (case-insensitive)?`,
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
          message: 'Type "DELETE ALL TEST PROJECTS" to confirm:',
          validate: (input) => input === 'DELETE ALL TEST PROJECTS' || 'Please type exactly "DELETE ALL TEST PROJECTS"'
        }
      ]);

      const deleteSpinner = ora(`Preparing to delete ${testProjects.length} test projects and all their clusters...`).start();
      
      try {
        let deletedProjectCount = 0;
        let deletedClusterCount = 0;
        let errorCount = 0;
        
        for (const project of testProjects) {
          try {
            deleteSpinner.text = `Checking clusters in ${project.name}...`;
            
            // First, get all clusters in this project
            const clusters = await mongodb.getClusters(project.id);
            
            // Delete ALL clusters in test projects (since we're deleting the entire project)
            if (clusters.length > 0) {
              deleteSpinner.text = `Deleting ${clusters.length} clusters in ${project.name}...`;
              
              let clusterErrorsInProject = 0;
              for (const cluster of clusters) {
                try {
                  await mongodb.deleteCluster(project.id, cluster.name);
                  deletedClusterCount++;
                  deleteSpinner.text = `Deleted ${deletedClusterCount} clusters, processing ${project.name}...`;
                } catch (clusterError: any) {
                  clusterErrorsInProject++;
                  console.log(chalk.yellow(`\nFailed to delete cluster ${cluster.name}: ${clusterError.message}`));
                }
              }
              
              // If any cluster deletion failed, skip this project
              if (clusterErrorsInProject > 0) {
                console.log(chalk.yellow(`\nSkipping project ${project.name}: ${clusterErrorsInProject} clusters could not be deleted`));
                continue;
              }
              
              // Wait for cluster deletions to complete and verify
              deleteSpinner.text = `Waiting for cluster deletions to complete in ${project.name}...`;
              let retryCount = 0;
              const maxRetries = 12; // 2 minutes max wait
              
              while (retryCount < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
                
                try {
                  const remainingClusters = await mongodb.getClusters(project.id);
                  if (remainingClusters.length === 0) {
                    break; // All clusters deleted
                  }
                  retryCount++;
                  deleteSpinner.text = `Waiting for ${remainingClusters.length} clusters to finish deletion in ${project.name}... (${retryCount}/${maxRetries})`;
                } catch (checkError: any) {
                  // If we can't check clusters, assume they might still be there
                  retryCount++;
                  deleteSpinner.text = `Waiting for cluster deletion confirmation in ${project.name}... (${retryCount}/${maxRetries})`;
                }
              }
              
              // Final check - if clusters still exist after max retries, skip project
              try {
                const finalCheck = await mongodb.getClusters(project.id);
                if (finalCheck.length > 0) {
                  console.log(chalk.yellow(`\nSkipping project ${project.name}: ${finalCheck.length} clusters still active after waiting`));
                  continue;
                }
              } catch (finalCheckError: any) {
                // If we can't verify, proceed cautiously
                console.log(chalk.yellow(`\nWarning: Could not verify cluster deletion for ${project.name}, attempting project deletion...`));
              }
            }
            
            // Now delete the project
            deleteSpinner.text = `Deleting project ${project.name}...`;
            await mongodb.deleteProject(project.id);
            deletedProjectCount++;
            deleteSpinner.text = `Deleted ${deletedProjectCount}/${testProjects.length} projects, ${deletedClusterCount} clusters...`;
            
          } catch (error: any) {
            errorCount++;
            console.log(chalk.red(`\nFailed to delete ${project.name}: ${error.message}`));
          }
        }
        
        deleteSpinner.stop();
        
        if (deletedProjectCount > 0) {
          console.log(chalk.green(`✅ Successfully deleted ${deletedProjectCount} test projects`));
        }
        if (deletedClusterCount > 0) {
          console.log(chalk.green(`✅ Successfully deleted ${deletedClusterCount} test clusters`));
        }
        if (errorCount > 0) {
          console.log(chalk.red(`❌ Failed to delete ${errorCount} projects`));
        }
      } catch (error: any) {
        deleteSpinner.fail('Bulk delete failed');
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

export async function bulkDeleteTestClusters(mongodb: MongoDBService): Promise<void> {
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
          message: 'Select a project to bulk delete test clusters from:',
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

        const testClusters = clusters.filter(cluster => cluster.name.toLowerCase().startsWith('test-'));
        
        if (testClusters.length === 0) {
          console.log(chalk.yellow('📭 No clusters found with names starting with "test-" (case-insensitive)'));
          return;
        }

        console.log(chalk.blue(`\n🔍 Found ${testClusters.length} clusters with names starting with "test-" (case-insensitive):\n`));
        
        testClusters.forEach((cluster, index) => {
          console.log(chalk.yellow(`${index + 1}. ${cluster.name}`));
          console.log(chalk.gray(`   State: ${cluster.stateName}`));
          console.log(chalk.gray(`   Provider: ${cluster.providerSettings?.providerName || 'N/A'}`));
          console.log(chalk.gray(`   Created: ${new Date(cluster.createDate).toLocaleDateString()}`));
          console.log();
        });

        console.log(chalk.red(`⚠️  DANGER: You are about to delete ${testClusters.length} clusters!`));
        console.log(chalk.red(`This action cannot be undone!`));
        console.log(chalk.red(`All databases and data will be permanently lost!`));

        const { confirmBulkDelete } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmBulkDelete',
            message: `Are you absolutely sure you want to delete all ${testClusters.length} clusters starting with "test-" (case-insensitive)?`,
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
            message: 'Type "DELETE ALL TEST CLUSTERS" to confirm:',
            validate: (input) => input === 'DELETE ALL TEST CLUSTERS' || 'Please type exactly "DELETE ALL TEST CLUSTERS"'
          }
        ]);

        const deleteSpinner = ora(`Deleting ${testClusters.length} test clusters...`).start();
        
        try {
          let deletedCount = 0;
          let errorCount = 0;
          
          for (const cluster of testClusters) {
            try {
              await mongodb.deleteCluster(selectedProject.id, cluster.name);
              deletedCount++;
              deleteSpinner.text = `Deleted ${deletedCount}/${testClusters.length} clusters...`;
            } catch (error: any) {
              errorCount++;
              console.log(chalk.red(`\nFailed to delete ${cluster.name}: ${error.message}`));
            }
          }
          
          deleteSpinner.stop();
          
          if (deletedCount > 0) {
            console.log(chalk.green(`✅ Successfully deleted ${deletedCount} test clusters`));
          }
          if (errorCount > 0) {
            console.log(chalk.red(`❌ Failed to delete ${errorCount} clusters`));
          }
        } catch (error: any) {
          deleteSpinner.fail('Bulk delete failed');
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