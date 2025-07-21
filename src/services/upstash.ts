// src/services/upstash.ts
import { logger } from '../utils/logger.js';

interface UpstashDatabase {
  database_id: string;
  database_name: string;
  database_type: string;
  region: string;
  port: number;
  creation_time: number;
  state: string;
  password: string;
  user_email: string;
  endpoint: string;
  rest_token: string;
  read_only_rest_token: string;
}

interface UpstashQStashTopic {
  name: string;
  endpoints: string[];
}

interface UpstashVectorIndex {
  id: string;
  name: string;
  dimension: number;
  similarity_function: string;
  creation_time: number;
}

export class UpstashService {
  private baseUrl = 'https://api.upstash.com';
  private email: string;
  private apiKey: string;

  constructor() {
    if (!process.env.UPSTASH_EMAIL || !process.env.UPSTASH_API_KEY) {
      throw new Error('UPSTASH_EMAIL and UPSTASH_API_KEY environment variables are required for Upstash integration. Please set them in your .env file.');
    }
    this.email = process.env.UPSTASH_EMAIL;
    this.apiKey = process.env.UPSTASH_API_KEY;
  }

  private async makeRequest(endpoint: string, method: 'GET' | 'POST' | 'DELETE' | 'PUT' = 'GET', body?: any) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Basic ${Buffer.from(`${this.email}:${this.apiKey}`).toString('base64')}`,
      'Content-Type': 'application/json',
    };

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upstash API error (${response.status}): ${errorText}`);
      }

      return await response.json();
    } catch (error: any) {
      logger.error('Upstash API request failed:', error);
      throw new Error(`Upstash request failed: ${error.message}`);
    }
  }

  // Redis Operations
  async listRedisDatabases() {
    try {
      logger.info('Fetching Redis databases from Upstash');
      const databases = await this.makeRequest('/v2/redis/database');
      return databases;
    } catch (error: any) {
      logger.error('Failed to list Redis databases:', error);
      throw new Error(`Failed to list Redis databases: ${error.message}`);
    }
  }

  async createRedisDatabase(name: string, region: string = 'us-east-1', tls: boolean = true) {
    try {
      logger.info(`Creating Redis database: ${name} in region ${region}`);
      const database = await this.makeRequest('/v2/redis/database', 'POST', {
        name,
        region,
        tls,
      });
      logger.info(`Redis database created successfully: ${database.database_id}`);
      return database;
    } catch (error: any) {
      logger.error('Failed to create Redis database:', error);
      throw new Error(`Failed to create Redis database: ${error.message}`);
    }
  }

  async deleteRedisDatabase(databaseId: string) {
    try {
      logger.info(`Deleting Redis database: ${databaseId}`);
      await this.makeRequest(`/v2/redis/database/${databaseId}`, 'DELETE');
      logger.info(`Redis database deleted successfully: ${databaseId}`);
      return { success: true, message: 'Redis database deleted successfully' };
    } catch (error: any) {
      logger.error('Failed to delete Redis database:', error);
      throw new Error(`Failed to delete Redis database: ${error.message}`);
    }
  }

  async getRedisDatabase(databaseId: string) {
    try {
      logger.info(`Fetching Redis database details: ${databaseId}`);
      const database = await this.makeRequest(`/v2/redis/database/${databaseId}`);
      return database;
    } catch (error: any) {
      logger.error('Failed to get Redis database:', error);
      throw new Error(`Failed to get Redis database: ${error.message}`);
    }
  }

  async resetRedisDatabasePassword(databaseId: string) {
    try {
      logger.info(`Resetting password for Redis database: ${databaseId}`);
      const result = await this.makeRequest(`/v2/redis/database/${databaseId}/reset-password`, 'POST');
      logger.info(`Redis database password reset successfully: ${databaseId}`);
      return result;
    } catch (error: any) {
      logger.error('Failed to reset Redis database password:', error);
      throw new Error(`Failed to reset Redis database password: ${error.message}`);
    }
  }

  // QStash Operations
  async listQStashTopics() {
    try {
      logger.info('Fetching QStash topics from Upstash');
      const topics = await this.makeRequest('/v2/qstash/topics');
      return topics;
    } catch (error: any) {
      logger.error('Failed to list QStash topics:', error);
      throw new Error(`Failed to list QStash topics: ${error.message}`);
    }
  }

  async createQStashTopic(name: string, endpoints: string[]) {
    try {
      logger.info(`Creating QStash topic: ${name}`);
      const topic = await this.makeRequest('/v2/qstash/topics', 'POST', {
        name,
        endpoints,
      });
      logger.info(`QStash topic created successfully: ${name}`);
      return topic;
    } catch (error: any) {
      logger.error('Failed to create QStash topic:', error);
      throw new Error(`Failed to create QStash topic: ${error.message}`);
    }
  }

  async deleteQStashTopic(topicName: string) {
    try {
      logger.info(`Deleting QStash topic: ${topicName}`);
      await this.makeRequest(`/v2/qstash/topics/${topicName}`, 'DELETE');
      logger.info(`QStash topic deleted successfully: ${topicName}`);
      return { success: true, message: 'QStash topic deleted successfully' };
    } catch (error: any) {
      logger.error('Failed to delete QStash topic:', error);
      throw new Error(`Failed to delete QStash topic: ${error.message}`);
    }
  }

  async getQStashMessages() {
    try {
      logger.info('Fetching QStash messages');
      const messages = await this.makeRequest('/v2/qstash/messages');
      return messages;
    } catch (error: any) {
      logger.error('Failed to get QStash messages:', error);
      throw new Error(`Failed to get QStash messages: ${error.message}`);
    }
  }

  // Vector Database Operations
  async listVectorIndexes() {
    try {
      logger.info('Fetching Vector indexes from Upstash');
      const indexes = await this.makeRequest('/v2/vector/index');
      return indexes;
    } catch (error: any) {
      logger.error('Failed to list Vector indexes:', error);
      throw new Error(`Failed to list Vector indexes: ${error.message}`);
    }
  }

  async createVectorIndex(name: string, dimension: number, similarityFunction: string = 'cosine', region: string = 'us-east-1') {
    try {
      logger.info(`Creating Vector index: ${name} with ${dimension} dimensions`);
      const index = await this.makeRequest('/v2/vector/index', 'POST', {
        name,
        dimension,
        similarity_function: similarityFunction,
        region,
      });
      logger.info(`Vector index created successfully: ${index.id}`);
      return index;
    } catch (error: any) {
      logger.error('Failed to create Vector index:', error);
      throw new Error(`Failed to create Vector index: ${error.message}`);
    }
  }

  async deleteVectorIndex(indexId: string) {
    try {
      logger.info(`Deleting Vector index: ${indexId}`);
      await this.makeRequest(`/v2/vector/index/${indexId}`, 'DELETE');
      logger.info(`Vector index deleted successfully: ${indexId}`);
      return { success: true, message: 'Vector index deleted successfully' };
    } catch (error: any) {
      logger.error('Failed to delete Vector index:', error);
      throw new Error(`Failed to delete Vector index: ${error.message}`);
    }
  }

  async getVectorIndex(indexId: string) {
    try {
      logger.info(`Fetching Vector index details: ${indexId}`);
      const index = await this.makeRequest(`/v2/vector/index/${indexId}`);
      return index;
    } catch (error: any) {
      logger.error('Failed to get Vector index:', error);
      throw new Error(`Failed to get Vector index: ${error.message}`);
    }
  }

  // Workflow Operations
  async listWorkflows() {
    try {
      logger.info('Fetching Workflows from Upstash');
      const workflows = await this.makeRequest('/v2/workflows');
      return workflows;
    } catch (error: any) {
      logger.error('Failed to list Workflows:', error);
      throw new Error(`Failed to list Workflows: ${error.message}`);
    }
  }

  async createWorkflow(name: string, definition: object) {
    try {
      logger.info(`Creating Workflow: ${name}`);
      const workflow = await this.makeRequest('/v2/workflows', 'POST', {
        name,
        definition,
      });
      logger.info(`Workflow created successfully: ${workflow.id}`);
      return workflow;
    } catch (error: any) {
      logger.error('Failed to create Workflow:', error);
      throw new Error(`Failed to create Workflow: ${error.message}`);
    }
  }

  async deleteWorkflow(workflowId: string) {
    try {
      logger.info(`Deleting Workflow: ${workflowId}`);
      await this.makeRequest(`/v2/workflows/${workflowId}`, 'DELETE');
      logger.info(`Workflow deleted successfully: ${workflowId}`);
      return { success: true, message: 'Workflow deleted successfully' };
    } catch (error: any) {
      logger.error('Failed to delete Workflow:', error);
      throw new Error(`Failed to delete Workflow: ${error.message}`);
    }
  }

  async getWorkflow(workflowId: string) {
    try {
      logger.info(`Fetching Workflow details: ${workflowId}`);
      const workflow = await this.makeRequest(`/v2/workflows/${workflowId}`);
      return workflow;
    } catch (error: any) {
      logger.error('Failed to get Workflow:', error);
      throw new Error(`Failed to get Workflow: ${error.message}`);
    }
  }

  // Search Operations  
  async listSearchIndexes() {
    try {
      logger.info('Fetching Search indexes from Upstash');
      const indexes = await this.makeRequest('/v2/search/index');
      return indexes;
    } catch (error: any) {
      logger.error('Failed to list Search indexes:', error);
      throw new Error(`Failed to list Search indexes: ${error.message}`);
    }
  }

  async createSearchIndex(name: string, region: string = 'us-east-1') {
    try {
      logger.info(`Creating Search index: ${name}`);
      const index = await this.makeRequest('/v2/search/index', 'POST', {
        name,
        region,
      });
      logger.info(`Search index created successfully: ${index.id}`);
      return index;
    } catch (error: any) {
      logger.error('Failed to create Search index:', error);
      throw new Error(`Failed to create Search index: ${error.message}`);
    }
  }

  async deleteSearchIndex(indexId: string) {
    try {
      logger.info(`Deleting Search index: ${indexId}`);
      await this.makeRequest(`/v2/search/index/${indexId}`, 'DELETE');
      logger.info(`Search index deleted successfully: ${indexId}`);
      return { success: true, message: 'Search index deleted successfully' };
    } catch (error: any) {
      logger.error('Failed to delete Search index:', error);
      throw new Error(`Failed to delete Search index: ${error.message}`);
    }
  }

  async getSearchIndex(indexId: string) {
    try {
      logger.info(`Fetching Search index details: ${indexId}`);
      const index = await this.makeRequest(`/v2/search/index/${indexId}`);
      return index;
    } catch (error: any) {
      logger.error('Failed to get Search index:', error);
      throw new Error(`Failed to get Search index: ${error.message}`);
    }
  }

  // Utility Methods
  async testConnection() {
    try {
      logger.info('Testing Upstash connection');
      await this.listRedisDatabases();
      logger.info('Upstash connection successful');
      return { success: true, message: 'Connection successful' };
    } catch (error: any) {
      logger.error('Upstash connection test failed:', error);
      throw new Error(`Connection test failed: ${error.message}`);
    }
  }

  async getAccountInfo() {
    try {
      logger.info('Fetching Upstash account information');
      const account = await this.makeRequest('/v2/account');
      return account;
    } catch (error: any) {
      logger.error('Failed to get account info:', error);
      throw new Error(`Failed to get account info: ${error.message}`);
    }
  }
}