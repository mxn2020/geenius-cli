import { tool } from 'ai';
import { z } from 'zod';

interface AgentConfig {
  sessionId: string;
  sandbox: any;
  repositoryUrl: string;
  projectContext: {
    componentRegistry: any;
    dependencies: Record<string, string>;
    framework: string;
    structure: string;
  };
}

interface AgentMemory {
  conversation: Array<{ role: string; content: string; timestamp: number }>;
  projectContext: any;
  taskHistory: Array<{
    task: string;
    approach: string;
    result: string;
    success: boolean;
    timestamp: number;
  }>;
  codePatterns: Array<{
    pattern: string;
    context: string;
    effectiveness: number;
  }>;
}

interface AgentResult {
  success: boolean;
  result?: any;
  error?: string;
  reasoning: string[];
  executionSteps: Array<{
    step: string;
    result: string;
    success: boolean;
    tool?: string;
    parameters?: any;
  }>;
}

export class CustomAIAgent {
  private config: AgentConfig;
  private memory: AgentMemory;
  private tools: Map<string, any>;
  private aiProvider: string;
  private apiKey: string;
  private model: string;

  constructor(config: AgentConfig) {
    this.config = config;
    this.memory = this.initializeMemory();
    this.tools = new Map();
    this.aiProvider = process.env.CUSTOM_AI_PROVIDER || 'anthropic';
    this.apiKey = this.getAPIKey();
    this.model = this.getModel();
  }

  private getAPIKey(): string {
    switch (this.aiProvider) {
      case 'anthropic':
        return process.env.ANTHROPIC_API_KEY || '';
      case 'openai':
        return process.env.OPENAI_API_KEY || '';
      case 'google':
        return process.env.GOOGLE_API_KEY || '';
      case 'grok':
        return process.env.GROK_API_KEY || '';
      default:
        throw new Error(`Unsupported AI provider: ${this.aiProvider}`);
    }
  }

  private getModel(): string {
    const modelMap = {
      'anthropic': 'claude-sonnet-4-20250514',
      'openai': 'gpt-4-turbo',
      'google': 'gemini-pro',
      'grok': 'grok-beta'
    };
    return modelMap[this.aiProvider] || 'gpt-4-turbo';
  }

  private initializeMemory(): AgentMemory {
    return {
      conversation: [],
      projectContext: this.config.projectContext,
      taskHistory: [],
      codePatterns: []
    };
  }

  async initialize(): Promise<void> {
    await this.registerTools();
    await this.setupAgentEnvironment();
  }

  private async registerTools(): Promise<void> {
    // File system tools
    this.tools.set('read_file', tool({
      description: 'Read the contents of a file in the sandbox',
      parameters: z.object({
        path: z.string().describe('File path to read')
      }),
      execute: async ({ path }) => {
        return await this.sandbox.readFile(path);
      }
    }));

    this.tools.set('write_file', tool({
      description: 'Write or update a file in the sandbox',
      parameters: z.object({
        path: z.string().describe('File path to write'),
        content: z.string().describe('File content')
      }),
      execute: async ({ path, content }) => {
        return await this.sandbox.writeFile(path, content);
      }
    }));

    this.tools.set('list_files', tool({
      description: 'List files and directories in a given path',
      parameters: z.object({
        path: z.string().optional().describe('Directory path to list (defaults to current directory)')
      }),
      execute: async ({ path = '.' }) => {
        return await this.sandbox.listFiles(path);
      }
    }));

    // Git operations
    this.tools.set('git_clone', tool({
      description: 'Clone a repository into the sandbox',
      parameters: z.object({
        repositoryUrl: z.string().describe('Git repository URL'),
        branch: z.string().optional().describe('Branch to checkout (defaults to main)')
      }),
      execute: async ({ repositoryUrl, branch = 'main' }) => {
        return await this.sandbox.gitClone(repositoryUrl, branch);
      }
    }));

    this.tools.set('git_create_branch', tool({
      description: 'Create and switch to a new git branch',
      parameters: z.object({
        branchName: z.string().describe('Name of the new branch')
      }),
      execute: async ({ branchName }) => {
        return await this.sandbox.gitCreateBranch(branchName);
      }
    }));

    this.tools.set('git_commit', tool({
      description: 'Commit changes to git',
      parameters: z.object({
        message: z.string().describe('Commit message')
      }),
      execute: async ({ message }) => {
        return await this.sandbox.gitCommit(message);
      }
    }));

    // Project analysis tools
    this.tools.set('analyze_component', tool({
      description: 'Analyze a React component and its dependencies',
      parameters: z.object({
        componentId: z.string().describe('Component ID to analyze'),
        deep: z.boolean().optional().describe('Whether to perform deep analysis')
      }),
      execute: async ({ componentId, deep = false }) => {
        return await this.analyzeComponent(componentId, deep);
      }
    }));

    this.tools.set('get_project_structure', tool({
      description: 'Get the overall project structure and dependencies',
      parameters: z.object({}),
      execute: async () => {
        return await this.getProjectStructure();
      }
    }));

    // Testing tools
    this.tools.set('run_tests', tool({
      description: 'Run the project test suite',
      parameters: z.object({
        testPath: z.string().optional().describe('Specific test file or directory to run')
      }),
      execute: async ({ testPath }) => {
        return await this.sandbox.runTests(testPath);
      }
    }));

    this.tools.set('create_test', tool({
      description: 'Create a test file for a component',
      parameters: z.object({
        componentPath: z.string().describe('Path to the component file'),
        testType: z.enum(['unit', 'integration', 'e2e']).describe('Type of test to create')
      }),
      execute: async ({ componentPath, testType }) => {
        return await this.createTest(componentPath, testType);
      }
    }));

    // Command execution
    this.tools.set('run_command', tool({
      description: 'Run a shell command in the sandbox',
      parameters: z.object({
        command: z.string().describe('Command to execute'),
        workingDir: z.string().optional().describe('Working directory for the command')
      }),
      execute: async ({ command, workingDir = '.' }) => {
        return await this.sandbox.runCommand(command, { cwd: workingDir });
      }
    }));

    // External AI CLI tools (Claude Code, Gemini CLI)
    this.tools.set('run_claude_code', tool({
      description: 'Run Claude Code CLI with a specific prompt',
      parameters: z.object({
        prompt: z.string().describe('Prompt for Claude Code'),
        files: z.array(z.string()).optional().describe('Specific files to focus on')
      }),
      execute: async ({ prompt, files }) => {
        return await this.runClaudeCode(prompt, files);
      }
    }));

    this.tools.set('run_gemini_cli', tool({
      description: 'Run Gemini CLI with a specific prompt',
      parameters: z.object({
        prompt: z.string().describe('Prompt for Gemini CLI'),
        context: z.string().optional().describe('Additional context for Gemini')
      }),
      execute: async ({ prompt, context }) => {
        return await this.runGeminiCLI(prompt, context);
      }
    }));

    // GitHub operations
    this.tools.set('create_pull_request', tool({
      description: 'Create a pull request on GitHub',
      parameters: z.object({
        title: z.string().describe('PR title'),
        changes: z.array(z.any()).describe('List of changes made'),
        sessionId: z.string().describe('Session ID for tracking')
      }),
      execute: async ({ title, changes, sessionId }) => {
        return await this.createPullRequest(title, changes, sessionId);
      }
    }));

    // Deployment monitoring
    this.tools.set('wait_for_deployment', tool({
      description: 'Wait for and monitor deployment status',
      parameters: z.object({
        branchName: z.string().describe('Branch name to monitor')
      }),
      execute: async ({ branchName }) => {
        return await this.waitForDeployment(branchName);
      }
    }));
  }

  private async setupAgentEnvironment(): Promise<void> {
    // Setup Claude Code if anthropic provider
    if (this.aiProvider === 'anthropic') {
      await this.sandbox.runCommand('npm install -g @anthropic-ai/claude-code');
      await this.sandbox.writeFile('.env', `ANTHROPIC_API_KEY=${this.apiKey}`);
    }

    // Setup Gemini CLI if google provider
    if (this.aiProvider === 'google') {
      await this.sandbox.runCommand('npm install -g @google/generative-ai');
      await this.sandbox.writeFile('.env', `GOOGLE_API_KEY=${this.apiKey}`);
    }

    // Install project dependencies
    await this.sandbox.runCommand('npm install');
  }

  async processTask(
    prompt: string, 
    options: {
      reasoning: boolean;
      maxSteps: number;
      onProgress?: (step: string, agent?: string) => Promise<void>;
    }
  ): Promise<AgentResult> {
    const reasoning: string[] = [];
    const executionSteps: Array<{
      step: string;
      result: string;
      success: boolean;
      tool?: string;
      parameters?: any;
    }> = [];

    try {
      // Add task to memory
      this.memory.conversation.push({
        role: 'user',
        content: prompt,
        timestamp: Date.now()
      });

      if (options.reasoning) {
        reasoning.push('🧠 Analyzing task and generating execution plan...');
        if (options.onProgress) await options.onProgress('Analyzing task and generating execution plan...');
      }

      // Use the AI provider to reason about the task and decide on tool usage
      const systemPrompt = `You are an advanced AI development assistant with access to powerful tools for code analysis, file manipulation, testing, and integration with external AI systems.

**AVAILABLE TOOLS:**
${Array.from(this.tools.keys()).map(tool => `- ${tool}`).join('\n')}

**PROJECT CONTEXT:**
- Repository: ${this.config.repositoryUrl}
- Framework: ${this.memory.projectContext.framework}
- Component Registry: ${JSON.stringify(this.memory.projectContext.componentRegistry, null, 2)}

**YOUR APPROACH:**
1. Analyze the task thoroughly
2. Break it down into actionable steps
3. Use tools strategically to implement the solution
4. Validate your work with tests
5. Ensure code quality and maintainability

**IMPORTANT:**
- Always use tools to interact with the codebase
- Make incremental changes and test frequently
- Follow React/TypeScript best practices
- Consider component relationships and dependencies
- Document your changes appropriately

For complex tasks, you can leverage external AI tools:
- Use 'run_claude_code' for advanced code generation and refactoring
- Use 'run_gemini_cli' for creative problem solving and analysis

Start by analyzing the current codebase structure, then implement the requested changes step by step.`;

      let currentStep = 0;
      let lastResult = '';
      let shouldContinue = true;

      while (shouldContinue && currentStep < options.maxSteps) {
        currentStep++;
        
        const stepPrompt = currentStep === 1 
          ? `${systemPrompt}\n\nTask: ${prompt}\n\nPlease start by analyzing the current state and then implement the required changes.`
          : `Continue with the implementation. Previous result: ${lastResult}\n\nNext step in the process:`;

        const stepResult = await this.callAIWithTools(stepPrompt);
        
        // Parse the AI response and extract tool calls
        const toolCalls = this.parseToolCalls(stepResult);
        
        if (toolCalls.length > 0) {
          for (const toolCall of toolCalls) {
            const tool = this.tools.get(toolCall.name);
            if (tool) {
              try {
                const toolResult = await tool.execute(toolCall.parameters);
                executionSteps.push({
                  step: `Using ${toolCall.name}`,
                  result: JSON.stringify(toolResult).slice(0, 500),
                  success: true,
                  tool: toolCall.name,
                  parameters: toolCall.parameters
                });
                
                reasoning.push(`✅ Executed ${toolCall.name} successfully`);
                if (options.onProgress) await options.onProgress(`Executed ${toolCall.name}`);
                
                lastResult = JSON.stringify(toolResult);
              } catch (error) {
                executionSteps.push({
                  step: `Using ${toolCall.name}`,
                  result: `Error: ${error.message}`,
                  success: false,
                  tool: toolCall.name,
                  parameters: toolCall.parameters
                });
                
                reasoning.push(`❌ Tool ${toolCall.name} failed: ${error.message}`);
                if (options.onProgress) await options.onProgress(`Tool ${toolCall.name} failed: ${error.message}`);
              }
            }
          }
        } else {
          // No more tool calls, task might be complete
          shouldContinue = false;
          lastResult = stepResult;
        }

        // Check if the AI indicates completion
        if (stepResult.toLowerCase().includes('task completed') || 
            stepResult.toLowerCase().includes('implementation finished') ||
            stepResult.toLowerCase().includes('all done')) {
          shouldContinue = false;
        }
      }

      // Store in memory for learning
      this.memory.taskHistory.push({
        task: prompt,
        approach: `${executionSteps.length} steps executed`,
        result: lastResult.slice(0, 500),
        success: true,
        timestamp: Date.now()
      });

      return {
        success: true,
        result: lastResult,
        reasoning,
        executionSteps
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        reasoning,
        executionSteps
      };
    }
  }

  async executeCommand(command: string, parameters: any): Promise<any> {
    const tool = this.tools.get(command);
    if (!tool) {
      throw new Error(`Unknown command: ${command}`);
    }
    
    return await tool.execute(parameters);
  }

  private async callAIWithTools(prompt: string): Promise<string> {
    // This would integrate with your preferred AI provider
    // and handle tool calling based on the provider's capabilities
    
    switch (this.aiProvider) {
      case 'anthropic':
        return await this.callAnthropicWithTools(prompt);
      case 'openai':
        return await this.callOpenAIWithTools(prompt);
      case 'google':
        return await this.callGoogleWithTools(prompt);
      default:
        return await this.callAnthropicWithTools(prompt);
    }
  }

  private async callAnthropicWithTools(prompt: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 4000,
        temperature: 0.1,
        messages: [{
          role: 'user',
          content: prompt
        }],
        tools: Array.from(this.tools.values()).map(tool => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.parameters
        }))
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  private parseToolCalls(aiResponse: string): Array<{ name: string; parameters: any }> {
    // Parse AI response for tool calls
    // This is a simplified parser - in practice you'd use the provider's tool calling format
    const toolCalls = [];
    const toolCallRegex = /use_tool:\s*(\w+)\s*\((.*?)\)/g;
    
    let match;
    while ((match = toolCallRegex.exec(aiResponse)) !== null) {
      try {
        const toolName = match[1];
        const parametersString = match[2];
        const parameters = JSON.parse(`{${parametersString}}`);
        
        toolCalls.push({
          name: toolName,
          parameters
        });
      } catch (error) {
        console.warn('Failed to parse tool call:', match[0]);
      }
    }
    
    return toolCalls;
  }

  // Tool implementations
  private async analyzeComponent(componentId: string, deep: boolean): Promise<any> {
    const component = this.memory.projectContext.componentRegistry[componentId];
    if (!component) {
      return { error: `Component ${componentId} not found in registry` };
    }

    // Read the component file
    const componentPath = component.context?.filePath || `src/components/${componentId}.tsx`;
    const componentCode = await this.sandbox.readFile(componentPath);
    
    // Analyze dependencies, props, etc.
    const analysis = {
      componentId,
      filePath: componentPath,
      codeLength: componentCode.length,
      dependencies: this.extractDependencies(componentCode),
      props: this.extractProps(componentCode),
      state: this.extractState(componentCode),
      hooks: this.extractHooks(componentCode)
    };

    if (deep) {
      // Perform deeper analysis with AI
      const deepAnalysisPrompt = `Analyze this React component code:

${componentCode}

Provide insights on:
1. Component architecture and patterns used
2. Potential improvements or refactoring opportunities
3. Dependencies and their necessity
4. Performance considerations
5. Accessibility and UX aspects

Format your response as a structured analysis.`;

      const aiAnalysis = await this.callAIWithTools(deepAnalysisPrompt);
      analysis.aiInsights = aiAnalysis;
    }

    return analysis;
  }

  private async getProjectStructure(): Promise<any> {
    const packageJson = await this.sandbox.readFile('package.json');
    const srcFiles = await this.sandbox.listFiles('src');
    
    return {
      packageJson: JSON.parse(packageJson),
      srcStructure: srcFiles,
      componentRegistry: this.memory.projectContext.componentRegistry,
      framework: this.memory.projectContext.framework
    };
  }

  private async createTest(componentPath: string, testType: string): Promise<any> {
    const componentCode = await this.sandbox.readFile(componentPath);
    const componentName = componentPath.split('/').pop()?.replace('.tsx', '');
    
    const testPrompt = `Create a comprehensive ${testType} test for this React component:

Component: ${componentName}
File: ${componentPath}

Code:
${componentCode}

Create tests that cover:
1. Component rendering
2. Props handling
3. User interactions
4. Edge cases
5. Error states

Use Jest and React Testing Library. Provide the complete test file.`;

    const testCode = await this.callAIWithTools(testPrompt);
    const testPath = componentPath.replace('.tsx', '.test.tsx');
    
    await this.sandbox.writeFile(testPath, testCode);
    
    return {
      testPath,
      componentPath,
      testType,
      created: true
    };
  }

  private async runClaudeCode(prompt: string, files?: string[]): Promise<any> {
    const claudeCommand = files && files.length > 0
      ? `claude --files ${files.join(',')} "${prompt}"`
      : `claude "${prompt}"`;
      
    return await this.sandbox.runCommand(claudeCommand);
  }

  private async runGeminiCLI(prompt: string, context?: string): Promise<any> {
    const fullPrompt = context ? `${context}\n\n${prompt}` : prompt;
    return await this.sandbox.runCommand(`node scripts/gemini-dev.js "${fullPrompt}"`);
  }

  private async createPullRequest(title: string, changes: any[], sessionId: string): Promise<any> {
    // Implementation for GitHub PR creation
    const description = `# AI-Generated Improvements

This pull request contains ${changes.length} AI-generated improvements:

${changes.map((change, index) => 
  `## ${index + 1}. ${change.category}: ${change.componentId}\n${change.feedback}\n`
).join('\n')}

🤖 Generated automatically by Geenius AI Agent
Session ID: ${sessionId}`;

    return await this.sandbox.createPullRequest(title, description);
  }

  private async waitForDeployment(branchName: string): Promise<any> {
    // Implementation for deployment monitoring
    await new Promise(resolve => setTimeout(resolve, 5000));
    return {
      success: true,
      previewUrl: `https://${branchName.replace('/', '-')}--preview.netlify.app`
    };
  }

  // Utility methods for code analysis
  private extractDependencies(code: string): string[] {
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    const dependencies = [];
    let match;
    
    while ((match = importRegex.exec(code)) !== null) {
      dependencies.push(match[1]);
    }
    
    return dependencies;
  }

  private extractProps(code: string): any {
    const propsRegex = /interface\s+(\w+Props)\s*{([^}]+)}/g;
    const match = propsRegex.exec(code);
    
    if (match) {
      return {
        interface: match[1],
        properties: match[2].trim().split('\n').map(line => line.trim()).filter(Boolean)
      };
    }
    
    return null;
  }

  private extractState(code: string): string[] {
    const stateRegex = /useState[<(]([^>)]+)[>)]?\s*\(/g;
    const stateVars = [];
    let match;
    
    while ((match = stateRegex.exec(code)) !== null) {
      stateVars.push(match[1]);
    }
    
    return stateVars;
  }

  private extractHooks(code: string): string[] {
    const hookRegex = /use[A-Z]\w*/g;
    const hooks = [];
    let match;
    
    while ((match = hookRegex.exec(code)) !== null) {
      if (!hooks.includes(match[0])) {
        hooks.push(match[0]);
      }
    }
    
    return hooks;
  }

  async getStats(): Promise<any> {
    return {
      tasksCompleted: this.memory.taskHistory.length,
      successRate: this.memory.taskHistory.filter(t => t.success).length / this.memory.taskHistory.length,
      toolsAvailable: this.tools.size,
      memoryEntries: this.memory.conversation.length
    };
  }

  get sandbox() {
    return this.config.sandbox;
  }
}