// src/repo-templates/index.ts
import { TemplateFetcher } from './template-fetcher';
import type { ProjectTemplate } from '../../src/types/template';

export class TemplateRegistry {
  private fetcher: TemplateFetcher;
  private cache: Map<string, ProjectTemplate[]> = new Map();
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutes

  constructor(githubToken?: string) {
    this.fetcher = new TemplateFetcher(githubToken);
  }

  async getAllTemplates(): Promise<ProjectTemplate[]> {
    const cached = this.cache.get('all');
    if (cached) return cached;

    const registry = await this.fetcher.fetchTemplateRegistry();
    const templates = registry.templates;
    
    this.cache.set('all', templates);
    setTimeout(() => this.cache.delete('all'), this.cacheExpiry);
    
    return templates;
  }

  async getTemplateById(id: string): Promise<ProjectTemplate | null> {
    const templates = await this.getAllTemplates();
    return templates.find(t => t.id === id) || null;
  }

  async getTemplatesByProvider(provider: string): Promise<ProjectTemplate[]> {
    const templates = await this.getAllTemplates();
    // Since we removed aiProvider from templates, return all templates
    // User will configure AI provider in settings
    return templates;
  }

  async getTemplatesByCategory(category: string): Promise<ProjectTemplate[]> {
    const registry = await this.fetcher.fetchTemplateRegistry();
    const categoryData = registry.categories.find(c => c.id === category);
    
    if (!categoryData) return [];

    const templates = await this.getAllTemplates();
    return templates.filter(t => categoryData.templates.includes(t.id));
  }

  async searchTemplates(query: string, filters: any = {}): Promise<ProjectTemplate[]> {
    return this.fetcher.searchTemplates(query, filters);
  }

  async validateTemplate(repoUrl: string): Promise<any> {
    return this.fetcher.validateTemplate(repoUrl);
  }

  async getTemplateInfo(repoUrl: string): Promise<any> {
    return this.fetcher.getTemplateInfo(repoUrl);
  }
}

export { TemplateFetcher };
export * from '../../src/types/template';