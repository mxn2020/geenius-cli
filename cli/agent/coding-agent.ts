// src/agent/coding-agent.ts
import { SandboxAIService } from '../services/sandbox-ai-runner';
import { GitHubService } from '../services/github';
import { TestRunner } from '../services/test-runner';
import { StackBlitzService } from '../services/stackblitz';

interface AgentConfig {
  aiProvider: 'claude' | 'gemini' | 'openai';
  apiKey: string;
  model?: string;
  systemPrompt?: string;
}

export class CodingAgent {
  private github: GitHubService;
  private stackblitz: StackBlitzService;
  private testRunner: TestRunner;
  private sandboxAI: SandboxAIService;
  private project: any;
  private config: AgentConfig;

  constructor(repoUrl: string, config: AgentConfig) {
    this.github = new GitHubService();
    this.stackblitz = new StackBlitzService();
    this.testRunner = new TestRunner();
    this.config = config;
  }

  async initializeProject(repoUrl: string, branch: string = 'main'): Promise<void> {
    // Create StackBlitz project from GitHub repo
    this.project = await this.stackblitz.createFromGitHub(repoUrl, branch);
    
    // Initialize AI service in the sandbox
    this.sandboxAI = new SandboxAIService(this.project);
    
    // Setup AI provider in sandbox
    await this.sandboxAI.setupAI({
      provider: this.config.aiProvider,
      apiKey: this.config.apiKey,
      model: this.config.model
    });

    // Setup provider-specific configurations
    await this.setupProviderSpecificConfig();
  }

  private async setupProviderSpecificConfig(): Promise<void> {
    switch (this.config.aiProvider) {
      case 'claude':
        await this.setupClaudeSpecific();
        break;
      case 'gemini':
        await this.setupGeminiSpecific();
        break;
      case 'openai':
        await this.setupOpenAISpecific();
        break;
    }
  }

  private async setupClaudeSpecific(): Promise<void> {
    // Setup Claude Code project
    await this.sandboxAI.setupClaudeProject();
    
    // Create Claude-specific development scripts
    const claudeDevScript = `#!/bin/bash
echo "🤖 Starting Claude Code development session..."

# Initialize Claude Code in project
claude --project-path . --init-if-needed

# Run Claude with the provided prompt
claude "$@"
`;
    await this.stackblitz.writeFile(this.project, 'scripts/claude-dev.sh', claudeDevScript);
  }

  private async setupGeminiSpecific(): Promise<void> {
    // Create Gemini development workflow
    const geminiWorkflow = `#!/usr/bin/env node
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

async function developWithGemini(prompt) {
  const model = genAI.getGenerativeModel({ 
    model: process.env.GEMINI_MODEL || 'gemini-pro',
    systemInstruction: "${this.config.systemPrompt || 'You are a helpful coding assistant.'}"
  });

  // Get project context
  const projectContext = await getProjectContext();
  
  const fullPrompt = \`
Project Context:
\${projectContext}

Task: \${prompt}

Please provide a detailed implementation plan and code.
\`;

  const result = await model.generateContent(fullPrompt);
  const response = await result.response;
  return response.text();
}

async function getProjectContext() {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const fileList = getAllFiles('src').slice(0, 20); // Limit context
  
  return \`
Package.json: \${JSON.stringify(packageJson, null, 2)}
Files: \${fileList.join(', ')}
\`;
}

function getAllFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      files.push(...getAllFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Run if called directly
if (require.main === module) {
  const prompt = process.argv.slice(2).join(' ');
  developWithGemini(prompt)
    .then(console.log)
    .catch(console.error);
}

module.exports = { developWithGemini };
`;
    await this.stackblitz.writeFile(this.project, 'scripts/gemini-dev.js', geminiWorkflow);
  }

  private async setupOpenAISpecific(): Promise<void> {
    // OpenAI specific setup
    const openaiWorkflow = `#!/usr/bin/env node
require('dotenv').config();
const { OpenAI } = require('openai');
const fs = require('fs');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function developWithOpenAI(prompt) {
  const projectContext = await getProjectContext();
  
  const completion = await openai.chat.completions.create({
    messages: [
      {
        role: 'system', 
        content: "${this.config.systemPrompt || 'You are a helpful coding assistant.'}"
      },
      {
        role: 'user',
        content: \`
Project Context:
\${projectContext}

Task: \${prompt}
\`
      }
    ],
    model: process.env.OPENAI_MODEL || 'gpt-4',
    temperature: 0.1
  });

  return completion.choices[0].message.content;
}

async function getProjectContext() {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  return \`Package.json: \${JSON.stringify(packageJson, null, 2)}\`;
}

// Run if called directly
if (require.main === module) {
  const prompt = process.argv.slice(2).join(' ');
  developWithOpenAI(prompt)
    .then(console.log)
    .catch(console.error);
}

module.exports = { developWithOpenAI };
`;
    await this.stackblitz.writeFile(this.project, 'scripts/openai-dev.js', openaiWorkflow);
  }

  async developFeature(taskDescription: string, options: {
    onProgress: (step: string) => void;
    onCommit: (message: string) => void;
    maxIterations?: number;
  }): Promise<{ success: boolean; commits: string[]; output: string }> {
    
    const commits: string[] = [];
    const maxIterations = options.maxIterations || 10;
    let iteration = 0;
    let success = false;
    let output = '';

    options.onProgress('Starting AI development session...');

    while (iteration < maxIterations && !success) {
      iteration++;
      options.onProgress(`Iteration ${iteration}: Analyzing and implementing...`);

      try {
        // Use the AI provider to develop the feature
        const aiResponse = await this.runAICommand(taskDescription, iteration);
        output += `\n--- Iteration ${iteration} ---\n${aiResponse}`;

        // Extract and apply code changes from AI response
        const changes = await this.extractCodeChanges(aiResponse);
        
        if (changes.length > 0) {
          // Apply changes to the sandbox
          await this.applyChanges(changes);
          
          // Run tests
          options.onProgress('Running tests...');
          const testResult = await this.testRunner.runTests(this.project.url, 'main');
          
          if (testResult.success) {
            success = true;
            options.onProgress('✅ All tests passing!');
          } else {
            options.onProgress('❌ Tests failing, fixing issues...');
            // Let AI fix the test failures
            const fixPrompt = `The tests are failing with this output:\n${testResult.output}\n\nPlease fix these issues.`;
            await this.runAICommand(fixPrompt, iteration);
          }

          // Commit changes
          const commitMessage = `feat: iteration ${iteration} - ${taskDescription.slice(0, 50)}`;
          commits.push(commitMessage);
          options.onCommit(commitMessage);
        }

      } catch (error) {
        options.onProgress(`❌ Error in iteration ${iteration}: ${error.message}`);
        output += `\nError: ${error.message}`;
      }
    }

    return { success, commits, output };
  }

  private async runAICommand(prompt: string, iteration: number): Promise<string> {
    const contextPrompt = `
Iteration ${iteration}:
${prompt}

Please provide a detailed implementation with:
1. Clear explanation of changes
2. Code files to create/modify
3. Test cases to add/update
4. Any setup instructions

Format your response clearly with code blocks and file paths.
`;

    switch (this.config.aiProvider) {
      case 'claude':
        return await this.sandboxAI.runClaudeCode(contextPrompt);
      case 'gemini':
        return await this.stackblitz.runCommand(this.project, `node scripts/gemini-dev.js "${contextPrompt}"`).then(r => r.output);
      case 'openai':
        return await this.stackblitz.runCommand(this.project, `node scripts/openai-dev.js "${contextPrompt}"`).then(r => r.output);
      default:
        throw new Error(`Unknown AI provider: ${this.config.aiProvider}`);
    }
  }

  private async extractCodeChanges(aiResponse: string): Promise<Array<{
    filePath: string;
    content: string;
    action: 'create' | 'update' | 'delete';
  }>> {
    const changes: Array<{ filePath: string; content: string; action: 'create' | 'update' | 'delete' }> = [];
    
    // Parse AI response for code blocks and file operations
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const filePathRegex = /\/\/ ([\w\/.-]+)/g;
    
    let match;
    while ((match = codeBlockRegex.exec(aiResponse)) !== null) {
      const content = match[2];
      const filePathMatch = content.match(filePathRegex);
      
      if (filePathMatch) {
        const filePath = filePathMatch[0].replace('//', '').trim();
        changes.push({
          filePath,
          content,
          action: 'create' // Default to create, could be smarter
        });
      }
    }

    return changes;
  }

  private async applyChanges(changes: Array<{
    filePath: string;
    content: string;
    action: 'create' | 'update' | 'delete';
  }>): Promise<void> {
    for (const change of changes) {
      switch (change.action) {
        case 'create':
        case 'update':
          await this.stackblitz.writeFile(this.project, change.filePath, change.content);
          break;
        case 'delete':
          await this.stackblitz.deleteFile(this.project, change.filePath);
          break;
      }
    }
  }

  async getProjectStatus(): Promise<{
    framework: string;
    dependencies: Record<string, string>;
    aiProvider: string;
    testsStatus: 'passing' | 'failing' | 'unknown';
  }> {
    const projectInfo = await this.stackblitz.getProjectInfo(this.project);
    const testResult = await this.testRunner.runTests(this.project.url, 'main');
    
    return {
      framework: projectInfo.framework,
      dependencies: projectInfo.dependencies,
      aiProvider: this.config.aiProvider,
      testsStatus: testResult.success ? 'passing' : 'failing'
    };
  }
}
