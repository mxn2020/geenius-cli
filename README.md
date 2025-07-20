# Geenius CLI

[![npm version](https://badge.fury.io/js/geenius-cli.svg)](https://badge.fury.io/js/geenius-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

A powerful interactive CLI tool for managing Netlify, GitHub, and MongoDB Atlas resources from a single interface. Streamline your development workflow with unified management across these three essential platforms.

## Features

- 🌐 **Netlify Management**: List, rename, delete, and view site details
- 🐙 **GitHub Management**: List, rename, delete, and view repository details  
- 🍃 **MongoDB Management**: Manage organizations, projects, and clusters with nested hierarchy

## Installation

Install globally via npm:

```bash
npm install -g geenius-cli
```

Or run directly with npx:

```bash
npx geenius-cli
```

## Usage

### Interactive Mode
```bash
geenius-cli
```

### Direct Commands
```bash
# Manage Netlify projects
geenius-cli netlify

# Manage GitHub repositories
geenius-cli github

# Manage MongoDB organizations
geenius-cli mongodb
```

## Configuration

Create a `.env` file with your API credentials:

```bash
# Netlify
NETLIFY_TOKEN=your_netlify_token

# GitHub
GITHUB_TOKEN=your_github_token

# MongoDB Atlas
MONGODB_ATLAS_PUBLIC_KEY=your_mongodb_public_key
MONGODB_ATLAS_PRIVATE_KEY=your_mongodb_private_key
```

## API Tokens

### Netlify Token
1. Go to [Netlify User Settings](https://app.netlify.com/user/applications)
2. Create a new personal access token
3. Copy the token to your `.env` file

### GitHub Token
1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Generate a new token with appropriate permissions
3. Copy the token to your `.env` file

### MongoDB Atlas API Keys
1. Go to [MongoDB Atlas > Organization > Access Manager > API Keys](https://cloud.mongodb.com/v2#/org/YOUR_ORG_ID/access/apiKeys)
2. Create a new API key with appropriate permissions
3. Copy both the public and private keys to your `.env` file

## Features by Service

### Netlify
- ✅ List all sites
- ✅ Rename sites
- ✅ Delete sites
- ✅ View detailed site information
- ✅ View deployment history

### GitHub
- ✅ List repositories
- ✅ Rename repositories
- ✅ Delete repositories
- ✅ View repository details
- ✅ View branches

### MongoDB
- ✅ List organizations
- ✅ View organization details
- ✅ List projects by organization
- ✅ Delete projects
- ✅ View project details
- ✅ List clusters by project
- ✅ Delete clusters
- ✅ View cluster details

## Development

### Prerequisites
- Node.js 18+ 
- npm or pnpm

### Setup
```bash
# Clone the repository
git clone https://github.com/mxn2020/geenius-cli.git
cd geenius-cli

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your API credentials

# Run in development mode
npm run dev

# Build for production
npm run build

# Run built version
npm start

# Lint code
npm run lint
```

### Project Structure
```
src/
├── commands/          # CLI command implementations
├── services/          # API service integrations
├── utils/            # Utility functions and logging
└── index.ts          # Main entry point
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests if applicable
4. Commit your changes: `git commit -am 'Add feature'`
5. Push to the branch: `git push origin feature-name`
6. Submit a pull request

## Roadmap

### 🚀 Upcoming Features

#### v0.1.0
- [ ] **AI Assistant**: Natural language interface for executing commands
  - [ ] Text input field for conversational commands
  - [ ] AI processing to interpret user intent and execute operations
  - [ ] Support for complex multi-step operations via natural language
- [ ] **Enhanced Security**: Add credential encryption for stored API tokens
- [ ] **Bulk Operations**: Support for batch operations across multiple resources
- [ ] **Export/Import**: Configuration backup and restore functionality
- [ ] **Interactive Setup**: Guided initial configuration wizard

#### v0.2.0
- [ ] **Additional Platforms**: 
  - [ ] Vercel integration
  - [ ] AWS integration (S3, Lambda)
  - [ ] Digital Ocean integration
- [ ] **Advanced MongoDB Features**:
  - [ ] Database and collection management
  - [ ] Index management
  - [ ] Performance insights
- [ ] **GitHub Advanced Features**:
  - [ ] Issue and PR management
  - [ ] Workflow management
  - [ ] Release management

#### v0.3.0
- [ ] **Automation & Workflows**:
  - [ ] Custom workflow definitions
  - [ ] Scheduled operations
  - [ ] Event-driven actions
- [ ] **Monitoring & Analytics**:
  - [ ] Resource usage tracking
  - [ ] Cost analysis
  - [ ] Performance monitoring

#### vX
- [ ] **Web Interface**: Optional web dashboard for visual management
- [ ] **Team Features**: Multi-user support and permissions
- [ ] **Plugin System**: Extensible architecture for custom integrations
- [ ] **API**: REST API for programmatic access

### 💡 Feature Requests
Have an idea for a new feature? [Open an issue](https://github.com/mxn2020/geenius-cli/issues) with the `enhancement` label!

## Support

- 📖 [Documentation](https://github.com/mxn2020/geenius-cli/wiki)
- 🐛 [Report Issues](https://github.com/mxn2020/geenius-cli/issues)
- 💬 [Discussions](https://github.com/mxn2020/geenius-cli/discussions)

## License

MIT © [Geenius](https://github.com/mxn2020)