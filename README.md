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
| `sequence` | Sequential execution | Multiple Activities in Series |
| `parallel` | Concurrent execution | Multiple Activities in Paraallel |
| `branch` | Conditional routing | IF/Else Conditional Flow |
| `switch` | Conditional routing | Mutiple Case Conditional Flow |
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

## Process Template vs Process Run Instance (Important)

There are two distinct concepts used throughout JPEL:

- Process Template (aka Process Definition)
  - Stored under `/samples` or loaded via the API.
  - Describes the static structure of a process: activities, variables, prompts, and field definitions.
  - Uses `Field` objects for human activity inputs. `Field` is a schema-only definition and does NOT contain runtime values.

- Process Run Instance (aka Process Instance)
  - Created from a Process Template when you start or re-run a process instance (e.g. `POST /api/processes/:id/instances`).
  - Represents runtime state: current activity, activity instances, persisted values, and history.
  - Uses `FieldValue` objects for human activity inputs inside the running instance. `FieldValue` extends `Field` and adds a `value` property that holds runtime data.

Key principles and lifecycle:

1. When an instance is created from a template, every `Field` in a `HumanActivity.inputs` array is converted into a `FieldValue` in the corresponding activity instance. The conversion sets `value` to the field's `defaultValue` (or `null`/`undefined` when no default exists).
2. When a human task is submitted, the engine stores submitted data both in the activity instance `data` map (legacy and for expression access) and by updating the activity instance's `inputs` array of `FieldValue` objects. This ensures UI code can always bind to `field.value`.
3. When an instance is re-run, the engine replays or copies previous `FieldValue` data into the new instance's `FieldValue[]`, so UI forms are pre-populated from the previous run.
4. API endpoints that return current human tasks (for UI rendering) always return `FieldValue[]` (not `Field[]`) so clients can safely read `field.value` for pre-population.

Quick example (template -> instance):

Template excerpt (HumanActivity.inputs):

```json
{
  "inputs": [
    { "name": "userName", "type": "text", "defaultValue": "" }
  ]
}
```

Instance activity inputs (FieldValue[]):

```json
{
  "inputs": [
    { "name": "userName", "type": "text", "defaultValue": "", "value": "Alice" }
  ]
}
```

If you are implementing a UI or integration, bind to `field.value` rather than assuming `field` contains values. The tests and engine logic now enforce this pattern.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

---

**JPEL** - Making business process automation simple and accessible! 🎯
