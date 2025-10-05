# JPEL - JSON Process Expression Language

A lightweight, JSON-native business process language for building task lists, data collection workflows, and quality control processes. JPEL makes it easy to define and execute structured business processes without complex workflow engines.

## 🎯 What is JPEL?

JPEL (JSON Process Expression Language) is a modern approach to business process automation that uses simple JSON to define workflows. Unlike traditional BPMN or BPEL systems, JPEL focuses on three core capabilities:

### 📋 Task Lists
Create structured checklists and task sequences for operational procedures:
- Employee onboarding checklists
- Quality control inspection processes
- Maintenance and compliance workflows
- Project milestone tracking

### � Data Collection
Build forms and data capture workflows with validation:
- Customer intake forms
- Survey and feedback collection
- Audit and inspection data
- Regulatory compliance reporting

### ✅ Quality Control
Implement approval workflows and validation processes:
- Document review and approval cycles
- Multi-step validation procedures
- Conditional routing based on data values
- Automated quality gates

## 🚀 Key Features

- **JSON-Native**: Define processes using familiar JSON syntax
- **Human Tasks**: Interactive forms with validation and conditional logic
- **Compute Activities**: JavaScript expressions for data transformation
- **API Integration**: Connect with external systems and services
- **Conditional Flow**: Branch and switch activities for complex logic
- **Parallel Execution**: Run multiple activities simultaneously
- **Re-run Capability**: Execute completed processes again with preserved data
- **Multiple Runners**: Node.js, Java, and extensible architecture

## 📝 Quick Example

Here's a simple employee onboarding process:

```json
{
  "id": "employee-onboarding",
  "name": "Employee Onboarding",
  "description": "New hire setup and orientation process",
  "start": "a:collect-info",
  "variables": [
    {
      "name": "employeeName",
      "type": "string",
      "description": "New employee's full name"
    },
    {
      "name": "startDate",
      "type": "date",
      "description": "Employment start date"
    }
  ],
  "activities": {
    "collect-info": {
      "id": "collect-info",
      "name": "Collect Employee Information",
      "type": "human",
      "prompt": "Please enter the new employee's details:",
      "inputs": [
        {
          "name": "employeeName",
          "type": "string",
          "label": "Full Name",
          "required": true
        },
        {
          "name": "startDate",
          "type": "date",
          "label": "Start Date",
          "required": true
        }
      ],
      "then": "a:setup-workstation"
    },
    "setup-workstation": {
      "id": "setup-workstation",
      "name": "Setup Workstation",
      "type": "sequence",
      "activities": ["a:create-email", "a:provision-laptop", "a:setup-access"],
      "then": "a:send-welcome"
    },
    "create-email": {
      "id": "create-email",
      "name": "Create Email Account",
      "type": "api",
      "method": "POST",
      "url": "https://api.company.com/email/create",
      "body": {
        "name": "a:collect-info.f:employeeName",
        "type": "employee"
      }
    },
    "provision-laptop": {
      "id": "provision-laptop",
      "name": "Provision Laptop",
      "type": "human",
      "prompt": "Configure laptop for ${a:collect-info.f:employeeName}:",
      "inputs": [
        {
          "name": "laptopModel",
          "type": "select",
          "label": "Laptop Model",
          "options": ["MacBook Pro", "Dell XPS", "ThinkPad"],
          "required": true
        }
      ]
    },
    "setup-access": {
      "id": "setup-access",
      "name": "Setup System Access",
      "type": "parallel",
      "activities": ["a:grant-network", "a:create-user", "a:setup-vpn"]
    },
    "send-welcome": {
      "id": "send-welcome",
      "name": "Send Welcome Email",
      "type": "compute",
      "code": [
        "const name = instance.activities['collect-info'].data.employeeName;",
        "const startDate = instance.activities['collect-info'].data.startDate;",
        "return {",
        "  subject: `Welcome to the team, ${name}!`,",
        "  body: `Your onboarding is complete. Start date: ${startDate}`",
        "};"
      ],
      "then": "a:complete"
    },
    "complete": {
      "id": "complete",
      "name": "Onboarding Complete",
      "type": "terminate",
      "status": "completed"
    }
  }
}
```

This example shows:
- **Human tasks** for data collection
- **Sequence activities** for ordered steps
- **Parallel execution** for concurrent tasks
- **API calls** for system integration
- **Compute activities** for data processing
- **Field references** using `a:activityId.f:fieldName` syntax

## 🏗️ Activity Types

| Type | Purpose | Use Case |
|------|---------|----------|
| `human` | Interactive user input | Forms, approvals, data entry |
| `compute` | JavaScript execution | Calculations, data transformation, email generation |
| `api` | External API calls | System integration, notifications, data sync |
| `sequence` | Ordered execution | Step-by-step processes, checklists |
| `parallel` | Concurrent execution | Independent tasks, bulk operations |
| `branch` | Conditional routing | Approvals, validation gates |
| `switch` | Multi-case routing | Status-based routing, category handling |
| `terminate` | Process completion | Success/failure endpoints |

## 🔄 Process Execution

JPEL processes execute through activity references using the `a:activityId` syntax:

- **Start**: `"start": "a:collect-info"` begins with the collect-info activity
- **Flow**: `"then": "a:next-step"` continues to the next activity
- **Data Access**: `"a:activityId.f:fieldName"` references collected data
- **Conditions**: JavaScript expressions for branching logic

## 🏃‍♂️ Available Runners

JPEL is designed to run on multiple platforms:

### Node.js Runner (`runner-node/`)
- **Best for**: Development, demos, and JavaScript ecosystems
- **Features**: Interactive web UI, REST API, in-memory/MongoDB storage
- **Quick Start**: `cd runner-node && npm install && npm run demo`

### Java Runner (`runner-java/`)
- **Best for**: Enterprise deployment, Spring Boot integration
- **Features**: Production-ready, scalable, enterprise connectors
- **Quick Start**: `cd runner-java && ./mvnw spring-boot:run`

## 📊 Real-World Examples

### Task Lists
- **Safety Inspections**: Step-by-step equipment checks with photo capture
- **Quality Audits**: Structured evaluation forms with scoring
- **Maintenance Procedures**: Ordered checklists with conditional steps

### Data Collection
- **Customer Onboarding**: Multi-step forms with validation
- **Survey Systems**: Dynamic questionnaires with conditional logic
- **Incident Reporting**: Structured data capture with categorization

### Quality Control
- **Document Approval**: Multi-level review processes with rejections
- **Change Management**: Impact assessment and approval workflows
- **Compliance Checking**: Automated validation against business rules

## 🛠️ Getting Started

1. **Choose a Runner**: Start with the Node.js runner for development
2. **Load a Sample**: Use the built-in sample processes
3. **Customize**: Modify JSON to match your business needs
4. **Integrate**: Connect to your existing systems via API activities

## 📚 Documentation

- [Process Schema](design/schema.yaml) - Complete JSON schema reference
- [Expression Language](docs/expressions.md) - Field references and compute syntax
- [API Reference](runner-node/README.md) - REST API documentation
- [Java Integration](runner-java/README.md) - Enterprise deployment guide

## 🤝 Contributing

JPEL welcomes contributions! Whether you're fixing bugs, adding features, or improving documentation, your help makes business process automation better for everyone.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**JPEL** - Making business processes simple, structured, and automated! 🎯
