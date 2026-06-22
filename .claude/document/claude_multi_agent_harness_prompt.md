# Multi-Agent Harness Template

**Usage:** Copy this template, fill in bracketed sections, provide to Claude.

---

Design and implement a production-ready multi-agent harness for: **[TASK_DESCRIPTION]**

## Context
**Project:** [PROJECT_NAME]
**Stack:** [TECH_STACK]
**Constraints:** [TIME/RESOURCE_CONSTRAINTS]
**Success criteria:** [MEASURABLE_OUTCOMES]

## Goal
Build a system where multiple specialized agents collaborate in a controlled loop:

1. **Validator agent** checks whether the incoming task is well-formed and whether the current output satisfies the task.
2. **Planner agent** decomposes the task into ordered subtasks and decides the next action.
3. **Coder agent** implements the subtask in code.
4. **Checker / Review agent** verifies whether the code or result is correct, complete, safe, and ready to move forward.
5. If the checker says the task is not done, the workflow returns to planning and coding.
6. If the checker says the task is done, the orchestrator moves to the next task.
7. Repeat until all tasks are complete.

## Required Architecture
Use a **central orchestrator / workflow engine** with specialized workers. Do not let agents freely chat without control. The workflow must be deterministic, traceable, and bounded by retries and exit conditions.

### Agent Roles (customize as needed)
**Required:**
- **Orchestrator**: state machine, routing, retries, progression
- **Validator**: confirms readiness, checks completion, blocks invalid work
- **Planner**: structured plan, subtask decomposition
- **[Worker]**: [DESCRIBE_PRIMARY_WORK_AGENT - e.g., Coder, Designer, Analyst]
- **Reviewer**: validation, testing, pass/fail decisions

**Optional (add based on task):**
- **Security Reviewer**: unsafe code, secrets, permissions, policy violations
- **[Custom Agent]**: [DESCRIBE_ADDITIONAL_ROLE]

### Required loop behavior
- The orchestrator must keep a task state like:
  - `queued`
  - `planned`
  - `coding`
  - `reviewing`
  - `needs_revision`
  - `approved`
  - `done`
  - `failed`
- Use bounded retries.
- Use clear exit conditions.
- Never allow infinite loops.
- Always checkpoint progress after each stage.

## Implementation Rules
Claude must produce:
1. A clear architecture diagram.
2. The workflow/state machine definition.
3. The data schema for messages between agents.
4. The cloud deployment design.
5. The code structure / folder structure.
6. Example prompts for each agent.
7. Example message payloads.
8. A minimal reference implementation.
9. Testing and validation strategy.
10. Observability and logging strategy.
11. Security and access control strategy.

## Recommended Design Principles
- Single responsibility per agent.
- Central workflow control.
- Structured outputs only, ideally JSON.
- Idempotent task processing.
- Durable state storage.
- Retry with backoff.
- Dead-letter handling for repeated failures.
- Full traceability for every agent handoff.
- Minimal permissions per agent.
- Human approval for risky actions.

## Suggested Cloud-Native Stack
Claude may choose the exact stack, but should prefer cloud-native building blocks such as:
- Workflow engine: Temporal, Step Functions, Durable Functions, or similar
- Queue / bus: SQS, Pub/Sub, RabbitMQ, Kafka, or similar
- Compute: serverless functions, containers, or Kubernetes
- Storage: Postgres, DynamoDB, Firestore, Redis, or object storage
- Observability: logs, metrics, traces, dashboards
- CI/CD: GitHub Actions or similar

## Output Format Required from Claude
Claude must respond with the following sections:

1. **Architecture summary**
2. **Agent roles and responsibilities**
3. **Workflow loop and state machine**
4. **Message schemas**
5. **Cloud deployment plan**
6. **Reference implementation**
7. **Testing plan**
8. **Security plan**
9. **Observability plan**
10. **Next steps**

## Quality Bar
The final design must:
- Work for more than one task
- Support task handoff from one agent to another
- Support revision loops
- Stop when done
- Be easy to extend with new agents
- Be safe to run in cloud environments
- Be suitable for real development workflows

## Extra Instructions
- Ask clarifying questions only if critical
- Make reasonable choices and proceed
- Prefer working implementation over perfect design
- Focus on [PRIORITY: speed/cost/safety/scalability]

---

## Common Use Cases

### Code Generation Pipeline
```
Task: "Generate production-ready React components from design specs"
Agents: Validator → Planner → Designer → Coder → Tester → Security
Loop: Until tests pass and no vulnerabilities
```

### Content Pipeline
```
Task: "Generate SEO-optimized blog posts with fact-checking"
Agents: Validator → Planner → Researcher → Writer → Fact-Checker → SEO-Reviewer
Loop: Until facts verified and SEO score > threshold
```

### Data Pipeline
```
Task: "Extract, transform, validate data from multiple sources"
Agents: Validator → Planner → Extractor → Transformer → Quality-Checker
Loop: Until data quality > 95%
```

## Stack Templates

**Node.js/TypeScript:**
- Temporal + BullMQ + PostgreSQL + Redis
- Express/Fastify + structured logging

**Python:**
- FastAPI + Celery + PostgreSQL + Redis
- Pydantic schemas + structured logging


---

## Pre-Flight Checklist

Before using this template, customize:
- [ ] `[TASK_DESCRIPTION]` - specific task to automate
- [ ] `[PROJECT_NAME]` and `[TECH_STACK]`
- [ ] `[MEASURABLE_OUTCOMES]` - define done
- [ ] Agent roles - add/remove based on task
- [ ] State machine states - add task-specific states
- [ ] Retry limits and exit conditions
- [ ] Stack choice from templates above
- [ ] `[PRIORITY]` - speed/cost/safety/scalability focus
