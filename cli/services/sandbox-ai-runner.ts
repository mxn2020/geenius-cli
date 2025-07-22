// src/services/sandbox-ai-runner.ts
import { StackBlitzService } from './stackblitz';
import { NetlifyService } from './netlify';

interface AIConfig {
  provider: 'claude' | 'gemini' | 'openai' | 'custom';
  apiKey: string;
  model?: string;
  additionalConfig?: Record<string, any>;
}

interface SandboxAIRunner {
  setupAI(config: AIConfig): Promise<void>;
  runAICommand(command: string, context?: string): Promise<string>;
  installAITools(): Promise<void>;
}

export class SandboxAIService implements SandboxAIRunner {
  private stackblitz: StackBlitzService;
  private netlify: NetlifyService;
  private project: any;

  constructor(project: any) {
    this.stackblitz = new StackBlitzService();
    this.netlify = new NetlifyService();
    this.project = project;
  }

  async setupAI(config: AIConfig): Promise<void> {
    // Create .env file with AI provider credentials
    const envContent = this.generateEnvFile(config);
    await this.stackblitz.writeFile(this.project, '.env', envContent);

    // Install AI CLI tools based on provider
    await this.installAITools(config.provider);

    // Create AI wrapper scripts
    await this.createAIWrappers(config);
  }

  private generateEnvFile(config: AIConfig): string {
    const envVars = [`# AI Configuration`];
    
    switch (config.provider) {
      case 'claude':
        envVars.push(`ANTHROPIC_API_KEY=${config.apiKey}`);
        if (config.model) envVars.push(`CLAUDE_MODEL=${config.model}`);
        break;
      case 'gemini':
        envVars.push(`GOOGLE_API_KEY=${config.apiKey}`);
        if (config.model) envVars.push(`GEMINI_MODEL=${config.model}`);
        break;
      case 'openai':
        envVars.push(`OPENAI_API_KEY=${config.apiKey}`);
        if (config.model) envVars.push(`OPENAI_MODEL=${config.model}`);
        break;
    }

    // Add any additional config
    if (config.additionalConfig) {
      Object.entries(config.additionalConfig).forEach(([key, value]) => {
        envVars.push(`${key}=${value}`);
      });
    }

    return envVars.join('\n');
  }

  async installAITools(provider: 'claude' | 'gemini' | 'openai' | 'custom' | 'anthropic'): Promise<void> {
    const installCommands: Record<string, string[]> = {
      claude: [
        'npm install -g @anthropic-ai/claude-code',
        'npm install @anthropic-ai/sdk'
      ],
      anthropic: [
        'npm install -g @anthropic-ai/claude-code',
        'npm install @anthropic-ai/sdk'
      ],
      gemini: [
        'npm install -g @google/generative-ai',
        'npm install @google/generative-ai'
      ],
      google: [
        'npm install -g @google/generative-ai',
        'npm install @google/generative-ai'
      ],
      openai: [
        'npm install -g openai',
        'npm install openai'
      ],
      grok: [
        'npm install -g grok-ai',
        'npm install grok-ai'
      ],
      custom: []
    };

    const commands = installCommands[provider];
    if (!commands) {
      console.warn(`No install commands found for provider: ${provider}`);
      return;
    }

    for (const command of commands) {
      await this.stackblitz.runCommand(this.project, command);
    }
  }

  private async createAIWrappers(config: AIConfig): Promise<void> {
    // Create a unified AI wrapper script
    const wrapperScript = this.generateWrapperScript(config);
    await this.stackblitz.writeFile(this.project, 'ai-wrapper.js', wrapperScript);

    // Create provider-specific scripts
    await this.createProviderScripts(config);
  }

  private generateWrapperScript(config: AIConfig): string {
    return `#!/usr/bin/env node
require('dotenv').config();
const { spawn } = require('child_process');

const provider = '${config.provider}';
const args = process.argv.slice(2);

async function runAI() {
  let command, commandArgs;
  
  switch (provider) {
    case 'claude':
      command = 'claude';
      commandArgs = args;
      break;
    case 'gemini':
      command = 'gemini';
      commandArgs = args;
      break;
    case 'openai':
      command = 'openai';
      commandArgs = args;
      break;
    default:
      throw new Error('Unknown AI provider: ' + provider);
  }

  const child = spawn(command, commandArgs, {
    stdio: 'inherit',
    env: { ...process.env }
  });

  return new Promise((resolve, reject) => {
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error('AI command failed with code: ' + code));
    });
  });
}

runAI().catch(console.error);
`;
  }

  private async createProviderScripts(config: AIConfig): Promise<void> {
    switch (config.provider) {
      case 'claude':
        await this.createClaudeScript();
        break;
      case 'gemini':
        await this.createGeminiScript();
        break;
      case 'openai':
        await this.createOpenAIScript();
        break;
    }
  }

  private async createClaudeScript(): Promise<void> {
    const script = `#!/usr/bin/env node
require('dotenv').config();
const { spawn } = require('child_process');

// Initialize Claude Code with project context
const initClaude = async () => {
  console.log('🤖 Starting Claude Code...');
  
  // Run claude command with arguments
  const args = process.argv.slice(2);
  
  const claude = spawn('claude', args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
    }
  });

  return new Promise((resolve, reject) => {
    claude.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error('Claude failed with code: ' + code));
    });
  });
};

initClaude().catch(console.error);
`;
    await this.stackblitz.writeFile(this.project, 'scripts/claude.js', script);
  }

  private async createGeminiScript(): Promise<void> {
    const script = `#!/usr/bin/env node
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-pro' });

async function runGemini() {
  const prompt = process.argv.slice(2).join(' ');
  
  if (!prompt) {
    console.error('Please provide a prompt');
    process.exit(1);
  }

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    console.log(response.text());
  } catch (error) {
    console.error('Gemini error:', error);
    process.exit(1);
  }
}

runGemini();
`;
    await this.stackblitz.writeFile(this.project, 'scripts/gemini.js', script);
  }

  private async createOpenAIScript(): Promise<void> {
    const script = `#!/usr/bin/env node
require('dotenv').config();
const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function runOpenAI() {
  const prompt = process.argv.slice(2).join(' ');
  
  if (!prompt) {
    console.error('Please provide a prompt');
    process.exit(1);
  }

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: process.env.OPENAI_MODEL || 'gpt-4',
    });

    console.log(completion.choices[0].message.content);
  } catch (error) {
    console.error('OpenAI error:', error);
    process.exit(1);
  }
}

runOpenAI();
`;
    await this.stackblitz.writeFile(this.project, 'scripts/openai.js', script);
  }

  async runAICommand(command: string, context?: string): Promise<string> {
    // Prepare the AI command with context
    const fullCommand = context ? `${command} "${context}"` : command;
    
    // Run the AI command in the sandbox
    const result = await this.stackblitz.runCommand(this.project, `node ai-wrapper.js ${fullCommand}`);
    
    return result.output;
  }

  async runClaudeCode(prompt: string, files?: string[]): Promise<string> {
    let command = `node scripts/claude.js "${prompt}"`;
    
    if (files && files.length > 0) {
      command += ` --files ${files.join(',')}`;
    }
    
    const result = await this.stackblitz.runCommand(this.project, command);
    return result.output;
  }

  async runGeminiCode(prompt: string): Promise<string> {
    const result = await this.stackblitz.runCommand(this.project, `node scripts/gemini.js "${prompt}"`);
    return result.output;
  }

  async setupClaudeProject(): Promise<void> {
    // Create Claude project configuration
    const claudeConfig = {
      name: "AI Development Session",
      description: "Automated development session with AI assistance",
      framework: await this.detectFramework(),
      tools: ["file-editor", "terminal", "web-search"]
    };

    await this.stackblitz.writeFile(this.project, 'CLAUDE.md', this.generateClaudeConfig(claudeConfig));
  }

  private async detectFramework(): Promise<string> {
    const projectInfo = await this.stackblitz.getProjectInfo(this.project);
    return projectInfo.framework;
  }

  private generateClaudeConfig(config: any): string {
    return `# Claude Code Configuration

## Project: ${config.name}
${config.description}

## Framework: ${config.framework}

## Development Guidelines
- Follow best practices for ${config.framework}
- Write comprehensive tests for all new features
- Use TypeScript for type safety
- Follow the existing code style and patterns

## Available Tools
${config.tools.map(tool => `- ${tool}`).join('\n')}

## Development Process
1. Analyze the current codebase
2. Plan the implementation
3. Write the code with proper error handling
4. Create comprehensive tests
5. Verify everything works correctly
6. Document the changes

## Testing Requirements
- Unit tests for all functions
- Integration tests for API endpoints
- End-to-end tests for user workflows
- Achieve >80% code coverage

## Code Quality Standards
- Use ESLint and Prettier for code formatting
- Follow semantic commit messages
- Write clear documentation
- Handle edge cases and errors gracefully
`;
  }
}

//  template with AI integration
export interface AIEnabledTemplate extends ProjectTemplate {
  aiProvider: 'claude' | 'gemini' | 'openai';
  aiConfig: {
    model: string;
    tools: string[];
    systemPrompt: string;
  };
}

export const aiEnabledTemplates: AIEnabledTemplate[] = [
  {
    id: "nextjs-supabase-claude",
    name: "Next.js + Supabase + Claude Code",
    description: "Full-stack Next.js app with Supabase and Claude Code integration",
    stack: ["Next.js", "Supabase", "Claude Code", "TypeScript"],
    githubRepo: "your-org/template-nextjs-supabase-claude",
    testCommand: "npm run test",
    buildCommand: "pnpm build",
    devCommand: "npm run dev",
    setupInstructions: [
      "Install dependencies: npm install",
      "Set up Supabase project",
      "Configure Claude Code with project context",
      "Run initial development session"
    ],
    envVars: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_KEY", "ANTHROPIC_API_KEY"],
    aiProvider: "claude",
    aiConfig: {
      model: "claude-sonnet-4-20250514",
      tools: ["file-editor", "terminal", "supabase-cli"],
      systemPrompt: "You are a Next.js expert working with Supabase. Focus on type-safe code, proper error handling, and following Next.js best practices."
    }
  },
  {
    id: "vite-react-gemini",
    name: "Vite + React + Gemini",
    description: "Modern React app with Vite and Gemini AI integration",
    stack: ["Vite", "React", "TypeScript", "Gemini AI"],
    githubRepo: "your-org/template-vite-react-gemini",
    testCommand: "npm run test",
    buildCommand: "pnpm build",
    devCommand: "npm run dev",
    setupInstructions: [
      "Install dependencies: npm install",
      "Set up Google AI API key",
      "Configure Gemini integration",
      "Run development server"
    ],
    envVars: ["VITE_GOOGLE_API_KEY", "GEMINI_MODEL"],
    aiProvider: "gemini",
    aiConfig: {
      model: "gemini-pro",
      tools: ["file-editor", "terminal", "web-search"],
      systemPrompt: "You are a React developer using Vite. Focus on modern React patterns, hooks, and performance optimization."
    }
  }
];
