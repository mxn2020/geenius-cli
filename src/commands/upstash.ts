import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { UpstashService } from '../services/upstash.js';

export async function upstashCommand(returnToMain?: () => Promise<void>): Promise<void> {
  console.log(chalk.green.bold('\n🟢 Upstash Resource Management'));
  console.log(chalk.gray('Manage your Upstash Redis, QStash, Vector, Workflow, and Search resources'));
  console.log();

  if (!process.env.UPSTASH_EMAIL || !process.env.UPSTASH_API_KEY) {
    console.log(chalk.red('❌ UPSTASH_EMAIL and UPSTASH_API_KEY environment variables are required'));
    console.log(chalk.gray('Please set your Upstash credentials in your environment variables'));
    return;
  }

  const { service } = await inquirer.prompt([
    {
      type: 'list',
      name: 'service',
      message: 'Which Upstash service would you like to manage?',
      choices: [
        { name: '🔴 Redis Databases', value: 'redis' },
        { name: '📮 QStash (Message Queue)', value: 'qstash' },
        { name: '🔍 Vector Databases', value: 'vector' },
        { name: '⚡ Workflows', value: 'workflow' },
        { name: '🔎 Search Indexes', value: 'search' },
        { name: '🔙 Back to main menu', value: 'back' }
      ]
    }
  ]);

  if (service === 'back') {
    if (returnToMain) {
      console.clear();
      return;
    }
    return;
  }

  const upstash = new UpstashService();

  switch (service) {
    case 'redis':
      await manageRedis(upstash, returnToMain);
      break;
    case 'qstash':
      await manageQStash(upstash, returnToMain);
      break;
    case 'vector':
      await manageVector(upstash, returnToMain);
      break;
    case 'workflow':
      await manageWorkflow(upstash, returnToMain);
      break;
    case 'search':
      await manageSearch(upstash, returnToMain);
      break;
  }
}

async function manageRedis(upstash: UpstashService, returnToMain?: () => Promise<void>) {
  console.log(chalk.red.bold('\n🔴 Redis Database Management'));
  
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do with Redis?',
      choices: [
        { name: '📋 List all databases', value: 'list' },
        { name: '➕ Create database', value: 'create' },
        { name: '🗑️  Delete database', value: 'delete' },
        { name: '🧹 Bulk delete test- databases', value: 'bulk-delete' },
        { name: '🔍 View database details', value: 'details' },
        { name: '🔑 Reset database password', value: 'reset-password' },
        { name: '🔙 Back to Upstash menu', value: 'back' }
      ]
    }
  ]);

  if (action === 'back') {
    return upstashCommand(returnToMain);
  }

  switch (action) {
    case 'list':
      await listRedisDatabases(upstash);
      break;
    case 'create':
      await createRedisDatabase(upstash);
      break;
    case 'delete':
      await deleteRedisDatabase(upstash);
      break;
    case 'bulk-delete':
      await bulkDeleteTestRedisDatabases(upstash);
      break;
    case 'details':
      await showRedisDatabaseDetails(upstash);
      break;
    case 'reset-password':
      await resetRedisDatabasePassword(upstash);
      break;
  }

  await promptToContinue(upstash, returnToMain, 'redis');
}

async function manageQStash(upstash: UpstashService, returnToMain?: () => Promise<void>) {
  console.log(chalk.yellow.bold('\n📮 QStash Management'));
  
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do with QStash?',
      choices: [
        { name: '📋 List topics', value: 'list-topics' },
        { name: '➕ Create topic', value: 'create-topic' },
        { name: '🗑️  Delete topic', value: 'delete-topic' },
        { name: '📨 View messages', value: 'view-messages' },
        { name: '🔙 Back to Upstash menu', value: 'back' }
      ]
    }
  ]);

  if (action === 'back') {
    return upstashCommand(returnToMain);
  }

  switch (action) {
    case 'list-topics':
      await listQStashTopics(upstash);
      break;
    case 'create-topic':
      await createQStashTopic(upstash);
      break;
    case 'delete-topic':
      await deleteQStashTopic(upstash);
      break;
    case 'view-messages':
      await viewQStashMessages(upstash);
      break;
  }

  await promptToContinue(upstash, returnToMain, 'qstash');
}

async function manageVector(upstash: UpstashService, returnToMain?: () => Promise<void>) {
  console.log(chalk.magenta.bold('\n🔍 Vector Database Management'));
  
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do with Vector databases?',
      choices: [
        { name: '📋 List indexes', value: 'list' },
        { name: '➕ Create index', value: 'create' },
        { name: '🗑️  Delete index', value: 'delete' },
        { name: '🔍 View index details', value: 'details' },
        { name: '🔙 Back to Upstash menu', value: 'back' }
      ]
    }
  ]);

  if (action === 'back') {
    return upstashCommand(returnToMain);
  }

  switch (action) {
    case 'list':
      await listVectorIndexes(upstash);
      break;
    case 'create':
      await createVectorIndex(upstash);
      break;
    case 'delete':
      await deleteVectorIndex(upstash);
      break;
    case 'details':
      await showVectorIndexDetails(upstash);
      break;
  }

  await promptToContinue(upstash, returnToMain, 'vector');
}

async function manageWorkflow(upstash: UpstashService, returnToMain?: () => Promise<void>) {
  console.log(chalk.cyan.bold('\n⚡ Workflow Management'));
  
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do with Workflows?',
      choices: [
        { name: '📋 List workflows', value: 'list' },
        { name: '🗑️  Delete workflow', value: 'delete' },
        { name: '🔍 View workflow details', value: 'details' },
        { name: '🔙 Back to Upstash menu', value: 'back' }
      ]
    }
  ]);

  if (action === 'back') {
    return upstashCommand(returnToMain);
  }

  switch (action) {
    case 'list':
      await listWorkflows(upstash);
      break;
    case 'delete':
      await deleteWorkflow(upstash);
      break;
    case 'details':
      await showWorkflowDetails(upstash);
      break;
  }

  await promptToContinue(upstash, returnToMain, 'workflow');
}

async function manageSearch(upstash: UpstashService, returnToMain?: () => Promise<void>) {
  console.log(chalk.blue.bold('\n🔎 Search Index Management'));
  
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do with Search indexes?',
      choices: [
        { name: '📋 List indexes', value: 'list' },
        { name: '➕ Create index', value: 'create' },
        { name: '🗑️  Delete index', value: 'delete' },
        { name: '🔍 View index details', value: 'details' },
        { name: '🔙 Back to Upstash menu', value: 'back' }
      ]
    }
  ]);

  if (action === 'back') {
    return upstashCommand(returnToMain);
  }

  switch (action) {
    case 'list':
      await listSearchIndexes(upstash);
      break;
    case 'create':
      await createSearchIndex(upstash);
      break;
    case 'delete':
      await deleteSearchIndex(upstash);
      break;
    case 'details':
      await showSearchIndexDetails(upstash);
      break;
  }

  await promptToContinue(upstash, returnToMain, 'search');
}

// Redis Operations
async function listRedisDatabases(upstash: UpstashService) {
  const spinner = ora('Fetching Redis databases...').start();
  
  try {
    const databases = await upstash.listRedisDatabases();
    spinner.stop();
    
    if (databases.length === 0) {
      console.log(chalk.yellow('📭 No Redis databases found'));
      return;
    }

    console.log(chalk.green.bold(`\n📋 Redis Databases (${databases.length})`));
    databases.forEach((db: any) => {
      console.log(chalk.cyan(`\n🔴 ${db.database_name || 'Unnamed'}`));
      console.log(`   ID: ${db.database_id}`);
      console.log(`   Region: ${db.region}`);
      console.log(`   State: ${db.state}`);
      console.log(`   Type: ${db.database_type}`);
      console.log(`   Endpoint: ${db.endpoint}`);
      console.log(`   Created: ${new Date(db.creation_time).toLocaleString()}`);
    });
  } catch (error: any) {
    spinner.stop();
    console.log(chalk.red(`❌ Error: ${error.message}`));
  }
}

async function createRedisDatabase(upstash: UpstashService) {
  const { name, region, tls } = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Enter database name:',
      validate: (input) => input.length > 0 || 'Database name is required'
    },
    {
      type: 'list',
      name: 'region',
      message: 'Select region:',
      choices: [
        { name: 'US East (N. Virginia)', value: 'us-east-1' },
        { name: 'US West (Oregon)', value: 'us-west-2' },
        { name: 'Europe (Ireland)', value: 'eu-west-1' },
        { name: 'Asia Pacific (Singapore)', value: 'ap-southeast-1' }
      ]
    },
    {
      type: 'confirm',
      name: 'tls',
      message: 'Enable TLS encryption?',
      default: true
    }
  ]);

  const spinner = ora(`Creating Redis database: ${name}...`).start();
  
  try {
    const database = await upstash.createRedisDatabase(name, region, tls);
    spinner.stop();
    
    console.log(chalk.green.bold('\n✅ Redis Database Created Successfully!'));
    console.log(chalk.cyan(`🔴 ${database.database_name}`));
    console.log(`   ID: ${database.database_id}`);
    console.log(`   Endpoint: ${database.endpoint}`);
    console.log(`   Region: ${database.region}`);
    console.log(`   REST Token: ${database.rest_token?.substring(0, 20)}...`);
  } catch (error: any) {
    spinner.stop();
    console.log(chalk.red(`❌ Error: ${error.message}`));
  }
}

async function deleteRedisDatabase(upstash: UpstashService) {
  const spinner = ora('Loading databases...').start();
  
  try {
    const databases = await upstash.listRedisDatabases();
    spinner.stop();
    
    if (databases.length === 0) {
      console.log(chalk.yellow('📭 No databases found'));
      return;
    }

    const { databaseId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'databaseId',
        message: 'Select database to delete:',
        choices: databases.map((db: any) => ({
          name: `${db.database_name} (${db.database_id}) - ${db.region}`,
          value: db.database_id
        }))
      }
    ]);

    const selectedDb = databases.find((db: any) => db.database_id === databaseId);
    
    console.log(chalk.red.bold('\n⚠️  Database Deletion Confirmation'));
    console.log(chalk.red(`You are about to delete: ${selectedDb.database_name}`));
    console.log(chalk.red(`Database ID: ${selectedDb.database_id}`));
    console.log(chalk.red('This action cannot be undone!'));
    
    const { confirmation } = await inquirer.prompt([
      {
        type: 'input',
        name: 'confirmation',
        message: `Type "${selectedDb.database_name}" to confirm deletion:`,
        validate: (input) => input === selectedDb.database_name || 'Database name does not match'
      }
    ]);

    const deleteSpinner = ora(`Deleting database: ${selectedDb.database_name}...`).start();
    
    await upstash.deleteRedisDatabase(databaseId);
    deleteSpinner.stop();
    
    console.log(chalk.green.bold('\n✅ Database deleted successfully!'));
  } catch (error: any) {
    spinner.stop();
    console.log(chalk.red(`❌ Error: ${error.message}`));
  }
}

async function showRedisDatabaseDetails(upstash: UpstashService) {
  const spinner = ora('Loading databases...').start();
  
  try {
    const databases = await upstash.listRedisDatabases();
    spinner.stop();
    
    if (databases.length === 0) {
      console.log(chalk.yellow('📭 No databases found'));
      return;
    }

    const { databaseId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'databaseId',
        message: 'Select database to view details:',
        choices: databases.map((db: any) => ({
          name: `${db.database_name} (${db.database_id})`,
          value: db.database_id
        }))
      }
    ]);

    const detailSpinner = ora('Loading database details...').start();
    const database = await upstash.getRedisDatabase(databaseId);
    detailSpinner.stop();
    
    console.log(chalk.green.bold('\n🔍 Database Details'));
    console.log(chalk.cyan(`🔴 ${database.database_name}`));
    console.log(`   ID: ${database.database_id}`);
    console.log(`   Type: ${database.database_type}`);
    console.log(`   Region: ${database.region}`);
    console.log(`   Port: ${database.port}`);
    console.log(`   State: ${database.state}`);
    console.log(`   Endpoint: ${database.endpoint}`);
    console.log(`   REST Token: ${database.rest_token?.substring(0, 30)}...`);
    console.log(`   Read-Only Token: ${database.read_only_rest_token?.substring(0, 30)}...`);
    console.log(`   Created: ${new Date(database.creation_time).toLocaleString()}`);
  } catch (error: any) {
    spinner.stop();
    console.log(chalk.red(`❌ Error: ${error.message}`));
  }
}

async function resetRedisDatabasePassword(upstash: UpstashService) {
  const spinner = ora('Loading databases...').start();
  
  try {
    const databases = await upstash.listRedisDatabases();
    spinner.stop();
    
    if (databases.length === 0) {
      console.log(chalk.yellow('📭 No databases found'));
      return;
    }

    const { databaseId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'databaseId',
        message: 'Select database to reset password:',
        choices: databases.map((db: any) => ({
          name: `${db.database_name} (${db.database_id})`,
          value: db.database_id
        }))
      }
    ]);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Reset database password? This will invalidate the current password.',
        default: false
      }
    ]);

    if (!confirm) return;

    const resetSpinner = ora('Resetting database password...').start();
    const result = await upstash.resetRedisDatabasePassword(databaseId);
    resetSpinner.stop();
    
    console.log(chalk.green.bold('\n✅ Password reset successfully!'));
    console.log(`   New password: ${result.password}`);
    console.log(chalk.yellow('⚠️  Please update your applications with the new password'));
  } catch (error: any) {
    spinner.stop();
    console.log(chalk.red(`❌ Error: ${error.message}`));
  }
}

// QStash Operations
async function listQStashTopics(upstash: UpstashService) {
  const spinner = ora('Fetching QStash topics...').start();
  
  try {
    const topics = await upstash.listQStashTopics();
    spinner.stop();
    
    if (topics.length === 0) {
      console.log(chalk.yellow('📭 No QStash topics found'));
      return;
    }

    console.log(chalk.green.bold(`\n📋 QStash Topics (${topics.length})`));
    topics.forEach((topic: any) => {
      console.log(chalk.cyan(`\n📮 ${topic.name}`));
      console.log(`   Endpoints: ${topic.endpoints?.length || 0}`);
      if (topic.endpoints?.length > 0) {
        topic.endpoints.forEach((endpoint: string, index: number) => {
          console.log(`     ${index + 1}. ${endpoint}`);
        });
      }
    });
  } catch (error: any) {
    spinner.stop();
    console.log(chalk.red(`❌ Error: ${error.message}`));
  }
}

async function createQStashTopic(upstash: UpstashService) {
  const { name, endpoints } = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Enter topic name:',
      validate: (input) => input.length > 0 || 'Topic name is required'
    },
    {
      type: 'input',
      name: 'endpoints',
      message: 'Enter endpoints (comma-separated URLs):',
      validate: (input) => input.length > 0 || 'At least one endpoint is required'
    }
  ]);

  const endpointList = endpoints.split(',').map((url: string) => url.trim());

  const spinner = ora(`Creating QStash topic: ${name}...`).start();
  
  try {
    const topic = await upstash.createQStashTopic(name, endpointList);
    spinner.stop();
    
    console.log(chalk.green.bold('\n✅ QStash Topic Created Successfully!'));
    console.log(chalk.cyan(`📮 ${topic.name}`));
    console.log(`   Endpoints: ${endpointList.length}`);
    endpointList.forEach((endpoint, index) => {
      console.log(`     ${index + 1}. ${endpoint}`);
    });
  } catch (error: any) {
    spinner.stop();
    console.log(chalk.red(`❌ Error: ${error.message}`));
  }
}

async function deleteQStashTopic(upstash: UpstashService) {
  const spinner = ora('Loading topics...').start();
  
  try {
    const topics = await upstash.listQStashTopics();
    spinner.stop();
    
    if (topics.length === 0) {
      console.log(chalk.yellow('📭 No topics found'));
      return;
    }

    const { topicName } = await inquirer.prompt([
      {
        type: 'list',
        name: 'topicName',
        message: 'Select topic to delete:',
        choices: topics.map((topic: any) => ({
          name: `${topic.name} (${topic.endpoints?.length || 0} endpoints)`,
          value: topic.name
        }))
      }
    ]);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Delete topic "${topicName}"? This action cannot be undone.`,
        default: false
      }
    ]);

    if (!confirm) return;

    const deleteSpinner = ora(`Deleting topic: ${topicName}...`).start();
    await upstash.deleteQStashTopic(topicName);
    deleteSpinner.stop();
    
    console.log(chalk.green.bold('\n✅ Topic deleted successfully!'));
  } catch (error: any) {
    spinner.stop();
    console.log(chalk.red(`❌ Error: ${error.message}`));
  }
}

async function viewQStashMessages(upstash: UpstashService) {
  const spinner = ora('Fetching QStash messages...').start();
  
  try {
    const messages = await upstash.getQStashMessages();
    spinner.stop();
    
    if (messages.length === 0) {
      console.log(chalk.yellow('📭 No messages found'));
      return;
    }

    console.log(chalk.green.bold(`\n📋 QStash Messages (${messages.length})`));
    messages.slice(0, 10).forEach((message: any, index: number) => {
      console.log(chalk.cyan(`\n📨 Message ${index + 1}`));
      console.log(`   ID: ${message.messageId || 'N/A'}`);
      console.log(`   URL: ${message.url || 'N/A'}`);
      console.log(`   State: ${message.state || 'N/A'}`);
      console.log(`   Created: ${message.createdAt ? new Date(message.createdAt).toLocaleString() : 'N/A'}`);
    });
    
    if (messages.length > 10) {
      console.log(chalk.gray(`\n... and ${messages.length - 10} more messages`));
    }
  } catch (error: any) {
    spinner.stop();
    console.log(chalk.red(`❌ Error: ${error.message}`));
  }
}

// Vector Operations
async function listVectorIndexes(upstash: UpstashService) {
  const spinner = ora('Fetching Vector indexes...').start();
  
  try {
    const indexes = await upstash.listVectorIndexes();
    spinner.stop();
    
    if (indexes.length === 0) {
      console.log(chalk.yellow('📭 No Vector indexes found'));
      return;
    }

    console.log(chalk.green.bold(`\n📋 Vector Indexes (${indexes.length})`));
    indexes.forEach((index: any) => {
      console.log(chalk.cyan(`\n🔍 ${index.name}`));
      console.log(`   ID: ${index.id}`);
      console.log(`   Dimension: ${index.dimension}`);
      console.log(`   Similarity Function: ${index.similarity_function}`);
      console.log(`   Created: ${new Date(index.creation_time).toLocaleString()}`);
    });
  } catch (error: any) {
    spinner.stop();
    console.log(chalk.red(`❌ Error: ${error.message}`));
  }
}

async function createVectorIndex(upstash: UpstashService) {
  const { name, dimension, similarityFunction, region } = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Enter index name:',
      validate: (input) => input.length > 0 || 'Index name is required'
    },
    {
      type: 'number',
      name: 'dimension',
      message: 'Enter vector dimension:',
      validate: (input) => input > 0 || 'Dimension must be a positive number'
    },
    {
      type: 'list',
      name: 'similarityFunction',
      message: 'Select similarity function:',
      choices: [
        { name: 'Cosine', value: 'cosine' },
        { name: 'Euclidean', value: 'euclidean' },
        { name: 'Dot Product', value: 'dotProduct' }
      ]
    },
    {
      type: 'list',
      name: 'region',
      message: 'Select region:',
      choices: [
        { name: 'US East (N. Virginia)', value: 'us-east-1' },
        { name: 'US West (Oregon)', value: 'us-west-2' },
        { name: 'Europe (Ireland)', value: 'eu-west-1' }
      ]
    }
  ]);

  const spinner = ora(`Creating Vector index: ${name}...`).start();
  
  try {
    const index = await upstash.createVectorIndex(name, dimension, similarityFunction, region);
    spinner.stop();
    
    console.log(chalk.green.bold('\n✅ Vector Index Created Successfully!'));
    console.log(chalk.cyan(`🔍 ${index.name}`));
    console.log(`   ID: ${index.id}`);
    console.log(`   Dimension: ${index.dimension}`);
    console.log(`   Similarity Function: ${index.similarity_function}`);
    console.log(`   Region: ${region}`);
  } catch (error: any) {
    spinner.stop();
    console.log(chalk.red(`❌ Error: ${error.message}`));
  }
}

async function deleteVectorIndex(upstash: UpstashService) {
  const spinner = ora('Loading indexes...').start();
  
  try {
    const indexes = await upstash.listVectorIndexes();
    spinner.stop();
    
    if (indexes.length === 0) {
      console.log(chalk.yellow('📭 No indexes found'));
      return;
    }

    const { indexId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'indexId',
        message: 'Select index to delete:',
        choices: indexes.map((index: any) => ({
          name: `${index.name} (${index.id}) - ${index.dimension}D`,
          value: index.id
        }))
      }
    ]);

    const selectedIndex = indexes.find((index: any) => index.id === indexId);
    
    const { confirmation } = await inquirer.prompt([
      {
        type: 'input',
        name: 'confirmation',
        message: `Type "${selectedIndex.name}" to confirm deletion:`,
        validate: (input) => input === selectedIndex.name || 'Index name does not match'
      }
    ]);

    const deleteSpinner = ora(`Deleting index: ${selectedIndex.name}...`).start();
    await upstash.deleteVectorIndex(indexId);
    deleteSpinner.stop();
    
    console.log(chalk.green.bold('\n✅ Vector index deleted successfully!'));
  } catch (error: any) {
    spinner.stop();
    console.log(chalk.red(`❌ Error: ${error.message}`));
  }
}

async function showVectorIndexDetails(upstash: UpstashService) {
  const spinner = ora('Loading indexes...').start();
  
  try {
    const indexes = await upstash.listVectorIndexes();
    spinner.stop();
    
    if (indexes.length === 0) {
      console.log(chalk.yellow('📭 No indexes found'));
      return;
    }

    const { indexId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'indexId',
        message: 'Select index to view details:',
        choices: indexes.map((index: any) => ({
          name: `${index.name} (${index.id})`,
          value: index.id
        }))
      }
    ]);

    const detailSpinner = ora('Loading index details...').start();
    const index = await upstash.getVectorIndex(indexId);
    detailSpinner.stop();
    
    console.log(chalk.green.bold('\n🔍 Vector Index Details'));
    console.log(chalk.cyan(`🔍 ${index.name}`));
    console.log(`   ID: ${index.id}`);
    console.log(`   Dimension: ${index.dimension}`);
    console.log(`   Similarity Function: ${index.similarity_function}`);
    console.log(`   Created: ${new Date(index.creation_time).toLocaleString()}`);
  } catch (error: any) {
    spinner.stop();
    console.log(chalk.red(`❌ Error: ${error.message}`));
  }
}

// Workflow Operations
async function listWorkflows(upstash: UpstashService) {
  const spinner = ora('Fetching Workflows...').start();
  
  try {
    const workflows = await upstash.listWorkflows();
    spinner.stop();
    
    if (workflows.length === 0) {
      console.log(chalk.yellow('📭 No Workflows found'));
      return;
    }

    console.log(chalk.green.bold(`\n📋 Workflows (${workflows.length})`));
    workflows.forEach((workflow: any) => {
      console.log(chalk.cyan(`\n⚡ ${workflow.name}`));
      console.log(`   ID: ${workflow.id}`);
      console.log(`   Status: ${workflow.status || 'N/A'}`);
      console.log(`   Created: ${workflow.createdAt ? new Date(workflow.createdAt).toLocaleString() : 'N/A'}`);
    });
  } catch (error: any) {
    spinner.stop();
    console.log(chalk.red(`❌ Error: ${error.message}`));
  }
}

async function deleteWorkflow(upstash: UpstashService) {
  const spinner = ora('Loading workflows...').start();
  
  try {
    const workflows = await upstash.listWorkflows();
    spinner.stop();
    
    if (workflows.length === 0) {
      console.log(chalk.yellow('📭 No workflows found'));
      return;
    }

    const { workflowId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'workflowId',
        message: 'Select workflow to delete:',
        choices: workflows.map((workflow: any) => ({
          name: `${workflow.name} (${workflow.id})`,
          value: workflow.id
        }))
      }
    ]);

    const selectedWorkflow = workflows.find((workflow: any) => workflow.id === workflowId);
    
    const { confirmation } = await inquirer.prompt([
      {
        type: 'input',
        name: 'confirmation',
        message: `Type "${selectedWorkflow.name}" to confirm deletion:`,
        validate: (input) => input === selectedWorkflow.name || 'Workflow name does not match'
      }
    ]);

    const deleteSpinner = ora(`Deleting workflow: ${selectedWorkflow.name}...`).start();
    await upstash.deleteWorkflow(workflowId);
    deleteSpinner.stop();
    
    console.log(chalk.green.bold('\n✅ Workflow deleted successfully!'));
  } catch (error: any) {
    spinner.stop();
    console.log(chalk.red(`❌ Error: ${error.message}`));
  }
}

async function showWorkflowDetails(upstash: UpstashService) {
  const spinner = ora('Loading workflows...').start();
  
  try {
    const workflows = await upstash.listWorkflows();
    spinner.stop();
    
    if (workflows.length === 0) {
      console.log(chalk.yellow('📭 No workflows found'));
      return;
    }

    const { workflowId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'workflowId',
        message: 'Select workflow to view details:',
        choices: workflows.map((workflow: any) => ({
          name: `${workflow.name} (${workflow.id})`,
          value: workflow.id
        }))
      }
    ]);

    const detailSpinner = ora('Loading workflow details...').start();
    const workflow = await upstash.getWorkflow(workflowId);
    detailSpinner.stop();
    
    console.log(chalk.green.bold('\n🔍 Workflow Details'));
    console.log(chalk.cyan(`⚡ ${workflow.name}`));
    console.log(`   ID: ${workflow.id}`);
    console.log(`   Status: ${workflow.status || 'N/A'}`);
    console.log(`   Created: ${workflow.createdAt ? new Date(workflow.createdAt).toLocaleString() : 'N/A'}`);
    console.log(`   Definition: ${JSON.stringify(workflow.definition, null, 2)}`);
  } catch (error: any) {
    spinner.stop();
    console.log(chalk.red(`❌ Error: ${error.message}`));
  }
}

// Search Operations
async function listSearchIndexes(upstash: UpstashService) {
  const spinner = ora('Fetching Search indexes...').start();
  
  try {
    const indexes = await upstash.listSearchIndexes();
    spinner.stop();
    
    if (indexes.length === 0) {
      console.log(chalk.yellow('📭 No Search indexes found'));
      return;
    }

    console.log(chalk.green.bold(`\n📋 Search Indexes (${indexes.length})`));
    indexes.forEach((index: any) => {
      console.log(chalk.cyan(`\n🔎 ${index.name}`));
      console.log(`   ID: ${index.id}`);
      console.log(`   Region: ${index.region}`);
      console.log(`   Created: ${index.createdAt ? new Date(index.createdAt).toLocaleString() : 'N/A'}`);
    });
  } catch (error: any) {
    spinner.stop();
    console.log(chalk.red(`❌ Error: ${error.message}`));
  }
}

async function createSearchIndex(upstash: UpstashService) {
  const { name, region } = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Enter search index name:',
      validate: (input) => input.length > 0 || 'Index name is required'
    },
    {
      type: 'list',
      name: 'region',
      message: 'Select region:',
      choices: [
        { name: 'US East (N. Virginia)', value: 'us-east-1' },
        { name: 'US West (Oregon)', value: 'us-west-2' },
        { name: 'Europe (Ireland)', value: 'eu-west-1' }
      ]
    }
  ]);

  const spinner = ora(`Creating Search index: ${name}...`).start();
  
  try {
    const index = await upstash.createSearchIndex(name, region);
    spinner.stop();
    
    console.log(chalk.green.bold('\n✅ Search Index Created Successfully!'));
    console.log(chalk.cyan(`🔎 ${index.name}`));
    console.log(`   ID: ${index.id}`);
    console.log(`   Region: ${region}`);
  } catch (error: any) {
    spinner.stop();
    console.log(chalk.red(`❌ Error: ${error.message}`));
  }
}

async function deleteSearchIndex(upstash: UpstashService) {
  const spinner = ora('Loading indexes...').start();
  
  try {
    const indexes = await upstash.listSearchIndexes();
    spinner.stop();
    
    if (indexes.length === 0) {
      console.log(chalk.yellow('📭 No indexes found'));
      return;
    }

    const { indexId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'indexId',
        message: 'Select index to delete:',
        choices: indexes.map((index: any) => ({
          name: `${index.name} (${index.id})`,
          value: index.id
        }))
      }
    ]);

    const selectedIndex = indexes.find((index: any) => index.id === indexId);
    
    const { confirmation } = await inquirer.prompt([
      {
        type: 'input',
        name: 'confirmation',
        message: `Type "${selectedIndex.name}" to confirm deletion:`,
        validate: (input) => input === selectedIndex.name || 'Index name does not match'
      }
    ]);

    const deleteSpinner = ora(`Deleting index: ${selectedIndex.name}...`).start();
    await upstash.deleteSearchIndex(indexId);
    deleteSpinner.stop();
    
    console.log(chalk.green.bold('\n✅ Search index deleted successfully!'));
  } catch (error: any) {
    spinner.stop();
    console.log(chalk.red(`❌ Error: ${error.message}`));
  }
}

async function showSearchIndexDetails(upstash: UpstashService) {
  const spinner = ora('Loading indexes...').start();
  
  try {
    const indexes = await upstash.listSearchIndexes();
    spinner.stop();
    
    if (indexes.length === 0) {
      console.log(chalk.yellow('📭 No indexes found'));
      return;
    }

    const { indexId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'indexId',
        message: 'Select index to view details:',
        choices: indexes.map((index: any) => ({
          name: `${index.name} (${index.id})`,
          value: index.id
        }))
      }
    ]);

    const detailSpinner = ora('Loading index details...').start();
    const index = await upstash.getSearchIndex(indexId);
    detailSpinner.stop();
    
    console.log(chalk.green.bold('\n🔍 Search Index Details'));
    console.log(chalk.cyan(`🔎 ${index.name}`));
    console.log(`   ID: ${index.id}`);
    console.log(`   Region: ${index.region}`);
    console.log(`   Created: ${index.createdAt ? new Date(index.createdAt).toLocaleString() : 'N/A'}`);
  } catch (error: any) {
    spinner.stop();
    console.log(chalk.red(`❌ Error: ${error.message}`));
  }
}

// Utility function
async function promptToContinue(upstash: UpstashService, returnToMain?: () => Promise<void>, service?: string) {
  console.log();
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do next?',
      choices: [
        { name: '🔄 Continue with current service', value: 'continue' },
        { name: '🔙 Back to Upstash menu', value: 'upstash' },
        { name: '🏠 Return to main menu', value: 'main' }
      ]
    }
  ]);

  switch (action) {
    case 'continue':
      if (service === 'redis') await manageRedis(upstash, returnToMain);
      else if (service === 'qstash') await manageQStash(upstash, returnToMain);
      else if (service === 'vector') await manageVector(upstash, returnToMain);
      else if (service === 'workflow') await manageWorkflow(upstash, returnToMain);
      else if (service === 'search') await manageSearch(upstash, returnToMain);
      break;
    case 'upstash':
      await upstashCommand(returnToMain);
      break;
    case 'main':
      if (returnToMain) {
        await returnToMain();
      }
      break;
  }
}

async function bulkDeleteTestRedisDatabases(upstash: UpstashService) {
  const spinner = ora('Loading Redis databases...').start();
  
  try {
    const databases = await upstash.listRedisDatabases();
    spinner.stop();
    
    if (databases.length === 0) {
      console.log(chalk.yellow('📭 No databases found'));
      return;
    }

    const testDatabases = databases.filter((db: any) => db.database_name.toLowerCase().startsWith('test-'));
    
    if (testDatabases.length === 0) {
      console.log(chalk.yellow('📭 No databases found with names starting with "test-" (case-insensitive)'));
      return;
    }

    console.log(chalk.blue(`\n🔍 Found ${testDatabases.length} databases with names starting with "test-" (case-insensitive):\n`));
    
    testDatabases.forEach((db: any, index: number) => {
      console.log(chalk.yellow(`${index + 1}. ${db.database_name}`));
      console.log(chalk.gray(`   ID: ${db.database_id}`));
      console.log(chalk.gray(`   Region: ${db.region}`));
      console.log(chalk.gray(`   State: ${db.state}`));
      console.log();
    });

    console.log(chalk.red(`⚠️  DANGER: You are about to delete ${testDatabases.length} Redis databases!`));
    console.log(chalk.red(`This action cannot be undone!`));
    console.log(chalk.red(`All data will be permanently lost!`));

    const { confirmBulkDelete } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmBulkDelete',
        message: `Are you absolutely sure you want to delete all ${testDatabases.length} databases starting with "test-" (case-insensitive)?`,
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
        message: 'Type "DELETE ALL TEST DATABASES" to confirm:',
        validate: (input) => input === 'DELETE ALL TEST DATABASES' || 'Please type exactly "DELETE ALL TEST DATABASES"'
      }
    ]);

    const deleteSpinner = ora(`Deleting ${testDatabases.length} test databases...`).start();
    
    try {
      let deletedCount = 0;
      let errorCount = 0;
      
      for (const db of testDatabases) {
        try {
          await upstash.deleteRedisDatabase(db.database_id);
          deletedCount++;
          deleteSpinner.text = `Deleted ${deletedCount}/${testDatabases.length} databases...`;
        } catch (error: any) {
          errorCount++;
          console.log(chalk.red(`\nFailed to delete ${db.database_name}: ${error.message}`));
        }
      }
      
      deleteSpinner.stop();
      
      if (deletedCount > 0) {
        console.log(chalk.green(`✅ Successfully deleted ${deletedCount} test databases`));
      }
      if (errorCount > 0) {
        console.log(chalk.red(`❌ Failed to delete ${errorCount} databases`));
      }
    } catch (error: any) {
      deleteSpinner.fail('Bulk delete failed');
      console.log(chalk.red(`Error: ${error.message}`));
    }
  } catch (error: any) {
    spinner.fail('Failed to load databases');
    console.log(chalk.red(`Error: ${error.message}`));
  }
}