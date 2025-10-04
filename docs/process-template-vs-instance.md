# Process Template vs Process Run Instance

This document clarifies the distinction between Process Templates (definitions) and Process Run Instances (runtime) in JPEL, and describes how the engine converts templates into runtime instances.

## Concepts

- Process Template (Process Definition)
  - The immutable description of a process: activities, variables, prompts, validation rules.
  - Stored as JSON and loaded into the engine (samples or via API).
  - Human activity inputs are `Field[]` objects in the template. They describe structure only.

- Process Run Instance (Process Instance)
  - Represents a running or completed execution of a process template.
  - Contains runtime state: `currentActivity`, `activities` map of `ActivityInstance`, `variables`, timestamps, and history.
  - For human activities, uses `FieldValue[]` objects. Each `FieldValue` adds a `value` property to the template `Field` definition.

## Why the distinction matters

- Templates are reused: the same template may spawn many instances.
- UI clients must bind to runtime values. `Field` objects do not contain runtime values; `FieldValue` objects do.
- Persisting runtime data in `FieldValue[]` keeps the model explicit and simplifies form pre-population, re-run, and audit.

## Lifecycle (Template -> Instance)

1. **Create Instance**: `POST /api/processes/:id/instances`
   - Engine copies process template to a `ProcessInstance`.
   - `initializeActivities()` converts `HumanActivity.inputs: Field[]` -> `ActivityInstance.inputs: FieldValue[]`.
   - Each `FieldValue.value` is set to `Field.defaultValue` or left undefined.

2. **Execute**: `POST /api/instances/:id/step`
   - The engine advances `currentActivity`. When a human activity is reached, the engine returns `HumanTaskData`.
   - `HumanTaskData.fields` is an array of `FieldValue` objects ready for UI binding.

3. **Submit Human Task**: `POST /api/instances/:id/activities/:activityId/submit`
   - Engine validates incoming data against the template `Field[]` definitions.
   - Engine stores submitted data in `activityInstance.data` and updates `activityInstance.inputs[*].value`.
   - This dual-write ensures expressions can read data via `a:activityId.f:fieldName` (activity.data) while UI binds to `field.value`.

4. **Re-run**: `POST /api/instances/:id/rerun`
   - Engine creates a new instance and copies previous run data into `FieldValue[].value` for pre-populated forms.

## Guidance for UI and Integrations

- Always consume `humanTask.fields` as `FieldValue[]` and bind to `field.value`.
- Do not attempt to mutate `Field` objects from templates directly.
- For expression access (JPEL `a:activityId.f:fieldName`) the engine ensures activity data map contains the same values for backward compatibility.

## Example

Template `HumanActivity` snippet:

```json
"inputs": [
  { "name": "userName", "type": "text", "defaultValue": "" },
  { "name": "age", "type": "number", "defaultValue": 18 }
]
```

Instance `ActivityInstance.inputs` (FieldValue[]):

```json
"inputs": [
  { "name": "userName", "type": "text", "defaultValue": "", "value": "Alice" },
  { "name": "age", "type": "number", "defaultValue": 18, "value": 30 }
]
```

## Developer Tips

- When adding new endpoints or refactoring human task handling, ensure you preserve the `FieldValue` contract in responses.
- When persisting instances, store the `inputs` (FieldValue[]) as part of the instance so re-run and audit can rely on them.
- Tests should verify both `activity.data` and `activity.inputs[*].value` are updated after submissions.

---

This file complements `design/schema.yaml` and the inline notes in the README. Follow these conventions to keep template and runtime data models consistent.