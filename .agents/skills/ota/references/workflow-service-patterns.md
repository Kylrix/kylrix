<!--
                █████
               ░░███
       ██████  ███████    ██████
      ███░░███░░░███░    ░░░░░███
     ░███ ░███  ░███      ███████
     ░███ ░███  ░███ ███ ███░░███
     ░░██████   ░░█████ ░░████████
      ░░░░░░     ░░░░░   ░░░░░░░░

   Copyright (C) 2026 — 2026, Ota. All Rights Reserved.

   DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.

   Licensed under the Apache License, Version 2.0. See LICENSE for the full license text.
   You may not use this file except in compliance with that License.
   Unless required by applicable law or agreed to in writing, software distributed under the
   License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
   either express or implied. See the License for the specific language governing permissions
   and limitations under the License.

   If you need additional information or have any questions, please email: os@ota.run
-->

# Workflow And Service Patterns

Use these patterns when the repo truth needs explicit workflows, services, env modeling, or
execution governance.

## Workflow structure

Use `prepare`, `setup`, and `run` intentionally. Put finite env materialization and preflight work
in `prepare`, dependency/setup truth in `setup`, and the user-facing long-running or verification
task in `run`. When that materialization produces a dotenv artifact for `docker compose`
interpolation, project it through `tasks.<name>.adapter_inputs.overlays.compose.env_files` rather than task
process `env_files`. When the workflow owns the base compose file stack or compose project name,
keep that under `workflows.<name>.adapter_inputs.overlays.compose.*` so task-local adapter inputs only
carry narrower path-specific additions. The same workflow-owned surface also covers
`adapter_inputs.overlays.compose.cwd` when the truthful compose root is a repo subdirectory. Use
`workflows.<name>.adapter_inputs.overlays.bake.*` the same way when the workflow owns the Bake adapter
root or the base `docker buildx bake` file stack.

Use `workflows.<name>.instances` when one workflow is really a named runtime family such as `ws0`,
`ws1`, or `preview` instead of separate pseudo-workflows. Select that path as
`ota up --workflow <name>@<instance>`. Keep the instance overlay bounded and explicit:

- use `workflows.<name>.instances.<instance>.topology.requires_instances` when one selected
  instance truthfully needs another declared instance up first, such as `ws1+` requiring `ws0`
- use `workflows.<name>.instances.<instance>.env` for selected-instance host clone or cache roots,
  often with `${OTA_HOST_HOME}` when the truthful path lives under the operator's home directory
- use `workflows.<name>.instances.<instance>.tasks.<task>.adapter_inputs` for instance-specific
  compose project naming or other adapter-owned runtime inputs
- use `workflows.<name>.instances.<instance>.tasks.<task>.runtime` when the base service task
  already owns explicit runtime listeners and one selected instance needs different listener bind or
  projected host ports without splitting runtime truth into a workflow-local side channel
- use `workflows.<name>.instances.<instance>.surfaces.<surface>` when the same selected runtime
  publishes the same logical UI/API surface on different host ports per instance

Choose workflow `prepare` by owner boundary:

- use `prepare.task` when the bootstrap step deserves reuse or its own task identity
- use `prepare.action` when the workflow itself honestly owns one finite deterministic bootstrap
  action or bundle and a helper task would only add glue

```yaml
workflows:
  app:
    intent: local_development
    description: Canonical local application workflow
    prepare:
      action:
        kind: ensure_env_file
        path: .env.local
        template: .env.example
        vars:
          APP_ENV:
            value: local
            mode: replace
    setup:
      task: setup
    run:
      task: dev
    readiness:
      surfaces:
        - api
    exposes:
      - surface: api
```

## Service ownership

Own docker-compose-backed services under `services.<name>.manager`, not only through task prose.

```yaml
services:
  postgres:
    manager:
      kind: compose
      file: docker-compose.yml
      profiles:
        - dev
      service: postgres
    endpoints:
      host:
        address: 127.0.0.1
        port: 5432
    readiness:
      from: host
      kind: tcp
```

Use `services.<name>.manager.file` / `.files`, `manager.env_file` / `.env_files`, and `.profiles`
when a managed Compose service owns stable compose file selection, interpolation, or profile
selection truth. Do not push that ownership back into shell `docker compose -f ...`,
`--env-file ...`, or `--profile ...` flags.

## Env modeling

Prefer first-class env declaration before shell glue. Use `env.sources`, `env.vars`, and
`env_bindings` when runtime or workflow truth depends on them.

```yaml
env:
  sources:
    - kind: dotenv
      path: .env
  vars:
    DATABASE_URL:
      required: true

tasks:
  dev:
    env_bindings:
      DATABASE_URL:
        from: env
        name: DATABASE_URL
```

For host-launched compose or service tasks that need the real repo path or host uid for
interpolation, prefer ota-owned execution env over shell discovery:

```yaml
tasks:
  devenv:up:
    env:
      PENPOT_SOURCE_PATH: ${OTA_HOST_WORKSPACE}
      CURRENT_USER_ID: ${OTA_HOST_UID}
```

That keeps repo-root bind mounts and host-uid interpolation machine-readable instead of hiding
`pwd` or `id -u` in shell wrappers.

## Service-backed task requirements

When a task truly depends on a managed service, declare that with `requires_services`.

```yaml
tasks:
  test:integration:
    requires_services:
      - postgres
    command:
      exe: npm
      args:
        - run
        - test:integration
```

## Execution and context-bound modes

When the same task can run in different contexts, own that under `execution` rather than inventing
parallel tasks.

```yaml
tasks:
  build:
    depends_on:
      - setup
    command:
      exe: npm
      args:
        - run
        - build
    execution:
      default_mode: native
      modes:
        native:
          context: host
        container:
          context: app
```

If the prerequisite truth also changes by plane, keep one task identity and move that prerequisite
truth under `execution.modes.<mode>.depends_on` instead of inventing `build:host`,
`typecheck:host`, or similar alias tasks.

```yaml
tasks:
  typecheck:
    depends_on:
      - setup
    command:
      exe: npm
      args: [run, typecheck]
    execution:
      modes:
        native:
          context: host
          depends_on:
            - setup:host
```

That keeps the contract honest:

- task identity stays `typecheck`
- host/container preflight stays explicit
- a host-selected parent task can inherit the same plane into this dependency when the branch is
  truthfully declared

## Post-run hooks

Use `after_success`, `after_failure`, and `after_always` when follow-up task behavior is part of
repo truth.

```yaml
tasks:
  build:
    command:
      exe: npm
      args:
        - run
        - build
    after_success:
      - discoverability:check
```
