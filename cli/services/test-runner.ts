// src/services/test-runner.ts
import { GitHubService } from './github';
import { StackBlitzService } from './stackblitz';

interface TestResult {
  success: boolean;
  output: string;
  coverage?: number;
  failedTests?: string[];
}

export class TestRunner {
  private github: GitHubService;
  private stackblitz: StackBlitzService;

  constructor() {
    this.github = new GitHubService();
    this.stackblitz = new StackBlitzService();
  }

  async runTests(repoUrl: string, branch: string): Promise<TestResult> {
    try {
      // Get the test command from package.json
      const packageJson = await this.github.getFileContent(repoUrl, 'package.json', branch);
      const pkg = JSON.parse(packageJson);
      const testCommand = pkg.scripts?.test || 'npm test';

      // Create a temporary StackBlitz project to run tests
      const project = await this.stackblitz.createFromGitHub(repoUrl, branch);
      
      // Run the test command
      const result = await this.stackblitz.runCommand(project, testCommand);

      // Parse test results
      const testResult = this.parseTestOutput(result.output);

      return {
        success: testResult.success,
        output: result.output,
        coverage: testResult.coverage,
        failedTests: testResult.failedTests
      };

    } catch (error) {
      return {
        success: false,
        output: `Test execution failed: ${error.message}`,
        failedTests: ['Test execution error']
      };
    }
  }

  async runSpecificTest(repoUrl: string, branch: string, testFile: string): Promise<TestResult> {
    try {
      const packageJson = await this.github.getFileContent(repoUrl, 'package.json', branch);
      const pkg = JSON.parse(packageJson);
      
      // Determine test framework and run specific test
      let testCommand: string;
      if (pkg.dependencies?.vitest || pkg.devDependencies?.vitest) {
        testCommand = `npx vitest run ${testFile}`;
      } else if (pkg.dependencies?.jest || pkg.devDependencies?.jest) {
        testCommand = `npx jest ${testFile}`;
      } else {
        testCommand = `npm test -- ${testFile}`;
      }

      const project = await this.stackblitz.createFromGitHub(repoUrl, branch);
      const result = await this.stackblitz.runCommand(project, testCommand);

      return {
        success: result.exitCode === 0,
        output: result.output
      };

    } catch (error) {
      return {
        success: false,
        output: `Test execution failed: ${error.message}`
      };
    }
  }

  async runLinting(repoUrl: string, branch: string): Promise<TestResult> {
    try {
      const packageJson = await this.github.getFileContent(repoUrl, 'package.json', branch);
      const pkg = JSON.parse(packageJson);
      
      const lintCommand = pkg.scripts?.lint || 'npm run lint';
      const project = await this.stackblitz.createFromGitHub(repoUrl, branch);
      const result = await this.stackblitz.runCommand(project, lintCommand);

      return {
        success: result.exitCode === 0,
        output: result.output
      };

    } catch (error) {
      return {
        success: false,
        output: `Linting failed: ${error.message}`
      };
    }
  }

  async runTypeCheck(repoUrl: string, branch: string): Promise<TestResult> {
    try {
      const packageJson = await this.github.getFileContent(repoUrl, 'package.json', branch);
      const pkg = JSON.parse(packageJson);
      
      let typeCheckCommand: string;
      if (pkg.scripts?.['type-check']) {
        typeCheckCommand = 'npm run type-check';
      } else if (pkg.devDependencies?.typescript) {
        typeCheckCommand = 'npx tsc --noEmit';
      } else {
        return { success: true, output: 'No TypeScript configuration found' };
      }

      const project = await this.stackblitz.createFromGitHub(repoUrl, branch);
      const result = await this.stackblitz.runCommand(project, typeCheckCommand);

      return {
        success: result.exitCode === 0,
        output: result.output
      };

    } catch (error) {
      return {
        success: false,
        output: `Type checking failed: ${error.message}`
      };
    }
  }

  async runBuild(repoUrl: string, branch: string): Promise<TestResult> {
    try {
      const packageJson = await this.github.getFileContent(repoUrl, 'package.json', branch);
      const pkg = JSON.parse(packageJson);
      
      const buildCommand = pkg.scripts?.build || 'pnpm build';
      const project = await this.stackblitz.createFromGitHub(repoUrl, branch);
      const result = await this.stackblitz.runCommand(project, buildCommand);

      return {
        success: result.exitCode === 0,
        output: result.output
      };

    } catch (error) {
      return {
        success: false,
        output: `Build failed: ${error.message}`
      };
    }
  }

  private parseTestOutput(output: string): {
    success: boolean;
    coverage?: number;
    failedTests?: string[];
  } {
    const lines = output.split('\n');
    let success = true;
    let coverage: number | undefined;
    const failedTests: string[] = [];

    for (const line of lines) {
      // Check for test failures (common patterns)
      if (line.includes('FAIL') || line.includes('✗') || line.includes('failed')) {
        success = false;
        
        // Extract test name if possible
        const testMatch = line.match(/FAIL\s+(.+)/);
        if (testMatch) {
          failedTests.push(testMatch[1]);
        }
      }

      // Extract coverage information
      const coverageMatch = line.match(/All files\s+\|\s+(\d+\.?\d*)/);
      if (coverageMatch) {
        coverage = parseFloat(coverageMatch[1]);
      }
    }

    // Additional success checks
    if (output.includes('Tests passed') || output.includes('✓')) {
      success = true;
    }

    return { success, coverage, failedTests };
  }
}