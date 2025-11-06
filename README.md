# JPEL - JSON Process Execution Language

A lightweight, JSON-native business process language for building task lists, data collection workflows, and quality control processes. JPEL makes it easy to define  structured business processes. The schema is fairly simple but powerful.  A Sample (node.js) Runner application is included here along with some sample processes.

## 🎯 What is JPEL?

JPEL (JSON Process Execution Language) is a modern approach to business process automation that uses simple JSON to define workflows. 

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

## � Activity examples (lifted from /runner-node/samples)

Below are short, focused examples of common activity definitions used in JPEL processes, taken from the repository `runner-node/samples` and annotated with what each field does. These are *snippets* (not full process files) intended to illustrate typical usage.

### 1) Human activity (form input)
From `employee-onboarding.json` — collects structured user input with validation and options.

```json
{
	"name": "Collect Employee Information",
	"type": "human",
	"prompt": "Please provide new employee details:",
	"inputs": [
		{
			"name": "employeeName",
			"type": "text",
			"label": "Employee Name",
			"required": true,
			"placeholder": "Full name",
			"pattern": "^['.\\-a-zA-Z\\s]{3,50}$",
			"patternDescription": "Name must be 3-50 characters"
		},
		{
			"name": "department",
			"type": "select",
			"label": "Department",
			"required": true,
			"options": [
				{ "value": "Engineering", "label": "Engineering" },
				{ "value": "Sales", "label": "Sales" }
			]
		}
	]
}
```

Explanation:
- `type: human` - marks the activity as a user-facing task that waits for input.
- `prompt` - text shown to the user.
- `inputs` - an array of `Variable`-like definitions describing fields to collect (name, type, label, validation).
- `pattern` and `patternDescription` provide client-side validation guidance.

### 2) API activity (external call)
From `api-demo.json` — calls a third-party REST API and processes the response in `code`.

```json
{
	"name": "Fetch Country Information",
	"type": "api",
	"method": "GET",
	"url": "https://restcountries.com/v3.1/name/a:getUserInput.v:country",
	"queryParams": { "fields": "name,capital,population,area" },
	"expectedStatus": [200],
	"retries": 3,
	"code": [
		"// response.data is available",
		"const countries = response.data;",
		"if (!countries || countries.length === 0) throw new Error('No country found');",
		"v:countryData = JSON.stringify(countries[0]);",
		"return countries[0];"
	]
}
```

Explanation:
- `type: api` - performs an HTTP request.
- `url` and `method` - request details; URL may reference process/activity variables using `a:...` or `v:...` syntax.
- `expectedStatus` - list of acceptable HTTP status codes.
- `retries` and `timeout` control resilience.
- `code` (optional) - post-processing script that runs after a successful response; it can store values in process variables (`v:`) or return a structured result.

### 3) Compute activity (inline transformation)
From `api-demo.json` — generates a formatted report from process variables.

```json
{
	"name": "Generate Country Report",
	"type": "compute",
	"code": [
		"const countryData = JSON.parse(process.countryData);",
		"const infoType = activities.getUserInput.v.infoType;",
		"let report = [];",
		"if (infoType === 'general') report = [`COUNTRY: ${countryData.name}`, `Capital: ${countryData.capital}`];",
		"v:countryReport = report.join('\n');",
		"return { reportType: infoType, reportText: v:countryReport };"
	]
}
```

Explanation:
- `type: compute` - runs JavaScript on the engine to compute or transform data.
- Access process variables via `process` or the convenience `activities.<id>.v:<name>` notation.
- `v:...` assignment persists data into process-scoped variables.

### 4) Sequence and control flow (ordered steps)
From `approval-workflow.json` — `sequence` groups ordered activities.

```json
{
	"name": "Document Approval Sequence",
	"type": "sequence",
	"activities": [
		"a:submitDocument",
		"a:reviewDocument",
		"a:processDecision"
	]
}
```

Explanation:
- `type: sequence` - executes child activities in order.
- Child entries reference activity IDs (prefixed with `a:` in full process documents).

### 5) Branch / Approval (conditional routing)
From `approval-workflow.json` — use `branch` or `switch` to route based on decisions.

```json
{
	"name": "Process Decision",
	"type": "branch",
	"condition": "activities.reviewDocument.v:approved === true",
	"then": "a:welcomeEmployee",
	"else": "a:requestChanges"
}
```

Explanation:
- `type: branch` - evaluates a boolean `condition` and selects the next activity.
- `condition` may reference activity variables or process variables.
- `then` / `else` are the next activity IDs to execute.

Where these examples came from
- `runner-node/samples/employee-onboarding.json` — human, sequence examples
- `runner-node/samples/api-demo.json` — api + compute examples
- `runner-node/samples/approval-workflow.json` — branch / approval examples

Use these snippets as reference when authoring your own activities — they show the typical fields and how the engine expects data to be structured. For full process examples, open the sample files listed under `runner-node/samples`.

## �📚 Documentation

- [Process Schema](design/schema-process.json) - Complete JSON schema reference
- [API Reference](runner-node/README.md) - REST API documentation

## 🤝 Contributing

JPEL welcomes contributions! Whether you're fixing bugs, adding features, or improving documentation, your help makes business process automation better for everyone. Any non-backward compatible breaking changes, or changes that are not covered by unit tests will probably not be merged in.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**JPEL** - Making business processes simple, structured, and automated! 🎯
