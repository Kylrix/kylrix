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

# Contract Patterns

Use these canonical snippets when the repo truth supports the stronger Ota surface.

## Service launch

Use `launch.kind: command` for long-running service processes instead of hiding service startup
behind opaque `run`.

```yaml
tasks:
  dev:
    description: Start the Rails API server
    launch:
      kind: command
      exe: bundle
      args:
        - exec
        - rails
        - server
        - -b
        - 0.0.0.0
        - -p
        - "3000"
    runtime:
      kind: service
      surfaces:
        api:
          project:
            host:
              primary: true
```

## Interactive workflow attach

When the truthful developer path starts in the background and then re-attaches to an existing
interactive session, declare that session as a first-class workflow attach lane instead of hiding
it in shell glue.

```yaml
tasks:
  devenv:attach:
    requirements:
      tools:
        docker: "*"
    compose:
      kind: attach
      service: main
      exe: tmux
      args:
        - attach
        - -t
        - penpot

workflows:
  default: devenv
  devenv:
    run:
      task: devenv:start
    attach:
      task: devenv:attach
```

## Aggregate verification

Use `aggregate.tasks` for bounded parent verification tasks instead of fake `run: "true"` bodies.

```yaml
tasks:
  verify:
    description: Run the full verification slice
    aggregate:
      tasks:
        - lint
        - typecheck
        - test
```

## Poetry ownership

When Poetry owns Python dependency truth, declare it under
`toolchains.python.package_managers.poetry`.

```yaml
toolchains:
  python:
    version: ">=3.12,<3.14"
    package_managers:
      poetry: ">=1.8"
```

## uv hydration

When a Python repo uses uv for dependency setup, prefer first-class dependency hydration instead of
raw `run: uv sync`.

```yaml
tasks:
  setup:
    description: Hydrate Python dependencies
    prepare:
      kind: dependency_hydration
      medium: package_dependencies
      source:
        kind: uv
        cwd: .
    requirements:
      toolchains:
        - python
    effects:
      writes:
        - .venv
      network: true
      network_kind: dependency_hydration
```

## Composer hydration

When a PHP repo uses Composer for dependency setup, prefer first-class dependency hydration instead
of raw `run: composer install`.

```yaml
tasks:
  setup:
    description: Hydrate PHP dependencies
    prepare:
      kind: dependency_hydration
      medium: package_dependencies
      source:
        kind: composer
        cwd: .
    requirements:
      tools:
        composer: "*"
    effects:
      writes:
        - vendor
      network: true
      network_kind: dependency_hydration
```

## uv tool bootstrap

When the task truth is making `uv` available for later contract execution, prefer first-class tool
bootstrap instead of raw `python -m pip install ... uv` shell.

```yaml
tasks:
  setup:tooling:
    description: Ensure uv is available for this contract slice
    prepare:
      kind: tool_bootstrap
      tool: uv
      source:
        kind: pip
        exe: python
    requirements:
      toolchains:
        - python
    effects:
      network: true
      network_kind: tool_bootstrap
```

## Cypress browser bootstrap

When the repo truth is `npx|pnpm|yarn|bunx cypress install`, prefer first-class tool bootstrap
instead of burying Cypress browser/bootstrap setup inside a larger verification shell.

```yaml
toolchains:
  node:
    version: "^20.20.2"
    package_managers:
      pnpm: "10.26.0"

tasks:
  setup:browsers:
    description: Install Cypress browsers through the repo package manager
    prepare:
      kind: tool_bootstrap
      tool: cypress_browsers
      source:
        kind: node_package_manager
        cwd: .
        manager: pnpm
    requirements:
      toolchains:
        - node
    effects:
      network: true
      network_kind: tool_bootstrap
```

## Live or staging integration testing

When the verification lane depends on real services, staging credentials, or seeded remote state,
keep that narrower truth explicit with `effects.network_kind: integration_test` instead of
collapsing it into generic broad network prose.

```yaml
env:
  vars:
    STAGING_API_TOKEN:
      required: false

tasks:
  test:live:
    description: Run the staging-backed integration suite
    command:
      exe: npm
      args:
        - run
        - test:live
    requirements:
      env:
        - STAGING_API_TOKEN
    effects:
      network: true
      network_kind: integration_test
      external_state:
        - cloudflare
```

## Mixed finite setup sequencing

When one repo-level `setup` lane honestly needs more than one typed finite step, use
`prepare.kind: sequence` instead of collapsing everything back into one shell script.

```yaml
toolchains:
  python:
    version: "3.12"
    package_managers:
      poetry: ">=2.3.4,<2.4.0"

tasks:
  setup:
    description: Materialize local env and bootstrap Playwright browsers
    prepare:
      kind: sequence
      steps:
        - kind: ensure_env_file
          path: .env.local
          vars:
            APP_ENV:
              value: local
        - kind: tool_bootstrap
          tool: playwright_browsers
          browsers:
            - chromium
          with_deps: true
          source:
            kind: poetry
            cwd: .
    requirements:
      toolchains:
        - python
    effects:
      writes:
        - .env.local
      network: true
      network_kind: tool_bootstrap
```

Use `prepare.kind: sequence` only when those steps are still one typed setup lane with shared
requirements and effects. If the lane is purely deterministic setup built from action primitives,
`action.kind: ensure_bundle` is still the narrower fit. If the steps need separate reuse, distinct
requirements/effects, or separate operator entrypoints, keep them as separate finite tasks wired
through `depends_on`.

## Helm chart hydration

When the repo truth is resolving Helm chart dependencies, prefer first-class dependency hydration
instead of raw `helm dependency build ...` command bodies.

```yaml
tasks:
  setup:
    description: Resolve Helm chart dependencies
    prepare:
      kind: dependency_hydration
      medium: package_dependencies
      source:
        kind: helm
        cwd: deploy/helm
    requirements:
      tools:
        helm: "*"
    effects:
      writes:
        - deploy/helm/charts
      network: true
      network_kind: dependency_hydration
```

## Standalone CLI package-manager ownership

When the repo truth is "this standalone CLI should be fulfilled through the host package manager",
keep that ownership under `tools` instead of splitting it into `native_prerequisites`.

```yaml
tools:
  helm:
    version: ">=3.8"
    platforms:
      linux:
        acquisition:
          provider: apt
          package: helm
      macos:
        acquisition:
          provider: brew
          package: helm
          source_config:
            tap_name: vendor/tap
            tap_url: https://github.com/vendor/homebrew-tap
      windows:
        acquisition:
          provider: winget
          package: Helm.Helm
```

## Java, Rust, and .NET dependency hydration

When the repo truth is standard Java, Rust, or .NET dependency setup, prefer first-class
dependency hydration instead of raw install shell.

```yaml
toolchains:
  java:
    version: "21"
  rust:
    version: "1.94.0"
  dotnet:
    version: "8.0"

tasks:
  setup:java:
    description: Hydrate Maven dependencies through the repo wrapper
    prepare:
      kind: dependency_hydration
      medium: package_dependencies
      source:
        kind: maven
        cwd: .
        wrapper: true
        mode: go_offline
        skip_tests: true
    requirements:
      toolchains:
        - java
    effects:
      writes:
        - .mvn
        - target
      network: true
      network_kind: dependency_hydration

  setup:rust:
    description: Hydrate Cargo dependencies
    prepare:
      kind: dependency_hydration
      medium: package_dependencies
      source:
        kind: cargo
        cwd: .
    requirements:
      toolchains:
        - rust
    effects:
      writes:
        - target
      network: true
      network_kind: dependency_hydration

  setup:dotnet:
    description: Hydrate .NET dependencies
    prepare:
      kind: dependency_hydration
      medium: package_dependencies
      source:
        kind: dotnet_restore
        cwd: .
    requirements:
      toolchains:
        - dotnet
    effects:
      writes:
        - obj
      network: true
      network_kind: dependency_hydration
```

## Compose-wrapped typed dependency hydration

When the package hydration lane truthfully runs inside a declared Compose service, keep the typed
dependency source under `prepare.source.kind: ...` and use `prepare.source.compose` only as the
service-side wrapper instead of collapsing back to `docker compose run ... npm ci` shell.

```yaml
tasks:
  setup:
    description: Hydrate app dependencies through the api Compose service
    adapter_inputs:
      compose:
        cwd: docker
        files:
          - docker/docker-compose.yml
    prepare:
      kind: dependency_hydration
      medium: package_dependencies
      source:
        kind: node_package_manager
        cwd: app
        manager: npm
        mode: ci
        compose:
          kind: run
          service: api
          workdir: /workspace
    requirements:
      tools:
        docker: "*"
    effects:
      writes:
        - app/node_modules
      network: true
      network_kind: dependency_hydration
```

Do not add fake host `requirements.toolchains.node` here just because the in-service command is
`npm ci`. In this shape the host prerequisite is the compose engine; the typed package-manager
truth still lives under `prepare.source.kind: node_package_manager`.

## Lockfile-strict npm hydration

When the repo truth is npm plus `package-lock.json`, prefer first-class dependency hydration with
`manager: npm` and `mode: ci`.

```yaml
tasks:
  setup:
    description: Install locked Node dependencies
    prepare:
      kind: dependency_hydration
      medium: package_dependencies
      source:
        kind: node_package_manager
        cwd: .
        manager: npm
        mode: ci
```

## Env ownership

Prefer first-class env ownership such as `env_files`, `ensure_env_file`, and
`adapter_inputs.overlays.compose.env_files` before baking env-file flags into task commands. Use
`env_files` when the task process itself needs the overlay. Use
`adapter_inputs.overlays.compose.env_files` when the file is compose interpolation truth for `docker
compose` or `podman compose`, including workflow-rendered dotenv artifacts. When one selected
workflow also owns generated JSON/TOML client config, prefer `env.profiles.<name>.render.files[]`
over repo-local merge scripts.

```yaml
tasks:
  setup:env:selfhost:
    description: Materialize the self-host env file when missing
    action:
      kind: copy_if_missing
      from: .env.selfhost.example
      to: .env.selfhost

  selfhost:compose:
    description: Start the self-host compose stack
    adapter_inputs:
      compose:
        env_files:
          - .env.selfhost
    launch:
      kind: command
      exe: docker
      args:
        - compose
        - up
```

## Compose and Bake adapter roots

Use `adapter_inputs.overlays.compose.cwd` or `adapter_inputs.overlays.bake.cwd` when the truthful `docker compose`,
`podman compose`, or `docker buildx bake` working directory is a repo subdirectory. That keeps
adapter-root truth in the contract instead of hiding `cd docker && ...`,
`docker compose --project-directory ...`, or `podman compose --project-directory ...` inside shell
bodies.

```yaml
tasks:
  compose:up:
    adapter_inputs:
      compose:
        cwd: docker
        files:
          - docker/docker-compose.yml
    launch:
      kind: command
      exe: docker
      args:
        - compose
        - up

workflows:
  release:
    env:
      adapter_inputs:
        bake:
          cwd: docker
          files:
            - docker/docker-bake.hcl
            - docker/docker-bake.release.hcl
    run:
      task: bake:image
```

## Deterministic env bootstrap

Use `action.kind: ensure_env_file` when one setup lane really owns one env file and ota should own
key replacement, stale-key removal, template re-derivation, or secret generation instead of shell
copy-plus-`sed` glue.

```yaml
env:
  vars:
    DATABASE_URL:
      required: true

tasks:
  setup:env:
    action:
      kind: ensure_env_file
      path: .env.local
      template: .env.example
      vars:
        APP_ENV:
          value: local
          mode: replace
        DATABASE_URL:
          from_env: DATABASE_URL
          mode: replace
        APP_SECRET:
          random:
            bytes: 24
            encoding: hex
        LEGACY_FLAG:
          mode: remove
```

## Bundled host file preparation

Use `action.kind: ensure_bundle` when one setup lane owns more than one deterministic setup
action and those steps should stay in one governed action body instead of shell orchestration.

```yaml
tasks:
  bootstrap:local:
    action:
      kind: ensure_bundle
      steps:
        - kind: ensure_container_network
          name: local-dev
        - kind: copy_if_missing
          from: .env.example
          to: .env.local
        - kind: ensure_env_file
          path: .env.local
          vars:
            APP_ENV:
              value: local
              mode: replace
        - kind: ensure_directory
          path: .cache/ota
        - kind: ensure_file
          path: .secrets/dev-token
          random:
            bytes: 24
            encoding: hex
```

## Deterministic Git checkout bootstrap

Use `action.kind: ensure_git_checkout` when one setup lane owns clone-if-missing materialization
of a sibling or vendored repo checkout and ota should own that bootstrap truth instead of shell
`git clone`, `git checkout`, or deterministic remote-wiring glue.

```yaml
tasks:
  bootstrap:deps:
    action:
      kind: ensure_bundle
      steps:
        - kind: ensure_directory
          path: vendor
        - kind: ensure_git_checkout
          path: vendor/wagtail
          source:
            git: https://github.com/wagtail/wagtail.git
            ref: main
          remotes:
            - name: upstream
              git: git@github.com:wagtail/wagtail.git
```

## Deterministic Git template bootstrap

Use `action.kind: ensure_git_template` when one setup lane owns deterministic scaffold or factory
materialization from a Git-backed template and ota should own that bootstrap truth instead of shell
`git clone`, `rm -rf .git`, and `git init` glue.

```yaml
tasks:
  scaffold:sample:
    action:
      kind: ensure_bundle
      steps:
        - kind: ensure_directory
          path: .ota-pressure
        - kind: ensure_git_template
          path: .ota-pressure/sample-extension
          source:
            git: https://github.com/codyhxyz/create-chrome-extension.git
            ref: main
```

## Deterministic container network bootstrap

Use `action.kind: ensure_container_network` when one setup lane owns shared external Docker
network readiness as its own setup lane and ota should own that truth instead of shell
`docker network inspect ... || docker network create ...` glue.

```yaml
tasks:
  network:ensure:
    context: host
    action:
      kind: ensure_container_network
      name: penpot_shared
    requirements:
      tools:
        docker: "*"
```

## Deterministic Compose-managed service volume reset

Use `action.kind: reset_compose_service_volume` when one destructive local recovery lane really
owns stopping a Compose-managed service, removing one named volume, and restarting the service
instead of hiding `docker compose stop/rm` plus `docker volume rm` glue in shell.

```yaml
tasks:
  postgres:reset:
    context: host
    action:
      kind: reset_compose_service_volume
      service: postgres
      volume: app_postgres-data
      compose:
        cwd: docker
        files:
          - docker/docker-compose.yml
        project_name: app
    requirements:
      tools:
        docker: "*"
    effects:
      external_state:
        - docker
        - postgres
    safe_for_agent: false
```

## Typed systemd host-service ownership

Use `manager.kind: host` with `manager.host.kind: systemd` when the real service owner is a
systemd unit and ota should derive lifecycle and readiness instead of hiding `systemctl` glue in
shell commands.

Validate and doctor now flag direct `systemctl start`, `stop`, and `is-active` task glue when
that ownership should move onto this typed service surface.

When you want ota to author this shape directly, prefer
`ota assist declare-service --name <service> --manager host --host-unit <unit> --style systemd-active`.

```yaml
services:
  redis:
    manager:
      kind: host
      host:
        kind: systemd
        unit: redis.service
        scope: system
    readiness:
      kind: systemd_active
      interval: 2s
      retries: 5
```

## Bake adapter ownership

Use `adapter_inputs.overlays.bake.files` when one task or workflow owns the Bake file stack for
`docker buildx bake` and that truth should stay declarative instead of living in shell `-f` flags.

```yaml
tasks:
  bake:image:
    adapter_inputs:
      bake:
        files:
          - docker-bake.hcl
    command:
      exe: docker
      args:
        - buildx
        - bake
        - app

workflows:
  release:
    env:
      adapter_inputs:
        bake:
          files:
            - docker-bake.hcl
            - docker-bake.release.hcl
    run:
      task: bake:image
```

## Native Docker Compose published host-port remap

Use `runtime.listeners.<name>.project.publication.compose.service` when one native structured
Docker Compose lane owns the published host URL for one Compose service and ota should own one-run
`--host-port` remap truth without changing the workload's internal bind port.

```yaml
tasks:
  compose:native:published:
    adapter_inputs:
      compose:
        cwd: docker
        files:
          - docker/docker-compose.yml
    compose:
      kind: up
      detach: true
      services:
        - published
    runtime:
      kind: service
      listeners:
        http:
          protocol: http
          bind:
            address: 0.0.0.0
            port:
              mode: fixed
              value: 3000
          project:
            host:
              address: 127.0.0.1
              primary: true
              port:
                mode: fixed
                value: 3000
              path: /
            publication:
              compose:
                service: published
```

That contract keeps the service bind on `3000` and lets operators run
`ota run compose:native:published --host-port 4000` to remap only the published host port for one
run.

## Minimum-version governance

When a contract depends on newer Ota parser, validator, or runtime behavior, set
`metadata.ota.minimum_version` explicitly.

```yaml
metadata:
  ota:
    minimum_version: "1.6.20"
```
