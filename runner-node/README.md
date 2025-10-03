# JPEL Runner - Node.js TypeScript Service

A Node.js TypeScript service for executing JPEL (JSON Process Execution Language) processes. This service provides a REST API to load process definitions, create instances, and step through process execution.

## Features

- 🔄 **Process Execution**: Load and execute JPEL process definitions
- 👤 **Human Tasks**: Handle human interaction steps with form inputs and file uploads
- 🧮 **Compute Activities**: Execute JavaScript code within process context
- 🌐 **API Calls**: Make HTTP requests to external services
- 🔀 **Control Flow**: Support for sequences, parallel execution, and conditional branching
- 📝 **Expression Evaluation**: Use `a:activityId.f:fieldName` syntax to access activity data

## Quick Start

1. **Install dependencies**:
   ```bash
   cd runner-node
   npm install
   ```

2. **Build the project**:
   ```bash
   npm run build
   ```

3. **Start the server**:
   ```bash
   npm start
   # or for development with auto-reload:
   npm run dev
   ```

4. **Test the API**:
   ```bash
   curl http://localhost:3000/health
   ```

## API Endpoints

### Process Management

- `GET /health` - Health check
- `POST /api/processes` - Load process definition from JSON body
- `POST /api/processes/load` - Load process definition from file
- `GET /api/processes` - Get all loaded processes
- `GET /api/processes/:processId` - Get specific process definition

### Process Execution

- `POST /api/processes/:processId/instances` - Create new process instance
- `GET /api/instances/:instanceId` - Get instance details
- `POST /api/instances/:instanceId/step` - Execute next step
- `GET /api/instances/:instanceId/current-task` - Get current human task
- `POST /api/instances/:instanceId/activities/:activityId/submit` - Submit human task data

## Usage Example

### 1. Load a Process Definition

```bash
curl -X POST http://localhost:3000/api/processes \\
  -H "Content-Type: application/json" \\
  -d @../design/process.json
```

### 2. Create Process Instance

```bash
curl -X POST http://localhost:3000/api/processes/mic-build/instances
```

Response:
```json
{
  "success": true,
  "data": {
    "instanceId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "running",
    "currentActivity": "askBuildType",
    "humanTask": {
      "activityId": "askBuildType",
      "prompt": "What type of microphone are you building?",
      "fields": [
        {
          "name": "buildType",
          "type": "select",
          "required": true,
          "options": ["TC", "TL"]
        }
      ]
    }
  }
}
```

### 3. Submit Human Task Data

```bash
curl -X POST http://localhost:3000/api/instances/550e8400-e29b-41d4-a716-446655440000/activities/askBuildType/submit \\
  -H "Content-Type: application/json" \\
  -d '{"buildType": "TC"}'
```

### 4. Continue Process Execution

The process will automatically continue after submitting human task data. For manual stepping:

```bash
curl -X POST http://localhost:3000/api/instances/550e8400-e29b-41d4-a716-446655440000/step
```

## Process Definition Format

JPEL processes use a simplified JSON format with the new `a:` and `f:` syntax:

```json
{
  "id": "my-process",
  "name": "My Process",
  "start": "a:firstActivity",
  "activities": {
    "firstActivity": {
      "id": "firstActivity",
      "type": "human",
      "prompt": "Enter some data",
      "inputs": [
        {
          "name": "userInput",
          "type": "text",
          "required": true
        }
      ]
    },
    "processData": {
      "id": "processData",
      "type": "compute",
      "code": [
        "const input = a:firstActivity.f:userInput;",
        "this.result = input.toUpperCase();"
      ]
    }
  }
}
```

## Activity Types

### Human Activities
Wait for user input through forms, file uploads, etc.

```json
{
  "type": "human",
  "prompt": "Please enter values",
  "inputs": [
    {
      "name": "fieldName",
      "type": "text|number|boolean|select|date|file",
      "required": true,
      "options": ["option1", "option2"]
    }
  ]
}
```

### Compute Activities
Execute JavaScript code with access to process context.

```json
{
  "type": "compute",
  "code": [
    "const value = a:previousActivity.f:someField;",
    "this.result = value * 2;",
    "this.passFail = value > 10 ? 'pass' : 'fail';"
  ]
}
```

### API Activities
Make HTTP requests to external services.

```json
{
  "type": "api",
  "method": "POST",
  "url": "https://api.example.com/validate",
  "headers": {
    "Authorization": "Bearer token"
  },
  "body": {
    "data": "a:inputActivity.f:inputField"
  }
}
```

### Control Flow Activities

**Sequence**: Execute activities in order
```json
{
  "type": "sequence",
  "activities": ["a:step1", "a:step2", "a:step3"]
}
```

**Branch**: Conditional execution
```json
{
  "type": "branch",
  "condition": "a:checkActivity.f:value === 'TC'",
  "then": "a:tcPath",
  "else": "a:tlPath"
}
```

## Expression Syntax

JPEL uses a simplified expression syntax:

- `a:activityId.f:fieldName` - Access field data from an activity
- `a:activityId.status` - Access activity execution status  
- `a:activityId.passFail` - Access activity pass/fail result
- `process.variableName` - Access process-level variables
- `this.propertyName` - Set properties on current activity

## Development

### Project Structure

```
runner-node/
├── src/
│   ├── types.ts              # Type definitions
│   ├── process-engine.ts     # Core execution engine
│   ├── expression-evaluator.ts # JPEL expression evaluation
│   ├── api-executor.ts       # HTTP API execution
│   └── index.ts              # Express server
├── package.json
├── tsconfig.json
└── README.md
```

### Scripts

- `npm run build` - Compile TypeScript
- `npm run dev` - Development mode with auto-reload
- `npm start` - Start production server
- `npm run watch` - Watch mode for compilation
- `npm run clean` - Clean dist folder

## Error Handling

The API returns consistent error responses:

```json
{
  "success": false,
  "error": "Error description",
  "timestamp": "2025-10-03T12:00:00.000Z"
}
```

## File Uploads

Human activities can accept file uploads:

```bash
curl -X POST http://localhost:3000/api/instances/INSTANCE_ID/activities/ACTIVITY_ID/submit \\
  -F "field1=value1" \\
  -F "files=@photo1.jpg" \\
  -F "files=@photo2.jpg"
```

## Security Considerations

- Input validation on all endpoints
- File upload size limits (10MB default)
- CORS and security headers via helmet
- Expression evaluation runs in controlled context

## Next Steps

- Add MongoDB persistence layer
- Implement proper parallel activity execution
- Add process versioning and migration
- Build web UI for process monitoring
- Add authentication and authorization
- Implement process templates and reusable components