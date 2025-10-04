# 🚀 JPEL Runner - JSON Process Execution Language

A powerful, extensible process execution engine that runs JSON-based business processes inspired by BPEL4People. Perfect for building workflow applications, approval systems, and automated business processes.

## ✨ Features

- **� Human Tasks**: Interactive forms and approvals
- **🔄 Process Control**: Sequences, parallel execution, conditional branching
- **� Compute Activities**: Expression evaluation and data transformation
- **🌐 API Integration**: External service calls and webhooks
- **📊 Persistence**: Repository pattern with in-memory and MongoDB support
- **🎨 Interactive Demo**: Built-in web interface for testing processes

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Demo UI   │    │   REST API      │    │ Process Engine  │
│                 │───▶│                 │───▶│                 │
│ - Load samples  │    │ - Start process │    │ - Execute steps │
│ - Human tasks   │    │ - Submit tasks  │    │ - Handle state  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                                               ┌─────────────────┐
                                               │  Repositories   │
                                               │                 │
                                               │ - In-Memory     │
                                               │ - MongoDB       │
                                               │ - Extensible    │
                                               └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation & Demo

1. **Clone and setup:**
   ```bash
   git clone <repository-url>
   cd jpel/runner-node
   npm install
   npm run build
   ```

2. **Start the server:**
   ```bash
   npm run start
   ```

3. **Try the Interactive Web Demo:**
   Open http://localhost:3000 in your browser

4. **Or run the API demo:**
   ```bash
   # In a new terminal (keep server running)
   npm run demo
   ```

### 🎮 Try the Demo

**Option 1: Interactive Web Interface (Recommended)**
1. Open http://localhost:3000
2. Click "Load Process" on any sample
3. Click "Start Instance" 
4. Complete human tasks when prompted
5. Watch the process execute automatically!

**Option 2: API Demo Script**
```bash
npm run demo
```

The demo includes three sample processes:

1. **👋 Hello World** - Simple greeting with human input
2. **📋 Approval Workflow** - Document approval with conditional logic
3. **👨‍💼 Employee Onboarding** - Multi-step process with parallel tasks

**Demo Flow:**
- Load → Start → Interact → Complete
- All sample processes are fully functional
- Real-time process execution with human interaction

## 📝 JPEL Process Format

JPEL processes use a modern JSON schema with activity references:

```json
{
  "id": "my-process",
  "name": "My Process",
  "description": "Process description",
  "version": "1.0.0",
  "start": "a:firstActivity",
  "variables": [
    {
      "name": "myVar",
      "type": "string",
      "description": "Variable description"
    }
  ],
  "activities": {
    "firstActivity": {
      "id": "firstActivity",
      "name": "First Step",
      "type": "human",
      "prompt": "Enter your information:",
      "inputs": [
        {
          "name": "myVar",
          "type": "string",
          "label": "My Variable",
          "required": true
        }
      ]
    }
  }
}
```

### Activity Types

| Type | Description | Example Use Case |
|------|-------------|------------------|
| `human` | Wait for user input | Approval forms, data entry |
| `compute` | Execute JavaScript code | Calculate values, transform data |
| `api` | Call external services | Send emails, update databases |
| `sequence` | Execute activities in order | Orchestrate workflow steps |
| `parallel` | Execute simultaneously | Concurrent approvals |
| `branch` | Conditional logic | Route based on decisions |
| `terminate` | End process | Completion handling |

### Activity References

Activities are referenced using the format `a:activityId`:
- `"start": "a:getUserInfo"` - Start with getUserInfo activity
- `"then": "a:processData"` - Branch to processData activity

### Expression Examples

Compute activities use JavaScript code arrays:
```json
{
  "type": "compute",
  "code": [
    "// Get user input from previous activity",
    "const userName = instance.activities.getUserInfo.data.name;",
    "// Generate greeting",
    "const greeting = `Hello, ${userName}!`;",
    "return { greeting: greeting };"
  ]
}
```

Branch conditions use JavaScript expressions:
```json
{
  "type": "branch",
  "condition": "instance.activities.approval.data.decision === 'approved'",
  "then": "a:processApproval",
  "else": "a:handleRejection"
}
```

## 🔌 REST API

### Process Management

```http
# Load process definition
POST /api/processes
Content-Type: application/json
{ "id": "my-process", "name": "My Process", ... }

# List loaded processes  
GET /api/processes

# Get specific process
GET /api/processes/{processId}
```

### Instance Execution

```http
# Start new instance
POST /api/processes/{processId}/instances

# Execute next step
POST /api/instances/{instanceId}/step

# Submit human task
POST /api/instances/{instanceId}/activities/{activityId}/submit
Content-Type: application/json
{ "fieldName": "fieldValue" }

# Get current human task
GET /api/instances/{instanceId}/current-task
```

### Response Format

```json
{
  "success": true,
  "data": { /* response data */ },
  "error": null,
  "timestamp": "2025-10-03T10:00:00.000Z"
}
```

## 🗄️ Database Configuration

### In-Memory (Default)
Perfect for development and demos. No setup required.

### MongoDB Setup

1. **Install MongoDB** or use MongoDB Atlas

2. **Update configuration:**
   ```typescript
   // In your application startup
   await RepositoryFactory.initializeMongoDB({
     connectionString: 'mongodb://localhost:27017/jpel',
     databaseName: 'jpel'
   });
   ```

3. **Environment variables:**
   ```bash
   MONGODB_URL=mongodb://localhost:27017/jpel
   MONGODB_DATABASE=jpel
   ```

## 🏭 Production Deployment

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
COPY public ./public
COPY samples ./samples
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Variables

```bash
PORT=3000
NODE_ENV=production
MONGODB_URL=mongodb://your-db-url/jpel
MONGODB_DATABASE=jpel
LOG_LEVEL=info
```

### Health Monitoring

```http
GET /health
```

## 🔧 Development

### Project Structure

```
runner-node/
├── src/
│   ├── index.ts              # Express server
│   ├── process-engine.ts     # Core execution engine
│   ├── types.ts              # TypeScript definitions
│   ├── expression-evaluator.ts # Expression parsing
│   ├── api-executor.ts       # External API calls
│   └── repositories/         # Data persistence
│       ├── interfaces/       # Repository contracts
│       ├── in-memory/        # In-memory implementations
│       └── mongo/            # MongoDB implementations
├── samples/                  # Example processes
├── public/                   # Demo web interface
└── dist/                     # Compiled JavaScript
```

### Adding New Activity Types

1. **Update types:**
   ```typescript
   // In types.ts
   export type ActivityType = 'human' | 'compute' | 'api' | 'your-new-type';
   ```

2. **Implement executor:**
   ```typescript
   // In process-engine.ts
   case 'your-new-type':
     return await this.executeYourNewType(activity, instance);
   ```

### Adding Repository Backends

1. **Implement interfaces:**
   ```typescript
   export class YourRepository implements ProcessDefinitionRepository {
     // Implement all interface methods
   }
   ```

2. **Register in factory:**
   ```typescript
   // In repository-factory.ts
   static async initializeYourBackend(config: YourConfig) {
     // Setup your repository
   }
   ```

## 📚 Example Use Cases

### Approval Workflows
- Document review and approval
- Expense report processing  
- Contract approvals
- Policy change requests

### Onboarding Processes
- Employee setup workflows
- Customer registration
- Account provisioning
- Training completion tracking

### Business Automation
- Order processing
- Invoice handling
- Support ticket routing
- Compliance checking

## 🤝 Contributing

1. **Fork the repository**
2. **Create feature branch:** `git checkout -b feature/amazing-feature`
3. **Commit changes:** `git commit -m 'Add amazing feature'`
4. **Push to branch:** `git push origin feature/amazing-feature`
5. **Open Pull Request**

### Development Commands

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start development server
npm run dev

# Run tests
npm test

# Lint code
npm run lint
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **📧 Issues:** [GitHub Issues](../../issues)
- **💬 Discussions:** [GitHub Discussions](../../discussions)
- **📖 Documentation:** [Wiki](../../wiki)

---

**Built with ❤️ for the business process automation community**

Ready to build powerful workflow applications? Start with the demo and explore the possibilities! 🚀