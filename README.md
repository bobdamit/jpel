# JPEL - JSON Process Expression Language

A lightweight, JSON-native business process language for building task lists, data collection workflows, and quality control processes. JPEL makes it easy to define  structured business processes. The schema is fairly simple but powerful.  A Sample (node.js) Runner application is included here along with some sample processes.

## 🎯 What is JPEL?

JPEL (JSON Process Expression Language) is a modern approach to business process automation that uses simple JSON to define workflows. 

### JPEL Definition/Instance Structure
JPEL defines process definitions. These definitions define Activities of various types as well as conditions and branching. A Runner materializes a process template into a process *Instance*.  The instance represents a specific *Run* of the process and is where data is collected and processed. Each Activity in the Instance can collect Variables (from UI, API calls or *Compute* Activities).  The process instance itself can also hold Variables which are global to the entire process.

Here are a few use-cases for JPEL:

### 📋 Task Lists
Create structured checklists and task sequences for operational procedures:
- Employee onboarding checklists
- Quality control inspection processes
- Maintenance and compliance workflows
- Project milestone tracking
- Unlimited branching to do specific steps based on conditions

### � Data Collection
Build forms and data capture workflows with validation:
- Customer intake forms
- Survey and feedback collection
- Laboratory Process Data Collection and validation
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

## 📝 Quick Example

Here's a simple employee onboarding process:

```json
{
	"id": "hello-world",
	"name": "Hello World Process",
	"description": "A simple greeting process demonstrating human tasks and compute activities",
	"version": "1.0.0",
	"start": "a:mainSequence",
	"variables": [
		{
			"name": "greeting",
			"type": "text",
			"description": "The generated greeting message"
		}
	],
	"activities": {
		"mainSequence": {
			"name": "Main Sequence",
			"type": "sequence",
			"activities": [
				"a:getUserName",
				"a:generateGreeting",
				"a:end"
			]
		},
		"getUserName": {
			"name": "Get User Name",
			"type": "human",
			"prompt": "Welcome! Please tell us your name and optionally upload a profile picture:",
			"inputs": [
				{
					"name": "userName",
					"type": "text",
					"label": "Your Name",
					"required": true,
					"placeholder": "Enter your full name"
				},
				{
					"name": "profilePicture",
					"type": "file",
					"label": "Profile Picture (Optional)",
					"required": false,
					"hint": "Upload a profile picture if you'd like",
					"fileSpec": {
						"extensions": [".jpg", ".jpeg", ".png", ".gif", "webp"]
					}
				}
			]
		},
		"generateGreeting": {
			"name": "Generate Greeting",
			"type": "compute",
			"code": [
				"// Get the user name from the previous activity",
				"const userName = a:getUserName.v:userName;",
				"// Generate a greeting",
				"const greeting = `Hello, ${userName}! Welcome to JPEL!`;",
				"// Store the greeting",
				"v:greeting = greeting;"
			]
		},
		"end": {
			"name": "Process Complete",
			"type": "terminate",
			"reason": "Process completed successfully"
		}
	}
}
```

This example shows:
- **Human tasks** for data collection
- **Sequence activities** for ordered steps
- **Compute activities** for data processing
- **Variable references** using `a:activityId.v:variableName` syntax

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


## 🛠️ Getting Started
1. **Build and Run the Node.js Runner**
```
npm install
npm run build && npm run test
npm start
```
2. Visit localhost:3000 in a browser to open the Runner Demo UI
3. Choose one of the sample processes and start a new Instance

## 📚 Documentation

- [Process Schema](design/schema.yaml) - Complete JSON schema reference
- [API Reference](runner-node/README.md) - REST API documentation

## 🤝 Contributing

JPEL welcomes contributions! Whether you're fixing bugs, adding features, or improving documentation, your help makes business process automation better for everyone. Any non-backward compatible breaking changes, or changes that are not covered by unit tests will probably not be merged in.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**JPEL** - Making business processes simple, structured, and automated! 🎯
