# 🚀## ✨ What This Runner Provides

The Node.js runner is the primary implementation of JPEL, offering:

### 🎨 Interactive Web Demo
- **Live Process Testing**: Load and execute sample processes instantly
- **Visual Interface**: User-friendly forms for human tasks
- **Real-time Execution**: Watch processes run step-by-step
- **Process Status**: Live monitoring of activity states and data flow

### 🔌 REST API
- **Process Management**: Load, list, and manage process definitions
- **Instance Execution**: Start, step through, and monitor process instances
- **Human Task Handling**: Submit forms and handle user interactions
- **Re-run Capability**: Execute completed processes again with preserved data

### 💾 Flexible Storage
- **In-Memory**: Perfect for development and demos (no setup required)
- **MongoDB**: Production-ready persistence with connection pooling
- **Extensible**: Plugin architecture for custom storage backends

### 🛠️ Development Tools
- **TypeScript**: Full type safety and modern JavaScript features
- **Jest Testing**: Comprehensive test suite with 90+ passing tests
- **Hot Reload**: Development mode with automatic rebuilding
- **Linting**: Code quality enforcement with ESLintde.js Runner

The official Node.js implementation of the JPEL (JSON Process Execution Language) process engine. This runner provides a complete development and production environment for executing JPEL processes with an interactive web interface, REST API, and multiple storage backends.

## ✨ Features

- **� Human Tasks**: Interactive forms and approvals
- **🔄 Process Control**: Sequences, execution, conditional branching
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
│ - Live status   │    │ - Monitor exec  │    │ - Data flow     │
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

## 🎮 Using the Web Demo

The web interface provides an intuitive way to explore JPEL processes:

### Main Interface
- **Left Panel**: Human tasks requiring user input
- **Right Panel**: Live process status and activity states
- **Compact View**: Shows activity names and key variables (no excessive scrolling)

### Demo Flow
1. **Load Process**: Click "Load Process" on any sample
2. **Start Instance**: Click "Start Instance" to begin execution
3. **Complete Tasks**: Fill out forms when human tasks appear
4. **Watch Execution**: See the process run automatically in real-time

### Sample Processes
- **👋 Hello World** - Simple greeting with user input
- **📋 Approval Workflow** - Document approval with conditional logic
- **👨‍💼 Employee Onboarding** - Multi-step process

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

# Re-run a completed instance
POST /api/instances/{instanceId}/rerun
```

### 🔄 Re-Running Process Instances

Re-running allows you to execute a completed process instance again from the beginning, **preserving all previously entered data**:

**How Re-Run Works:**
1. Takes an existing completed instance (keeps the same `instanceId`)
2. Resets the execution state to start from the beginning
3. **Preserves all activity data** including:
   - Human task field values (forms are pre-populated)
   - Computed values from previous execution
   - API responses and other activity data
4. Allows users to review, modify, or confirm previous inputs
5. Updates activity data as the process re-executes

**Use Cases:**
- Review and modify a completed approval workflow
- Re-submit a form with corrections
- Re-execute a process with updated external data
- Audit and verify previous process executions

**Example Flow:**
```bash
# 1. Complete a process normally
POST /api/processes/approval-workflow/instances
# ... submit forms, complete process

# 2. Re-run the completed instance
POST /api/instances/{instanceId}/rerun

# 3. Forms show previous values, user can modify and re-submit
# 4. Process executes with updated data
```

**Important Notes:**
- Re-run does **NOT** create a new instance - it reuses the existing one
- All previous activity data is retained and visible
- Great for iterative workflows and correction scenarios
- The instance retains its original creation timestamp

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
│   ├── expression-evaluator.ts # JPEL→JS translation
│   ├── process-normalizer.ts # Validation & normalization
│   └── repositories/         # Data persistence
│       ├── interfaces/       # Repository contracts
│       ├── in-memory/        # In-memory implementations
│       └── mongo/            # MongoDB implementations
├── samples/                  # Example processes
├── public/                   # Demo web interface
├── tests/                    # Jest test suite (90+ tests)
└── dist/                     # Compiled JavaScript
```

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

### Adding New Features

**New Activity Types:**
1. Update `src/models/process-types.ts` with the new activity type
2. Implement executor logic in `src/process-engine.ts`
3. Add validation in `src/process-normalizer.ts`
4. Write tests in `tests/`

**New Repository Backends:**
1. Implement repository interfaces in `src/repositories/interfaces/`
2. Create concrete implementation in `src/repositories/your-backend/`
3. Register in `src/repository-factory.ts`

## 📚 Key Components

### Expression Evaluator
Translates JPEL shorthand (`a:activityId.f:fieldName`) to JavaScript and executes in a safe context.

### Process Normalizer
Validates process definitions at load time, catching field reference errors before execution.

### Web Interface
Built with vanilla JavaScript, featuring a responsive two-column layout for optimal usability.

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

**Ready to build powerful workflow applications? Start with the demo and explore the possibilities!** 🚀