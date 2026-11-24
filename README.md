# JPEL: JSON Process Execution Language

[![npm](https://img.shields.io/npm/v/@rockscience/jpel)](https://www.npmjs.com/package/@rockscience/jpel)

JPEL describes processes as JSON: checklists, data collection and quality
control. A process **definition** lists activities (forms for people,
JavaScript computations, API calls) and how to move between them. An engine
turns a definition into a **run** (a process instance), which collects the
data and records what happened.

This repository holds the specification (this file), the JSON Schemas and
sample processes. It defines the language and its data types; it does not
include an engine, and any engine can be built to run JPEL definitions. The
schemas and samples are published to npm as
[`@rockscience/jpel`](https://www.npmjs.com/package/@rockscience/jpel)
(`npm install @rockscience/jpel`); see [Using the schema](#using-the-schema).

- [Quick example](#quick-example)
- [Process definition](#process-definition)
- [Activities](#activities)
- [Fields](#fields)
- [Code and expressions](#code-and-expressions)
- [API templates](#api-templates)
- [Pass and fail](#pass-and-fail)
- [Runs](#runs)
- [Using the schema](#using-the-schema)
- [Changes from the earlier markup](#changes-from-the-earlier-markup)

## Quick example

```json
{
  "id": "hello-world",
  "name": "Hello World",
  "start": "main",
  "variables": [
    { "name": "greeting", "type": "text" }
  ],
  "activities": {
    "main": {
      "type": "sequence",
      "activities": ["askName", "greet", "end"]
    },
    "askName": {
      "type": "human",
      "prompt": "What is your name?",
      "fields": [
        { "name": "userName", "type": "text", "label": "Your name", "required": true }
      ]
    },
    "greet": {
      "type": "compute",
      "code": "vars.greeting = `Hello, ${acts.askName.userName}!`;"
    },
    "end": {
      "type": "terminate",
      "reason": "Greeted"
    }
  }
}
```

A run starts at `main`, asks for a name, computes a greeting into the process
variable `greeting`, and ends.

## Process definition

| Key | Required | Meaning |
|---|---|---|
| `id` | yes | Unique ID (letters, digits, `_`, `-`) |
| `name` | yes | Display name |
| `description` | | |
| `start` | yes | ID of the first activity |
| `activities` | yes | Map of activity ID to activity |
| `variables` | | Process variables: `{ name, type, description?, defaultValue? }`. Code reads and writes them as `vars.<name>`. |
| `properties` | | Run properties: `{ id, name, defaultValue?, includeInSummary? }`. Code reads and writes them as `props.<id>`; they are shown with each run. `props.title` names the run. |
| `dataGenerators` | | Value generators, such as serial numbers, that fields can use ([below](#data-generators)) |

Activity IDs are the keys of `activities` and use the same characters as the
process ID. Wherever a definition refers to an activity (`start`, a sequence's
`activities`, a switch's targets) it uses the bare ID.

A definition has no version number. An engine should pin each run to the
definition it started from (for example, by storing a content-addressed
snapshot), so
editing a definition never changes runs already under way.

## Activities

Every activity has a `type` and may have a `name` and `description`. An `id`
key is optional and, if given, must equal the activity's key.

| Type | Does |
|---|---|
| `human` | Shows a form and waits for a person to submit it |
| `compute` | Runs JavaScript |
| `api` | Makes an HTTP request, then optionally runs JavaScript on the response |
| `sequence` | Runs activities in order |
| `switch` | Chooses the next activity |
| `terminate` | Ends the run |

### human

```json
"capsuleData": {
  "type": "human",
  "name": "Capsule Data",
  "prompt": "Measure the capsule:",
  "fields": [
    { "name": "frontCapacitance", "type": "number", "label": "Front capacitance", "units": "pF", "required": true },
    { "name": "backCapacitance", "type": "number", "label": "Back capacitance", "units": "pF", "required": true }
  ]
}
```

`prompt` is shown above the form; `fields` are described [below](#fields).
The submitted values are the activity's values: `acts.capsuleData.frontCapacitance`.
A human activity may have a [`passWhen`](#pass-and-fail).

### compute

```json
"generateTitle": {
  "type": "compute",
  "code": [
    "const facts = acts.commonFacts;",
    "props.title = `${facts.customerName}-${facts.micBuildNumber}`;"
  ]
}
```

`code` is JavaScript, either one string or an array of lines (joined with
newlines). If the code returns an object, its keys become the activity's
values (`return { buildCode }` makes `acts.generateBuildCode.buildCode`). A
compute activity needs `code`, a `passWhen`, or both.

### api

```json
"fetchCountry": {
  "type": "api",
  "method": "GET",
  "url": "https://api.worldbank.org/v2/country/{{acts.askCountry.isoCode}}",
  "headers": { "Accept": "application/json" },
  "queryParams": { "format": "json" },
  "expectedStatus": [200],
  "retries": 2,
  "timeout": 30,
  "code": "const body = response.data; const country = body?.[1]?.[0]; if (!country) { const problem = body?.[0]?.message?.[0]?.value; throw new Error(problem ? 'World Bank API: ' + problem : 'No country found for that code'); } return { capital: country.capitalCity };"
}
```

| Key | Meaning |
|---|---|
| `method` | `GET`, `POST`, `PUT` or `DELETE` (required) |
| `url` | Request URL (required) |
| `headers`, `queryParams` | Maps of strings |
| `body` | JSON request body |
| `expectedStatus` | Status codes that count as success (default `[200]`) |
| `retries` | Extra attempts after a failure (default 0) |
| `timeout` | Seconds (default 30) |
| `code` | Runs after a successful request; sees the result as `response` (`status`, `statusText`, `headers`, `data`) |
| `passWhen` | See [Pass and fail](#pass-and-fail) |

`url`, `headers`, `queryParams` and the strings in `body` may contain
[templates](#api-templates).

### sequence

```json
"main": { "type": "sequence", "activities": ["collect", "check", "finish"] }
```

Runs each activity in turn. When the last one completes, the sequence
completes and its parent continues.

### switch

A switch evaluates an expression and runs the activity for the matching case:

```json
"micTypeDecision": {
  "type": "switch",
  "expression": "acts.commonFacts.microphoneCategory",
  "cases": { "LDC": "ldcMic", "SDC": "sdcMic" },
  "default": "otherMic"
}
```

The value is converted to a string to look up `cases`. With no match and no
`default`, the activity fails.

For a yes/no decision, use `condition`, `then` and optionally `else`:

```json
"bodyOriginCondition": {
  "type": "switch",
  "condition": "acts.commonFacts.bodyOrigin === 'CUSTOMER_REBUILD'",
  "then": "intakeInspection"
}
```

If the condition is false and there is no `else`, the switch completes
without running anything. Either way, the switch completes when the chosen
activity does, and its parent continues.

### terminate

```json
"end": { "type": "terminate", "reason": "Build rejected", "result": "failure" }
```

Ends the run. `result` is `success` (the default; the run completes) or
`failure` (the run fails).

## Fields

A human activity's `fields` describe its form:

| Key | Meaning |
|---|---|
| `name` | Required. Read in code as `acts.<activity>.<name>` |
| `type` | Required: `text`, `textarea`, `number`, `boolean`, `select`, `date` or `file` |
| `label`, `hint`, `placeholder`, `description` | Shown with the field |
| `required` | The form can't be submitted without a value |
| `defaultValue` | Initial value |
| `options` | For `select`: `[{ "value": "K47", "label": "K47 capsule" }]` |
| `min`, `max` | `number`: the allowed range. `text` and `textarea`: the allowed length |
| `units` | Shown after a number, e.g. `pF` |
| `pattern`, `patternDescription` | Regular expression a text value must match, and how to explain it |
| `fileSpec` | For `file`: `{ "extensions": [".jpg"], "fileType": "image/*" }` (MIME types or families, comma-separated) |
| `dataGenerator` | `{ "generatorId", "autoPopulate"?, "allowManualEdit"? }`: fill the field from a generator |

A `file` field's value is a reference to the stored file (its metadata, a URL
and, for images, a thumbnail URL), not the file's content.

### Data generators

```json
"dataGenerators": [
  {
    "id": "mic-build-number",
    "strategy": "serial",
    "scope": "tenant",
    "parameters": { "initial": 248, "increment": 1, "length": 4, "zeroPad": "left" }
  }
]
```

`strategy` is `serial`, `random`, `uuid` or `timestamp`. A `serial`
generator issues `initial + increment` first. `scope` is `tenant` (one
sequence shared by all of a tenant's processes; the default) or `process`.
Other parameters: `prefix`, `suffix`, `characterSet` (`random`:
`alphanumeric`, `numeric`, `alphabetic` or `hex`) and `format` (`timestamp`,
e.g. `YYYYMMDD-HHmmss`).

## Extensions

The process, its activities and their fields may carry properties whose names
start with `x-`. They are not part of JPEL: engines ignore them and keep them
as they are, and tools use them for their own features, such as presentation.
Any other unknown key is still rejected, so a typo like `desciption` is caught.

```json
"inspect": {
  "type": "human",
  "fields": [
    { "name": "finish", "type": "number", "label": "Paint finish", "min": 1, "max": 10, "x-display": "scale" },
    { "name": "cost", "type": "number", "label": "Parts cost", "x-report": { "hidden": true } }
  ]
}
```

A definition must still work in an engine that knows none of its extensions:
one that has never heard of `x-display` shows `finish` as an ordinary number
input. Use a name specific to the tool when two tools might mean different
things by the same name.

## Code and expressions

Compute and API `code`, switch `expression` and `condition`, and `passWhen`
are JavaScript. They see three objects:

| Name | Holds | Writable |
|---|---|---|
| `vars` | Process variables: `vars.greeting` | yes |
| `props` | Run properties: `props.title` | yes |
| `acts` | Every activity's values: `acts.capsuleData.frontCapacitance` | no |

API code also sees `response`. `console.log(...)` writes to the engine's log.

`acts.<id>` holds an activity's values: a human activity's submitted fields,
or the object a compute or API activity's code returned. Use brackets for IDs
that aren't JavaScript names: `acts["990Facts"].donor`. `acts` is read-only;
an activity sets its own values by returning an object.

`code` is the body of a function, so `return` ends it. `expression`,
`condition` and `passWhen` are single expressions. Code runs in strict mode:
assigning to an undeclared name is an error, not a new global.

### What code can do

Code runs in a sandbox. It is plain JavaScript with the standard built-ins
(`Math`, `JSON`, `Date`, `Array`, `String` and so on) and `console.log`.
There is no I/O: no `fetch`, `require`, `import`, file system, timers or
`async`. Use an `api` activity to call another system. An engine limits how
long code may run and how much memory it may use (for example, 1 second and
32 MB). Code that throws, or exceeds a limit, fails its activity and the run.

## API templates

`{{...}}` in an API activity's `url`, `headers`, `queryParams` and body
strings is replaced with a value:

| Template | Value |
|---|---|
| `{{vars.name}}` | A process variable |
| `{{props.id}}` | A run property |
| `{{acts.activity.field}}` | An activity's value |
| `{{env.NAME}}` | An environment variable of the engine (an engine should expose only an allowed set, for example names starting `JPEL_`) |

Templates are paths, not code. A template whose value is undefined is left
as it is.

## Pass and fail

A human, compute or API activity may declare `passWhen`, an expression
evaluated when the activity completes (after its code, so it can use the
values the code returned):

```json
"ldcCapsuleDataValidation": {
  "type": "compute",
  "name": "Capsule match",
  "passWhen": "Math.abs(acts.capsuleData.frontCapacitance - acts.capsuleData.backCapacitance) <= 10"
}
```

True records `passFail: "pass"` on the activity, false records `"fail"`.
Because the rule is declared rather than buried in code, a UI can show it and
the values it read. When a run completes, it records `aggregatePassFail`:
`any_fail` if any activity failed, otherwise `all_pass` if at least one
passed.

## Runs

A run (see `schema/instance.schema.json`) holds:

- `status`: `running`, `completed`, `failed` or `cancelled`
- `variables` and `properties`: the current values of `vars` and `props`
- `title`: the run's name, kept equal to `props.title`
- `activities`: for each activity, its definition plus its state: `status`,
  `passFail`, times, `error`, and `fields`. For a human activity, `fields`
  are its form fields with a `value` each; for compute and API activities,
  they are the values the code returned. A switch also records
  `expressionValue`, `matchedCase` (`then`, `else`, a case key or `default`)
  and `nextActivity`.
- `executionContext`: where the run is (a call stack of activities)

## Using the schema

`schema/process.schema.json` validates definitions;
`schema/instance.schema.json` describes runs. Both are JSON Schema draft-07
and compile with [Ajv](https://ajv.js.org) in strict mode. Activities use
Ajv's `discriminator` keyword, so enable it to get errors for the right
activity type:

The schemas and samples are published to npm as
[`@rockscience/jpel`](https://www.npmjs.com/package/@rockscience/jpel):

```
npm install @rockscience/jpel ajv
```

```js
import Ajv from 'ajv';
import { processSchema, instanceSchema } from '@rockscience/jpel';

const validate = new Ajv({ allErrors: true, strict: true, discriminator: true }).compile(processSchema);
```

The package includes TypeScript declarations for these exports. The files can
also be imported directly, for example
`@rockscience/jpel/schema/process.schema.json` or
`@rockscience/jpel/samples/hello-world.json` (with `{ type: 'json' }`).

The schema checks shape only. An engine should also check that every
activity a definition refers to exists, as `test/samples.test.mjs` does.

### Working on the spec

```
npm install
npm run build   # regenerate schema/*.json from schema/*.yaml
npm test        # check the JSON is current, validate the samples, test the schema
```

Edit the YAML, never the generated JSON. `samples/` holds example processes;
`mic-build.json` is a real microphone build process.

To release, bump `version` in `package.json` (`npm version <major|minor|patch>`),
push the commit and tag, and publish a GitHub release for the tag. The
Publish workflow tests and publishes it to npm.

## Changes from the earlier markup

JPEL used to rewrite its own tokens into JavaScript. Code now uses plain
objects, and each thing has one spelling:

| Before | Now |
|---|---|
| `a:step.v:field`, `activities.step.v.field` | `acts.step.field` |
| `v:name`, `var:name`, `process.name` | `vars.name` |
| `p:name`, `properties.name` | `props.name` |
| `$title` | `props.title` |
| `a:self.passFail = cond ? 'pass' : 'fail'` | `"passWhen": "cond"` |
| `a:self.x = value`, `this.x = value` | `return { x: value }` |
| `a:step.v:field` in API URLs and headers | `{{acts.step.field}}` |
| `env:NAME` | `{{env.NAME}}` |
| `"start": "a:main"` (and in sequences and switches) | `"start": "main"` |
| `"inputs"` on human activities, `"variables"` on a run's activities | `"fields"` |
| `"type": "branch"` | `"type": "switch"` with `condition`/`then`/`else` |
| `"version"` | Removed; runs are pinned to the definition they started from |
| `"code"` as an array only | A string or an array of lines |
| Field type `string`, `"multiline": true`, `minLength` | `text`, `textarea`, `min` |

The Node.js reference runner that used to live here has been removed; this
repository defines the language only.

## License

MIT; see [LICENSE](LICENSE).
