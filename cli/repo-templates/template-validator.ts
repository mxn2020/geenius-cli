// src/templates/template-validator.ts
import { z } from 'zod';
import { TemplateFetcher } from './template-fetcher';
import type { ProjectTemplate } from '../../src/types/template';

const TemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(10),
  repository: z.string().url(),
  branch: z.string().default('main'),
  stack: z.array(z.string()).min(1),
  aiProvider: z.enum(['anthropic', 'openai', 'google', 'grok']),
  aiConfig: z.object({
    model: z.string(),
    tools: z.array(z.string()),
    systemPrompt: z.string()
  }),
  features: z.array(z.string()).min(1),
  envVars: z.array(z.string()),
  testCommand: z.string(),
  buildCommand: z.string(),
  devCommand: z.string(),
  deployCommand: z.string(),
  documentation: z.string().url(),
  tags: z.array(z.string()),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  lastUpdated: z.string(),
  maintainer: z.string(),
  license: z.string()
});

export class TemplateValidator {
  private fetcher: TemplateFetcher;

  constructor(githubToken?: string) {
    this.fetcher = new TemplateFetcher(githubToken);
  }

  /**
   * Validate a template configuration object
   */
  validateTemplateConfig(template: any): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      TemplateSchema.parse(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push(...error.errors.map(e => `${e.path.join('.')}: ${e.message}`));
      } else {
        errors.push('Unknown validation error');
      }
    }

    // Additional custom validations
    if (template.stack && template.stack.length > 8) {
      warnings.push('Stack has many technologies - consider simplifying');
    }

    if (template.envVars && template.envVars.length > 15) {
      warnings.push('Many environment variables - consider consolidating');
    }

    if (template.features && template.features.length < 3) {
      warnings.push('Template should highlight more features');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate a template repository structure
   */
  async validateTemplateRepository(repoUrl: string): Promise<{
    valid: boolean;
    score: number;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    try {
      // Use the fetcher's validation
      const basicValidation = await this.fetcher.validateTemplate(repoUrl);
      issues.push(...basicValidation.issues);
      score = basicValidation.score;

      // Additional comprehensive checks
      const additionalChecks = await this.performAdditionalChecks(repoUrl);
      issues.push(...additionalChecks.issues);
      recommendations.push(...additionalChecks.recommendations);
      score = Math.max(0, score - additionalChecks.penalties);

    } catch (error) {
      issues.push(`Repository validation failed: ${error.message}`);
      score = 0;
    }

    return {
      valid: score >= 70,
      score,
      issues,
      recommendations
    };
  }

  /**
   * Validate template registry consistency
   */
  async validateTemplateRegistry(registry: any): Promise<{
    valid: boolean;
    issues: string[];
    warnings: string[];
    duplicates: string[];
  }> {
    const issues: string[] = [];
    const warnings: string[] = [];
    const duplicates: string[] = [];

    if (!registry.templates || !Array.isArray(registry.templates)) {
      issues.push('Registry must have a templates array');
      return { valid: false, issues, warnings, duplicates };
    }

    // Check for duplicate IDs
    const ids = new Set<string>();
    for (const template of registry.templates) {
      if (ids.has(template.id)) {
        duplicates.push(template.id);
      }
      ids.add(template.id);
    }

    // Check for duplicate repositories
    const repos = new Set<string>();
    for (const template of registry.templates) {
      if (repos.has(template.repository)) {
        duplicates.push(`Repository: ${template.repository}`);
      }
      repos.add(template.repository);
    }

    // Validate each template
    for (const template of registry.templates) {
      const validation = this.validateTemplateConfig(template);
      if (!validation.valid) {
        issues.push(`Template ${template.id}: ${validation.errors.join(', ')}`);
      }
      if (validation.warnings.length > 0) {
        warnings.push(`Template ${template.id}: ${validation.warnings.join(', ')}`);
      }
    }

    // Check categories
    if (registry.categories) {
      for (const category of registry.categories) {
        if (!category.id || !category.name) {
          issues.push(`Category missing id or name: ${JSON.stringify(category)}`);
        }
        
        if (category.templates) {
          for (const templateId of category.templates) {
            if (!registry.templates.find(t => t.id === templateId)) {
              issues.push(`Category ${category.id} references non-existent template: ${templateId}`);
            }
          }
        }
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings,
      duplicates
    };
  }

  /**
   * Generate template health report
   */
  async generateTemplateHealthReport(templates: ProjectTemplate[]): Promise<{
    healthy: number;
    warning: number;
    critical: number;
    details: Array<{
      template: string;
      status: 'healthy' | 'warning' | 'critical';
      issues: string[];
      score: number;
    }>;
  }> {
    const details: Array<{
      template: string;
      status: 'healthy' | 'warning' | 'critical';
      issues: string[];
      score: number;
    }> = [];

    let healthy = 0;
    let warning = 0;
    let critical = 0;

    for (const template of templates) {
      try {
        const validation = await this.validateTemplateRepository(template.repository);
        
        let status: 'healthy' | 'warning' | 'critical';
        if (validation.score >= 90) {
          status = 'healthy';
          healthy++;
        } else if (validation.score >= 70) {
          status = 'warning';
          warning++;
        } else {
          status = 'critical';
          critical++;
        }

        details.push({
          template: template.name,
          status,
          issues: validation.issues,
          score: validation.score
        });

      } catch (error) {
        details.push({
          template: template.name,
          status: 'critical',
          issues: [error.message],
          score: 0
        });
        critical++;
      }
    }

    return {
      healthy,
      warning,
      critical,
      details
    };
  }

  /**
   * Suggest improvements for a template
   */
  async suggestTemplateImprovements(template: ProjectTemplate): Promise<{
    improvements: string[];
    optimizations: string[];
    modernizations: string[];
  }> {
    const improvements: string[] = [];
    const optimizations: string[] = [];
    const modernizations: string[] = [];

    // Check for outdated dependencies
    if (template.lastUpdated) {
      const lastUpdate = new Date(template.lastUpdated);
      const monthsOld = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24 * 30);
      
      if (monthsOld > 6) {
        improvements.push('Template is over 6 months old - consider updating dependencies');
      }
    }

    // Check stack for modern alternatives
    if (template.stack.includes('webpack')) {
      modernizations.push('Consider migrating from webpack to Vite for faster builds');
    }

    if (template.stack.includes('Jest')) {
      modernizations.push('Consider migrating from Jest to Vitest for better performance');
    }

    // Check for missing modern features
    if (!template.stack.includes('TypeScript')) {
      improvements.push('Consider adding TypeScript support');
    }

    if (!template.stack.includes('ESLint')) {
      improvements.push('Consider adding ESLint for code quality');
    }

    if (!template.stack.includes('Prettier')) {
      improvements.push('Consider adding Prettier for code formatting');
    }

    // Performance optimizations
    if (template.stack.includes('React') && !template.stack.includes('React 18')) {
      optimizations.push('Upgrade to React 18 for better performance');
    }

    if (template.envVars.length > 10) {
      optimizations.push('Consider consolidating environment variables');
    }

    return {
      improvements,
      optimizations,
      modernizations
    };
  }

  private async performAdditionalChecks(repoUrl: string): Promise<{
    issues: string[];
    recommendations: string[];
    penalties: number;
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let penalties = 0;

    try {
      // Check for GitHub Actions
      const { owner, repo } = this.parseRepoUrl(repoUrl);
      
      try {
        await this.fetcher['octokit'].rest.repos.getContent({
          owner,
          repo,
          path: '.github/workflows'
        });
      } catch (error) {
        recommendations.push('Consider adding GitHub Actions for CI/CD');
        penalties += 5;
      }

      // Check for license
      try {
        await this.fetcher['octokit'].rest.repos.getContent({
          owner,
          repo,
          path: 'LICENSE'
        });
      } catch (error) {
        issues.push('Missing LICENSE file');
        penalties += 10;
      }

      // Check for contributing guidelines
      try {
        await this.fetcher['octokit'].rest.repos.getContent({
          owner,
          repo,
          path: 'CONTRIBUTING.md'
        });
      } catch (error) {
        recommendations.push('Consider adding CONTRIBUTING.md');
        penalties += 5;
      }

      // Check for security policy
      try {
        await this.fetcher['octokit'].rest.repos.getContent({
          owner,
          repo,
          path: 'SECURITY.md'
        });
      } catch (error) {
        recommendations.push('Consider adding SECURITY.md');
        penalties += 3;
      }

      // Check for code of conduct
      try {
        await this.fetcher['octokit'].rest.repos.getContent({
          owner,
          repo,
          path: 'CODE_OF_CONDUCT.md'
        });
      } catch (error) {
        recommendations.push('Consider adding CODE_OF_CONDUCT.md');
        penalties += 2;
      }

    } catch (error) {
      issues.push(`Failed to perform additional checks: ${error.message}`);
      penalties += 20;
    }

    return { issues, recommendations, penalties };
  }

  private parseRepoUrl(repoUrl: string): { owner: string; repo: string } {
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new Error('Invalid GitHub repository URL');
    }
    return { owner: match[1], repo: match[2] };
  }
}