# JPEL - JSON Process Expression Language

JPEL (JSON Process Expression Language) is a lightweight JSON-based business process execution language inspired by BPEL4People. It provides a simple, readable format for defining business processes with human tasks, automated activities, and complex workflow patterns.

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- npm

### Running the Demo

1. **Start the Server**
   ```bash
   cd runner-node
   npm install
   npm run build
   npm run start
   ```

2. **Open the Web Demo**
   - Navigate to http://localhost:3000
   - Try the sample processes (Hello World, Approval Workflow, Employee Onboarding)

## 📋 Features

- **Human Tasks** - Interactive forms with validation
- **Compute Activities** - JavaScript code execution
- **API Integration** - REST API calls with response handling
- **Workflow Patterns** - Sequence, parallel, and conditional branching
- **Repository Support** - In-memory and MongoDB persistence
- **Web Interface** - Interactive demo with process visualization
- **CSP Compliant** - Security-ready for production deployment

## 🏗️ Architecture

```
├── runner-node/          # Node.js/TypeScript process engine
│   ├── src/             # Engine source code
│   ├── samples/         # Example process definitions
│   └── public/          # Web demo interface
├── runner-java/         # Java implementation (legacy)
└── design/              # Schema and documentation
```

## 📝 Process Schema

### Basic Process Structure
```json
{
  "id": "my-process",
  "name": "My Business Process",
  "description": "Process description",
  "version": "1.0.0",
  "start": "a:firstActivity",
  "variables": [
    {
      "name": "userName",
      "type": "string",
      "description": "User's name"
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
          "name": "userName",
          "type": "string",
          "label": "Your Name",
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
| `human` | Interactive user task | Data collection, approvals |
| `compute` | JavaScript execution | Calculations, data transformation |
| `api` | REST API call | External system integration |
| `sequence` | Sequential execution | Multi-step workflows |
| `parallel` | Concurrent execution | Independent parallel tasks |
| `branch` | Conditional routing | Approval/rejection flows |
| `terminate` | Process completion | Success/failure endpoints |

### Activity References

Activities are referenced using the format `a:activityId`:
- `"start": "a:getUserInfo"` - Start with getUserInfo activity
- `"then": "a:processData"` - Branch to processData activity

## 🔄 Sample Processes

### Hello World
Simple greeting process demonstrating human tasks and compute activities.

### Approval Workflow  
Document approval with conditional branching based on reviewer decisions.

### Employee Onboarding
Complex workflow with parallel task execution and multi-step validation.

## 🛠️ API Endpoints

### Process Management
- `POST /api/processes` - Load process definition
- `GET /api/processes` - List loaded processes
- `GET /api/processes/:id` - Get specific process

### Process Execution  
- `POST /api/processes/:id/instances` - Create process instance
- `GET /api/instances/:id` - Get instance details
- `POST /api/instances/:id/step` - Execute next step
- `POST /api/instances/:id/activities/:activityId/submit` - Submit human task

### Monitoring
- `GET /api/instances/:id/current-task` - Get current human task
- `GET /api/health` - System health check

## 🏪 Repository Architecture

JPEL uses a repository pattern for data persistence:

```typescript
// Factory pattern for repository selection
RepositoryFactory.initializeInMemory();  // or
RepositoryFactory.initializeMongoDB();

// Repository interfaces
ProcessDefinitionRepository
ProcessInstanceRepository
```

### Supported Backends
- **In-Memory** - Development and testing
- **MongoDB** - Production persistence

## 🔐 Security Features

- **CSP Compliant** - Content Security Policy ready
- **Input Validation** - Form field validation and sanitization  
- **Error Handling** - Comprehensive error logging and recovery
- **Request Sanitization** - Protected against injection attacks

## 📊 Monitoring & Logging

The engine provides comprehensive logging at multiple levels:

```
[INFO] ProcessEngine: Loading process definition { id: 'hello-world', ... }
[DEBUG] ProcessEngine: Extracted activity ID 'getUserName' from 'a:getUserName'
[ERROR] ProcessEngine: Activity execution failed
```

## 🧪 Development

### Running Tests
```bash
cd runner-node
npm test
```

### Building
```bash
npm run build
```

### Development Mode
```bash
npm run dev
```

## 📋 Schema Documentation

Complete schema documentation is available in `/design/schema.yaml`.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

---

**JPEL** - Making business process automation simple and accessible! 🎯
