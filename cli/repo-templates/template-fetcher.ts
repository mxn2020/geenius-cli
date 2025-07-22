// src/templates/template-fetcher.ts
import { Octokit } from 'octokit';
import { readFileSync } from 'fs';
import { join } from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import type { ProjectTemplate } from '../../src/types/template';

// Handle both CommonJS and ES modules
let __dirname: string;
try {
  // Try ES module approach first
  if (typeof import.meta !== 'undefined' && import.meta.url) {
    const __filename = fileURLToPath(import.meta.url);
    __dirname = dirname(__filename);
  } else {
    // Fallback to CommonJS
    __dirname = dirname(__filename);
  }
} catch (error) {
  // Final fallback - use process.cwd() relative path
  __dirname = process.cwd() + '/src/repo-templates';
}

export class TemplateFetcher {
  private octokit: Octokit;
  private registryUrl: string;

constructor(githubToken?: string, registryUrl?: string) {
  this.octokit = new Octokit({ auth: githubToken });
  this.registryUrl = registryUrl || 
    process.env.TEMPLATE_REGISTRY_URL || 
    'https://raw.githubusercontent.com/mxn2020/geenius/main/registry/main/template-registry.json';
}

  async fetchTemplateRegistry(): Promise<any> {
    try {
      const response = await fetch(this.registryUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch template registry: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.warn('Failed to fetch remote registry, using local fallback');
      try {
        const registryPath = join(__dirname, '../../registry/main/template-registry.json');
        const registryContent = readFileSync(registryPath, 'utf8');
        return JSON.parse(registryContent);
      } catch (readError) {
        console.error('Failed to read local registry:', readError);
        return { templates: [] };
      }
    }
  }

  async getTemplateInfo(repoUrl: string): Promise<{
    name: string;
    description: string;
    lastUpdated: string;
    stars: number;
    forks: number;
    openIssues: number;
  }> {
    const { owner, repo } = this.parseRepoUrl(repoUrl);
    
    const { data } = await this.octokit.rest.repos.get({
      owner,
      repo
    });

    return {
      name: data.name,
      description: data.description || '',
      lastUpdated: data.updated_at,
      stars: data.stargazers_count,
      forks: data.forks_count,
      openIssues: data.open_issues_count
    };
  }

  async validateTemplate(repoUrl: string): Promise<{
    valid: boolean;
    issues: string[];
    score: number;
  }> {
    const { owner, repo } = this.parseRepoUrl(repoUrl);
    const issues: string[] = [];
    let score = 100;

    try {
      // Check if repo exists and is accessible
      await this.octokit.rest.repos.get({ owner, repo });
    } catch (error) {
      issues.push('Repository not found or not accessible');
      return { valid: false, issues, score: 0 };
    }

    // Check required files
    const requiredFiles = [
      'package.json',
      'README.md',
      '.env.example',
      'tsconfig.json'
    ];

    for (const file of requiredFiles) {
      try {
        await this.octokit.rest.repos.getContent({
          owner,
          repo,
          path: file
        });
      } catch (error) {
        issues.push(`Missing required file: ${file}`);
        score -= 20;
      }
    }

    // Check package.json structure
    try {
      const { data: packageData } = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path: 'package.json'
      });

      if ('content' in packageData) {
        const packageJson = JSON.parse(
          Buffer.from(packageData.content, 'base64').toString()
        );

        if (!packageJson.scripts?.dev) {
          issues.push('Missing dev script in package.json');
          score -= 10;
        }
        if (!packageJson.scripts?.build) {
          issues.push('Missing build script in package.json');
          score -= 10;
        }
        if (!packageJson.scripts?.test) {
          issues.push('Missing test script in package.json');
          score -= 10;
        }
      }
    } catch (error) {
      issues.push('Cannot parse package.json');
      score -= 30;
    }

    // Check for tests directory
    try {
      await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path: 'tests'
      });
    } catch (error) {
      try {
        await this.octokit.rest.repos.getContent({
          owner,
          repo,
          path: '__tests__'
        });
      } catch (error) {
        issues.push('No tests directory found');
        score -= 15;
      }
    }

    return {
      valid: score >= 60,
      issues,
      score
    };
  }

  async getTemplateReadme(repoUrl: string): Promise<string> {
    const { owner, repo } = this.parseRepoUrl(repoUrl);
    
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path: 'README.md'
      });

      if ('content' in data) {
        return Buffer.from(data.content, 'base64').toString();
      }
    } catch (error) {
      console.warn('Failed to fetch README:', error);
    }
    
    return '';
  }

  async searchTemplates(query: string, filters: {
    stack?: string[];
    aiProvider?: string;
    difficulty?: string;
    tags?: string[];
  } = {}): Promise<ProjectTemplate[]> {
    const registry = await this.fetchTemplateRegistry();
    let templates = registry.templates;

    // Apply filters
    if (filters.stack?.length) {
      templates = templates.filter(t => 
        filters.stack.some(stack => t.stack.includes(stack))
      );
    }

    if (filters.aiProvider) {
      templates = templates.filter(t => t.aiProvider === filters.aiProvider);
    }

    if (filters.difficulty) {
      templates = templates.filter(t => t.difficulty === filters.difficulty);
    }

    if (filters.tags?.length) {
      templates = templates.filter(t => 
        filters.tags.some(tag => t.tags.includes(tag))
      );
    }

    // Apply search query
    if (query) {
      const searchTerm = query.toLowerCase();
      templates = templates.filter(t => 
        t.name.toLowerCase().includes(searchTerm) ||
        t.description.toLowerCase().includes(searchTerm) ||
        t.stack.some(s => s.toLowerCase().includes(searchTerm)) ||
        t.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      );
    }

    return templates;
  }

  private parseRepoUrl(repoUrl: string): { owner: string; repo: string } {
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new Error('Invalid GitHub repository URL');
    }
    return { owner: match[1], repo: match[2] };
  }
}

