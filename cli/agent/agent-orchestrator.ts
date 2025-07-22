// src/agent/agent-orchestrator.ts
import { CustomAIAgent } from './custom-ai-agent';
import { EventEmitter } from 'events';

interface AgentRole {
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  specialization: 'planning' | 'coding' | 'testing' | 'reviewing' | 'documenting';
}

interface AgentTeam {
  lead: CustomAIAgent;
  members: Map<string, CustomAIAgent>;
  roles: Map<string, AgentRole>;
}

interface Task {
  id: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dependencies: string[];
  assignedAgent?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: any;
  startTime?: number;
  endTime?: number;
}

interface OrchestrationStrategy {
  type: 'sequential' | 'parallel' | 'hierarchical' | 'collaborative';
  maxConcurrency: number;
  retryOnFailure: boolean;
  crossValidation: boolean;
}

export class AgentOrchestrator extends EventEmitter {
  private team: AgentTeam;
  private taskQueue: Task[] = [];
  private activeTasks: Map<string, Task> = new Map();
  private completedTasks: Map<string, Task> = new Map();
  private strategy: OrchestrationStrategy;

  constructor(leadConfig: any, strategy: OrchestrationStrategy = {
    type: 'hierarchical',
    maxConcurrency: 3,
    retryOnFailure: true,
    crossValidation: true
  }) {
    super();
    this.strategy = strategy;
    this.initializeTeam(leadConfig);
  }

  private initializeTeam(leadConfig: any): void {
    // Initialize team lead (senior agent)
    const lead = new CustomAIAgent({
      ...leadConfig,
      systemPrompt: this.getLeadSystemPrompt()
    });

    // Define specialized roles
    const roles = new Map<string, AgentRole>([
      ['architect', {
        name: 'Software Architect',
        description: 'Designs system architecture and makes high-level decisions',
        systemPrompt: this.getArchitectPrompt(),
        tools: ['analyze_code', 'generate_plan', 'search_memory'],
        specialization: 'planning'
      }],
      ['developer', {
        name: 'Senior Developer',
        description: 'Implements features and writes high-quality code',
        systemPrompt: this.getDeveloperPrompt(),
        tools: ['analyze_code', 'execute_step', 'generate_plan'],
        specialization: 'coding'
      }],
      ['tester', {
        name: 'QA Engineer',
        description: 'Creates comprehensive tests and ensures quality',
        systemPrompt: this.getTesterPrompt(),
        tools: ['analyze_code', 'execute_step'],
        specialization: 'testing'
      }],
      ['reviewer', {
        name: 'Code Reviewer',
        description: 'Reviews code for best practices and improvements',
        systemPrompt: this.getReviewerPrompt(),
        tools: ['analyze_code', 'reflect_and_improve'],
        specialization: 'reviewing'
      }],
      ['documenter', {
        name: 'Technical Writer',
        description: 'Creates documentation and user guides',
        systemPrompt: this.getDocumenterPrompt(),
        tools: ['analyze_code', 'search_memory'],
        specialization: 'documenting'
      }]
    ]);

    // Initialize specialized agents
    const members = new Map<string, CustomAIAgent>();
    for (const [roleKey, role] of roles.entries()) {
      members.set(roleKey, new CustomAIAgent({
        ...leadConfig,
        systemPrompt: role.systemPrompt
      }));
    }

    this.team = { lead, members, roles };
  }

  async orchestrateTask(description: string, options: {
    strategy?: OrchestrationStrategy;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    requiredRoles?: string[];
    deadline?: number;
  } = {}): Promise<{
    success: boolean;
    result: any;
    taskBreakdown: Task[];
    agentContributions: Map<string, any>;
    timeline: Array<{ timestamp: number; event: string; agent: string }>;
  }> {
    const strategy = options.strategy || this.strategy;
    const timeline: Array<{ timestamp: number; event: string; agent: string }> = [];
    const agentContributions = new Map<string, any>();

    // Step 1: Lead agent analyzes and breaks down the task
    timeline.push({ timestamp: Date.now(), event: 'Task analysis started', agent: 'lead' });
    
    const taskBreakdown = await this.analyzeAndBreakdownTask(description, options);
    timeline.push({ timestamp: Date.now(), event: 'Task breakdown completed', agent: 'lead' });

    // Step 2: Execute based on strategy
    let result;
    let success = false;

    switch (strategy.type) {
      case 'sequential':
        result = await this.executeSequential(taskBreakdown, timeline, agentContributions);
        break;
      case 'parallel':
        result = await this.executeParallel(taskBreakdown, timeline, agentContributions);
        break;
      case 'hierarchical':
        result = await this.executeHierarchical(taskBreakdown, timeline, agentContributions);
        break;
      case 'collaborative':
        result = await this.executeCollaborative(taskBreakdown, timeline, agentContributions);
        break;
    }

    success = result.success;

    // Step 3: Cross-validation if enabled
    if (strategy.crossValidation && success) {
      timeline.push({ timestamp: Date.now(), event: 'Cross-validation started', agent: 'reviewer' });
      const validation = await this.crossValidate(result, agentContributions);
      timeline.push({ timestamp: Date.now(), event: 'Cross-validation completed', agent: 'reviewer' });
      
      if (!validation.passed) {
        success = false;
        result.validationIssues = validation.issues;
      }
    }

    this.emit('taskCompleted', {
      success,
      result,
      taskBreakdown,
      agentContributions,
      timeline
    });

    return {
      success,
      result,
      taskBreakdown,
      agentContributions,
      timeline
    };
  }

  private async analyzeAndBreakdownTask(description: string, options: any): Promise<Task[]> {
    const analysisResult = await this.team.lead.processTask(
      `Analyze this task and break it down into smaller, manageable subtasks: ${description}
      
      Consider:
      - Required skills and roles
      - Task dependencies
      - Priority levels
      - Estimated complexity
      - Required tools and resources
      
      Available roles: ${Array.from(this.team.roles.keys()).join(', ')}`,
      { reasoning: true, maxSteps: 5 }
    );

    // Parse the breakdown into structured tasks
    return this.parseTaskBreakdown(analysisResult.result, description);
  }

  private parseTaskBreakdown(analysisResult: string, originalDescription: string): Task[] {
    const tasks: Task[] = [];
    const lines = analysisResult.split('\n');
    let currentTask: Partial<Task> = {};

    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('Task:') || trimmed.startsWith('-')) {
        if (currentTask.description) {
          tasks.push({
            id: `task-${tasks.length + 1}`,
            description: currentTask.description,
            priority: (currentTask.priority as any) || 'medium',
            dependencies: currentTask.dependencies || [],
            status: 'pending'
          });
        }
        
        currentTask = {
          description: trimmed.replace(/^(Task:|-)/, '').trim(),
          priority: 'medium',
          dependencies: []
        };
      } else if (trimmed.startsWith('Priority:')) {
        currentTask.priority = trimmed.replace('Priority:', '').trim().toLowerCase() as any;
      } else if (trimmed.startsWith('Depends on:')) {
        const deps = trimmed.replace('Depends on:', '').trim().split(',').map(d => d.trim());
        currentTask.dependencies = deps.filter(d => d.length > 0);
      }
    }

    if (currentTask.description) {
      tasks.push({
        id: `task-${tasks.length + 1}`,
        description: currentTask.description,
        priority: (currentTask.priority as any) || 'medium',
        dependencies: currentTask.dependencies || [],
        status: 'pending'
      });
    }

    return tasks.length > 0 ? tasks : [{
      id: 'task-1',
      description: originalDescription,
      priority: 'medium',
      dependencies: [],
      status: 'pending'
    }];
  }

  private async executeSequential(
    tasks: Task[], 
    timeline: Array<{ timestamp: number; event: string; agent: string }>,
    agentContributions: Map<string, any>
  ): Promise<{ success: boolean; results: any[] }> {
    const results: any[] = [];
    
    for (const task of tasks) {
      const agent = this.selectBestAgent(task);
      timeline.push({ timestamp: Date.now(), event: `Task started: ${task.description}`, agent });
      
      task.status = 'in_progress';
      task.startTime = Date.now();
      task.assignedAgent = agent;

      try {
        const result = await this.team.members.get(agent)!.processTask(task.description, {
          reasoning: true,
          maxSteps: 8
        });

        task.result = result;
        task.status = 'completed';
        task.endTime = Date.now();
        results.push(result);

        agentContributions.set(agent, {
          ...(agentContributions.get(agent) || {}),
          [task.id]: result
        });

        timeline.push({ timestamp: Date.now(), event: `Task completed: ${task.description}`, agent });
      } catch (error) {
        task.status = 'failed';
        task.result = { error: error.message };
        timeline.push({ timestamp: Date.now(), event: `Task failed: ${task.description}`, agent });
        
        if (!this.strategy.retryOnFailure) {
          return { success: false, results };
        }
      }
    }

    return { success: true, results };
  }

  private async executeParallel(
    tasks: Task[], 
    timeline: Array<{ timestamp: number; event: string; agent: string }>,
    agentContributions: Map<string, any>
  ): Promise<{ success: boolean; results: any[] }> {
    const maxConcurrency = this.strategy.maxConcurrency;
    const results: any[] = [];
    const activeTasks: Promise<any>[] = [];

    for (let i = 0; i < tasks.length; i += maxConcurrency) {
      const batch = tasks.slice(i, i + maxConcurrency);
      
      const batchPromises = batch.map(async (task) => {
        const agent = this.selectBestAgent(task);
        timeline.push({ timestamp: Date.now(), event: `Task started: ${task.description}`, agent });
        
        task.status = 'in_progress';
        task.startTime = Date.now();
        task.assignedAgent = agent;

        try {
          const result = await this.team.members.get(agent)!.processTask(task.description, {
            reasoning: true,
            maxSteps: 8
          });

          task.result = result;
          task.status = 'completed';
          task.endTime = Date.now();

          agentContributions.set(agent, {
            ...(agentContributions.get(agent) || {}),
            [task.id]: result
          });

          timeline.push({ timestamp: Date.now(), event: `Task completed: ${task.description}`, agent });
          return result;
        } catch (error) {
          task.status = 'failed';
          task.result = { error: error.message };
          timeline.push({ timestamp: Date.now(), event: `Task failed: ${task.description}`, agent });
          throw error;
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else if (!this.strategy.retryOnFailure) {
          return { success: false, results };
        }
      }
    }

    return { success: true, results };
  }

  private async executeHierarchical(
    tasks: Task[], 
    timeline: Array<{ timestamp: number; event: string; agent: string }>,
    agentContributions: Map<string, any>
  ): Promise<{ success: boolean; results: any[] }> {
    // Lead agent oversees and coordinates
    const results: any[] = [];
    
    // Execute high-priority tasks first
    const priorityOrder = ['urgent', 'high', 'medium', 'low'];
    const sortedTasks = tasks.sort((a, b) => {
      return priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
    });

    for (const task of sortedTasks) {
      const agent = this.selectBestAgent(task);
      
      // Lead agent provides guidance
      const guidance = await this.team.lead.processTask(
        `Provide guidance for this task: ${task.description}
        Agent: ${agent}
        Role: ${this.team.roles.get(agent)?.name}`,
        { reasoning: false, maxSteps: 3 }
      );

      timeline.push({ timestamp: Date.now(), event: `Guidance provided for: ${task.description}`, agent: 'lead' });
      timeline.push({ timestamp: Date.now(), event: `Task started: ${task.description}`, agent });

      task.status = 'in_progress';
      task.startTime = Date.now();
      task.assignedAgent = agent;

      try {
        const result = await this.team.members.get(agent)!.processTask(
          `${task.description}\n\nGuidance from lead: ${guidance.result}`,
          { reasoning: true, maxSteps: 8 }
        );

        task.result = result;
        task.status = 'completed';
        task.endTime = Date.now();
        results.push(result);

        agentContributions.set(agent, {
          ...(agentContributions.get(agent) || {}),
          [task.id]: result
        });

        timeline.push({ timestamp: Date.now(), event: `Task completed: ${task.description}`, agent });
      } catch (error) {
        task.status = 'failed';
        task.result = { error: error.message };
        timeline.push({ timestamp: Date.now(), event: `Task failed: ${task.description}`, agent });
        
        if (!this.strategy.retryOnFailure) {
          return { success: false, results };
        }
      }
    }

    return { success: true, results };
  }

  private async executeCollaborative(
    tasks: Task[], 
    timeline: Array<{ timestamp: number; event: string; agent: string }>,
    agentContributions: Map<string, any>
  ): Promise<{ success: boolean; results: any[] }> {
    const results: any[] = [];
    
    for (const task of tasks) {
      // Multiple agents collaborate on each task
      const primaryAgent = this.selectBestAgent(task);
      const secondaryAgent = this.selectSecondaryAgent(task, primaryAgent);
      
      timeline.push({ timestamp: Date.now(), event: `Collaborative task started: ${task.description}`, agent: primaryAgent });

      task.status = 'in_progress';
      task.startTime = Date.now();
      task.assignedAgent = primaryAgent;

      try {
        // Primary agent does initial work
        const primaryResult = await this.team.members.get(primaryAgent)!.processTask(
          task.description,
          { reasoning: true, maxSteps: 5 }
        );

        // Secondary agent reviews and improves
        const secondaryResult = await this.team.members.get(secondaryAgent)!.processTask(
          `Review and improve this work: ${primaryResult.result}
          Original task: ${task.description}`,
          { reasoning: true, maxSteps: 5 }
        );

        // Combine results
        const combinedResult = {
          primary: primaryResult,
          secondary: secondaryResult,
          final: secondaryResult.result
        };

        task.result = combinedResult;
        task.status = 'completed';
        task.endTime = Date.now();
        results.push(combinedResult);

        agentContributions.set(primaryAgent, {
          ...(agentContributions.get(primaryAgent) || {}),
          [task.id]: primaryResult
        });

        agentContributions.set(secondaryAgent, {
          ...(agentContributions.get(secondaryAgent) || {}),
          [task.id]: secondaryResult
        });

        timeline.push({ timestamp: Date.now(), event: `Collaborative task completed: ${task.description}`, agent: secondaryAgent });
      } catch (error) {
        task.status = 'failed';
        task.result = { error: error.message };
        timeline.push({ timestamp: Date.now(), event: `Task failed: ${task.description}`, agent: primaryAgent });
        
        if (!this.strategy.retryOnFailure) {
          return { success: false, results };
        }
      }
    }

    return { success: true, results };
  }

  private selectBestAgent(task: Task): string {
    const taskText = task.description.toLowerCase();
    
    // Simple heuristic-based selection
    if (taskText.includes('architecture') || taskText.includes('design') || taskText.includes('plan')) {
      return 'architect';
    }
    if (taskText.includes('test') || taskText.includes('quality') || taskText.includes('bug')) {
      return 'tester';
    }
    if (taskText.includes('document') || taskText.includes('readme') || taskText.includes('guide')) {
      return 'documenter';
    }
    if (taskText.includes('review') || taskText.includes('improve') || taskText.includes('refactor')) {
      return 'reviewer';
    }
    
    // Default to developer
    return 'developer';
  }

  private selectSecondaryAgent(task: Task, primaryAgent: string): string {
    const agents = Array.from(this.team.members.keys()).filter(agent => agent !== primaryAgent);
    
    // Select complementary agent
    if (primaryAgent === 'developer') return 'reviewer';
    if (primaryAgent === 'architect') return 'developer';
    if (primaryAgent === 'tester') return 'developer';
    if (primaryAgent === 'reviewer') return 'developer';
    if (primaryAgent === 'documenter') return 'reviewer';
    
    return agents[0];
  }

  private async crossValidate(result: any, agentContributions: Map<string, any>): Promise<{
    passed: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const reviewer = this.team.members.get('reviewer')!;
    
    const validation = await reviewer.processTask(
      `Cross-validate this work for quality, completeness, and correctness:
      
      Results: ${JSON.stringify(result, null, 2)}
      Agent contributions: ${JSON.stringify(Object.fromEntries(agentContributions), null, 2)}
      
      Provide:
      1. Pass/fail assessment
      2. List of issues found
      3. Recommendations for improvement`,
      { reasoning: true, maxSteps: 5 }
    );

    // Parse validation result
    const validationText = validation.result.toLowerCase();
    const passed = validationText.includes('pass') && !validationText.includes('fail');
    
    return {
      passed,
      issues: this.extractIssues(validation.result),
      recommendations: this.extractRecommendations(validation.result)
    };
  }

  private extractIssues(text: string): string[] {
    const lines = text.split('\n');
    const issues: string[] = [];
    
    for (const line of lines) {
      if (line.trim().startsWith('- ') && (line.toLowerCase().includes('issue') || line.toLowerCase().includes('problem'))) {
        issues.push(line.trim().substring(2));
      }
    }
    
    return issues;
  }

  private extractRecommendations(text: string): string[] {
    const lines = text.split('\n');
    const recommendations: string[] = [];
    
    for (const line of lines) {
      if (line.trim().startsWith('- ') && (line.toLowerCase().includes('recommend') || line.toLowerCase().includes('suggest'))) {
        recommendations.push(line.trim().substring(2));
      }
    }
    
    return recommendations;
  }

  // System prompts for different agent roles
  private getLeadSystemPrompt(): string {
    return `You are a Senior Engineering Manager leading a team of AI agents. Your role is to:
    - Analyze complex tasks and break them down into manageable subtasks
    - Coordinate team members and assign tasks based on their specializations
    - Provide guidance and oversight to ensure quality deliverables
    - Make high-level technical decisions
    - Ensure project timeline and scope are met
    
    Always think strategically and consider the bigger picture.`;
  }

  private getArchitectPrompt(): string {
    return `You are a Senior Software Architect. Your role is to:
    - Design system architecture and technical solutions
    - Make technology stack decisions
    - Define coding standards and best practices
    - Create technical specifications and documentation
    - Ensure scalability and maintainability
    
    Focus on long-term technical vision and architectural soundness.`;
  }

  private getDeveloperPrompt(): string {
    return `You are a Senior Software Developer. Your role is to:
    - Write clean, efficient, and well-documented code
    - Implement features according to specifications
    - Debug and fix issues
    - Optimize performance
    - Follow best practices and coding standards
    
    Focus on code quality, functionality, and maintainability.`;
  }

  private getTesterPrompt(): string {
    return `You are a Senior QA Engineer. Your role is to:
    - Create comprehensive test suites
    - Identify edge cases and potential issues
    - Ensure code quality and reliability
    - Write both unit and integration tests
    - Perform code quality analysis
    
    Focus on thorough testing and quality assurance.`;
  }

  private getReviewerPrompt(): string {
    return `You are a Senior Code Reviewer. Your role is to:
    - Review code for quality, security, and performance
    - Provide constructive feedback and suggestions
    - Ensure coding standards are followed
    - Identify potential improvements and refactoring opportunities
    - Verify that requirements are met
    
    Focus on code quality, security, and best practices.`;
  }

  private getDocumenterPrompt(): string {
    return `You are a Senior Technical Writer. Your role is to:
    - Create clear and comprehensive documentation
    - Write user guides and API documentation
    - Ensure documentation is up-to-date and accurate
    - Make technical content accessible to different audiences
    - Organize and structure information effectively
    
    Focus on clarity, completeness, and user experience.`;
  }

  // Public methods for monitoring and management
  async getTeamStatus(): Promise<{
    lead: any;
    members: Map<string, any>;
    activeTasks: number;
    completedTasks: number;
  }> {
    const leadStats = await this.team.lead.getMemoryStats();
    const memberStats = new Map();
    
    for (const [role, agent] of this.team.members) {
      memberStats.set(role, await agent.getMemoryStats());
    }

    return {
      lead: leadStats,
      members: memberStats,
      activeTasks: this.activeTasks.size,
      completedTasks: this.completedTasks.size
    };
  }

  async switchProviderForTeam(newConfig: any): Promise<void> {
    await this.team.lead.switchProvider(newConfig);
    
    for (const [role, agent] of this.team.members) {
      await agent.switchProvider(newConfig);
    }
  }
}
