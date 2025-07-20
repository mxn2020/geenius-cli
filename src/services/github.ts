// src/services/github.ts
import { Octokit } from 'octokit';

export class GitHubService {
  private octokit: Octokit;

  constructor() {
    if (!process.env.GITHUB_TOKEN) {
      throw new Error('GITHUB_TOKEN environment variable is required. Please set it with your GitHub personal access token.');
    }
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });
  }

  async forkTemplate(templateRepo: string, projectName: string, org: string): Promise<string> {
    const { owner: templateOwner, repo: templateName } = this.parseRepoUrl(templateRepo);
    
    // Check if org is actually an organization or a user account
    let forkParams: any = {
      owner: templateOwner,
      repo: templateName
    };

    try {
      // Try to get organization info
      await this.octokit.rest.orgs.get({ org });
      // If successful, it's an organization
      forkParams.organization = org;
    } catch (error) {
      // If it fails, it's likely a user account - don't include organization parameter
      // The fork will be created under the authenticated user's account
    }
    
    // Fork the template repository
    const { data: fork } = await this.octokit.rest.repos.createFork(forkParams);

    // Wait for fork to be ready
    await this.waitForRepo(fork.owner.login, fork.name);

    // Always find an available name to ensure we create a new repo
    const finalRepoName = await this.findAvailableRepoName(fork.owner.login, projectName);
    
    // Rename the forked repository to the available name
    if (fork.name !== finalRepoName) {
      await this.octokit.rest.repos.update({
        owner: fork.owner.login,
        repo: fork.name,
        name: finalRepoName
      });
    }
    
    // Set up branch protection and default branches
    await this.setupBranches(fork.owner.login, finalRepoName);

    // Return the correct URL with the final name
    return `https://github.com/${fork.owner.login}/${finalRepoName}`;
  }

  async setupBranches(owner: string, repo: string) {
    try {
      // Create develop branch from main
      const { data: mainBranch } = await this.octokit.rest.repos.getBranch({
        owner,
        repo,
        branch: 'main'
      });

      // Check if develop branch already exists (inherited from template)
      try {
        await this.octokit.rest.repos.getBranch({
          owner,
          repo,
          branch: 'develop'
        });
        // Branch exists from template - this is normal and expected
      } catch (error) {
        // Branch doesn't exist, create it
        try {
          await this.octokit.rest.git.createRef({
            owner,
            repo,
            ref: 'refs/heads/develop',
            sha: mainBranch.commit.sha
          });
        } catch (createError) {
          console.warn(`Could not create develop branch: ${createError.message}`);
        }
      }

      // Set up branch protection for main (optional, may fail for personal repos)
      try {
        await this.octokit.rest.repos.updateBranchProtection({
          owner,
          repo,
          branch: 'main',
          required_status_checks: {
            strict: true,
            contexts: ['netlify/build']
          },
          enforce_admins: false,
          required_pull_request_reviews: {
            required_approving_review_count: 1,
            dismiss_stale_reviews: true
          },
          restrictions: null
        });
      } catch (error) {
        // Branch protection may fail for personal repos or insufficient permissions
        console.log('Branch protection setup skipped (may require organization or pro account)');
      }
    } catch (error) {
      console.warn('Branch setup failed:', error.message);
    }
  }

  async createBranch(repoUrl: string, branchName: string, baseBranch: string = 'main'): Promise<void> {
    const { owner, repo } = this.parseRepoUrl(repoUrl);

    // Get base branch SHA
    const { data: baseBranchData } = await this.octokit.rest.repos.getBranch({
      owner,
      repo,
      branch: baseBranch
    });

    // Create new branch
    await this.octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: baseBranchData.commit.sha
    });
  }

  async createPullRequest(repoUrl: string, options: {
    head: string;
    base: string;
    title: string;
    body: string;
  }) {
    const { owner, repo } = this.parseRepoUrl(repoUrl);

    const { data: pr } = await this.octokit.rest.pulls.create({
      owner,
      repo,
      head: options.head,
      base: options.base,
      title: options.title,
      body: options.body
    });

    return pr;
  }

  async commitFiles(repoUrl: string, branch: string, files: Array<{
    path: string;
    content: string;
  }>, message: string) {
    const { owner, repo } = this.parseRepoUrl(repoUrl);

    // Get current branch reference
    const { data: ref } = await this.octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`
    });

    // Get current commit
    const { data: commit } = await this.octokit.rest.git.getCommit({
      owner,
      repo,
      commit_sha: ref.object.sha
    });

    // Create blobs for each file
    const blobs = await Promise.all(
      files.map(async (file) => {
        const { data: blob } = await this.octokit.rest.git.createBlob({
          owner,
          repo,
          content: Buffer.from(file.content).toString('base64'),
          encoding: 'base64'
        });
        return {
          path: file.path,
          mode: '100644' as const,
          type: 'blob' as const,
          sha: blob.sha
        };
      })
    );

    // Create tree
    const { data: tree } = await this.octokit.rest.git.createTree({
      owner,
      repo,
      base_tree: commit.tree.sha,
      tree: blobs
    });

    // Create commit
    const { data: newCommit } = await this.octokit.rest.git.createCommit({
      owner,
      repo,
      message,
      tree: tree.sha,
      parents: [commit.sha]
    });

    // Update reference
    await this.octokit.rest.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: newCommit.sha
    });

    return newCommit;
  }

  async getFileContent(repoUrl: string, filePath: string, branch: string = 'main'): Promise<string> {
    const { owner, repo } = this.parseRepoUrl(repoUrl);

    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref: branch
      });

      if ('content' in data) {
        return Buffer.from(data.content, 'base64').toString();
      }
      throw new Error('File not found or is a directory');
    } catch (error) {
      if (error.status === 404) {
        return ''; // File doesn't exist
      }
      throw error;
    }
  }

  async listFiles(repoUrl: string, path: string = '', branch: string = 'main'): Promise<string[]> {
    const { owner, repo } = this.parseRepoUrl(repoUrl);

    const { data } = await this.octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref: branch
    });

    if (Array.isArray(data)) {
      return data.map(item => item.name);
    }
    return [];
  }

  async getBranches(repoUrl: string): Promise<string[]> {
    const { owner, repo } = this.parseRepoUrl(repoUrl);

    const { data } = await this.octokit.rest.repos.listBranches({
      owner,
      repo
    });

    return data.map(branch => branch.name);
  }

  // Netlify integration methods
  async getRepositoryId(owner: string, repo: string): Promise<number> {
    try {
      const { data } = await this.octokit.rest.repos.get({
        owner,
        repo
      });
      return data.id;
    } catch (error: any) {
      if (error.status === 404) {
        throw new Error(`Repository ${owner}/${repo} not found or not accessible`);
      }
      throw new Error(`Failed to get repository ID: ${error.message}`);
    }
  }

  async addDeployKey(owner: string, repo: string, publicKey: string, title: string): Promise<void> {
    try {
      await this.octokit.rest.repos.createDeployKey({
        owner,
        repo,
        title,
        key: publicKey,
        read_only: true
      });
      console.log('   Deploy key successfully added to GitHub');
    } catch (error: any) {
      if (error.status === 422 && error.response?.data?.errors?.some((e: any) => e.message?.includes('key is already in use'))) {
        console.log('   Deploy key already exists, continuing...');
        return;
      }
      console.error('❌ Error adding deploy key to GitHub:', error.message);
      throw new Error(`Failed to add deploy key to GitHub: ${error.message}`);
    }
  }

  async removeDeployKey(owner: string, repo: string, keyId: number): Promise<void> {
    try {
      console.log(`🔑 Removing deploy key ${keyId} from ${owner}/${repo}`);
      await this.octokit.rest.repos.deleteDeployKey({
        owner,
        repo,
        key_id: keyId
      });
      console.log('✅ Deploy key removed from GitHub repository');
    } catch (error: any) {
      console.warn('⚠️  Could not remove deploy key:', error.message);
      // Don't throw here as this is cleanup
    }
  }

  async deleteRepository(ownerOrUrl: string, repo?: string): Promise<void> {
    try {
      let owner: string;
      let repoName: string;
      
      if (repo) {
        // Called with separate owner and repo parameters
        owner = ownerOrUrl;
        repoName = repo;
      } else {
        // Called with URL parameter
        const parsed = this.parseRepoUrl(ownerOrUrl);
        owner = parsed.owner;
        repoName = parsed.repo;
      }
      
      console.log(`🗑️  Deleting GitHub repository ${owner}/${repoName}`);
      
      await this.octokit.rest.repos.delete({
        owner,
        repo: repoName
      });
      
      console.log('✅ GitHub repository deleted successfully');
    } catch (error: any) {
      console.error('❌ Error deleting GitHub repository:', error.message);
      throw new Error(`Failed to delete GitHub repository: ${error.message}`);
    }
  }

  private parseRepoUrl(repoUrl: string): { owner: string; repo: string } {
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new Error('Invalid GitHub repository URL');
    }
    // Remove .git suffix if present
    const repo = match[2].replace(/\.git$/, '');
    return { owner: match[1], repo };
  }

  private async waitForRepo(owner: string, repo: string, maxAttempts: number = 10): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        await this.octokit.rest.repos.get({ owner, repo });
        return; // Repo is ready
      } catch (error) {
        if (i === maxAttempts - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  private async findAvailableRepoName(owner: string, baseName: string): Promise<string> {
    const randomWords = [
      'alpha', 'beta', 'gamma', 'delta', 'echo', 'foxtrot', 'golf', 'hotel',
      'india', 'juliet', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa',
      'quebec', 'romeo', 'sierra', 'tango', 'uniform', 'victor', 'whiskey',
      'xray', 'yankee', 'zulu', 'fire', 'earth', 'water', 'wind', 'storm',
      'cloud', 'star', 'moon', 'sun', 'sky', 'ocean', 'forest', 'mountain'
    ];

    // First try the base name
    if (await this.isRepoNameAvailable(owner, baseName)) {
      return baseName;
    }

    // Try with random words
    for (let i = 0; i < 10; i++) {
      const randomWord = randomWords[Math.floor(Math.random() * randomWords.length)];
      const newName = `${baseName}-${randomWord}`;
      
      if (await this.isRepoNameAvailable(owner, newName)) {
        return newName;
      }
    }

    // Fallback to timestamp
    const timestamp = Date.now().toString(36);
    return `${baseName}-${timestamp}`;
  }

  private async isRepoNameAvailable(owner: string, name: string): Promise<boolean> {
    try {
      await this.octokit.rest.repos.get({ owner, repo: name });
      return false; // Repo exists
    } catch (error) {
      if (error.status === 404) {
        return true; // Repo doesn't exist, name is available
      }
      throw error; // Other error
    }
  }

  async listRepositories(): Promise<any[]> {
    try {
      const { data } = await this.octokit.rest.repos.listForAuthenticatedUser({
        visibility: 'all',
        sort: 'updated',
        per_page: 100
      });
      return data;
    } catch (error: any) {
      console.error('❌ Error listing repositories:', error.message);
      throw new Error(`Failed to list repositories: ${error.message}`);
    }
  }

  async updateRepository(owner: string, repo: string, updates: any): Promise<any> {
    try {
      const { data } = await this.octokit.rest.repos.update({
        owner,
        repo,
        ...updates
      });
      return data;
    } catch (error: any) {
      console.error('❌ Error updating repository:', error.message);
      throw new Error(`Failed to update repository: ${error.message}`);
    }
  }


  async listDeployKeys(owner: string, repo: string): Promise<any[]> {
    try {
      const { data } = await this.octokit.rest.repos.listDeployKeys({
        owner,
        repo
      });
      return data;
    } catch (error: any) {
      console.error('❌ Error listing deploy keys:', error.message);
      throw new Error(`Failed to list deploy keys: ${error.message}`);
    }
  }

  async deleteDeployKey(owner: string, repo: string, keyId: number): Promise<void> {
    try {
      await this.octokit.rest.repos.deleteDeployKey({
        owner,
        repo,
        key_id: keyId
      });
    } catch (error: any) {
      console.error('❌ Error deleting deploy key:', error.message);
      throw new Error(`Failed to delete deploy key: ${error.message}`);
    }
  }

  async renameRepository(owner: string, repo: string, newName: string): Promise<void> {
    try {
      await this.octokit.rest.repos.update({
        owner,
        repo,
        name: newName
      });
    } catch (error: any) {
      console.error('❌ Error renaming repository:', error.message);
      throw new Error(`Failed to rename repository: ${error.message}`);
    }
  }

  async getRepository(owner: string, repo: string): Promise<any> {
    try {
      const { data } = await this.octokit.rest.repos.get({
        owner,
        repo
      });
      return data;
    } catch (error: any) {
      console.error('❌ Error getting repository:', error.message);
      throw new Error(`Failed to get repository: ${error.message}`);
    }
  }

  async listBranches(owner: string, repo: string): Promise<any[]> {
    try {
      const { data } = await this.octokit.rest.repos.listBranches({
        owner,
        repo,
        per_page: 100
      });
      return data;
    } catch (error: any) {
      console.error('❌ Error listing branches:', error.message);
      throw new Error(`Failed to list branches: ${error.message}`);
    }
  }
}