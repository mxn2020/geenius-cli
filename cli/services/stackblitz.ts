// src/services/stackblitz.ts
// Note: StackBlitz SDK is browser-only, so we'll create a mock for server-side usage

interface StackBlitzProject {
  id: string;
  url: string;
  vm: any;
}

interface CommandResult {
  output: string;
  exitCode: number;
}

export class StackBlitzService {
  async createFromGitHub(repoUrl: string, branch: string = 'main'): Promise<StackBlitzProject> {
    const repoMatch = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!repoMatch) {
      throw new Error('Invalid GitHub repository URL');
    }

    const [, owner, repo] = repoMatch;
    const projectId = `${owner}-${repo}-${branch}-${Date.now()}`;

    // For server-side usage, we'll create a mock project
    // In a real browser environment, this would use the StackBlitz SDK
    return {
      id: projectId,
      url: `https://stackblitz.com/github/${owner}/${repo}`,
      vm: null // Mock VM for server-side
    };
  }

  async switchToBranch(project: StackBlitzProject, branch: string): Promise<void> {
    // Mock implementation for server-side
    console.log(`Mock: Switching to branch ${branch} for project ${project.id}`);
  }

  async runCommand(project: StackBlitzProject, command: string): Promise<CommandResult> {
    // Mock implementation for server-side
    console.log(`Mock: Running command "${command}" for project ${project.id}`);
    return {
      output: `Mock output for command: ${command}`,
      exitCode: 0
    };
  }

  async installDependencies(project: StackBlitzProject): Promise<CommandResult> {
    return this.runCommand(project, 'npm install');
  }

  async readFile(project: StackBlitzProject, filePath: string): Promise<string> {
    // Mock implementation for server-side
    console.log(`Mock: Reading file ${filePath} for project ${project.id}`);
    return `Mock content for ${filePath}`;
  }

  async writeFile(project: StackBlitzProject, filePath: string, content: string): Promise<void> {
    // Mock implementation for server-side
    console.log(`Mock: Writing file ${filePath} for project ${project.id}`);
  }

  async deleteFile(project: StackBlitzProject, filePath: string): Promise<void> {
    // Mock implementation for server-side
    console.log(`Mock: Deleting file ${filePath} for project ${project.id}`);
  }

  async listFiles(project: StackBlitzProject, dirPath: string = '.'): Promise<string[]> {
    // Mock implementation for server-side
    console.log(`Mock: Listing files in ${dirPath} for project ${project.id}`);
    return ['package.json', 'src/index.ts', 'README.md'];
  }

  async getProjectInfo(project: StackBlitzProject): Promise<{
    dependencies: Record<string, string>;
    scripts: Record<string, string>;
    framework: string;
  }> {
    // Mock implementation for server-side
    console.log(`Mock: Getting project info for ${project.id}`);
    return {
      dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' },
      scripts: { dev: 'vite', build: 'vite build' },
      framework: 'react'
    };
  }

  async startDevServer(project: StackBlitzProject): Promise<string> {
    // Mock implementation for server-side
    console.log(`Mock: Starting dev server for project ${project.id}`);
    return `https://${project.id}.stackblitz.io`;
  }

  async loadProject(projectId: string): Promise<StackBlitzProject> {
    // Mock implementation for server-side
    console.log(`Mock: Loading project ${projectId}`);
    return {
      id: projectId,
      url: `https://stackblitz.com/edit/${projectId}`,
      vm: null
    };
  }

  async createSnapshot(project: StackBlitzProject): Promise<string> {
    // Mock implementation for server-side
    console.log(`Mock: Creating snapshot for project ${project.id}`);
    return `snapshot-${Date.now()}`;
  }

  async restoreSnapshot(project: StackBlitzProject, snapshotId: string): Promise<void> {
    // Mock implementation for server-side
    console.log(`Mock: Restoring snapshot ${snapshotId} for project ${project.id}`);
  }
}