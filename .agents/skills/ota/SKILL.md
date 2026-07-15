---
name: ota
description: "Use when working on anything Ota-specific: creating, refining, reviewing, or explaining Ota contracts (`ota.yaml`), modeling execution governance for humans and AI agents, working through `ota doctor` / `ota up` / `ota run`, handling agent safety surfaces, Ota Studio boundaries, or when deciding whether a problem belongs in the repo contract or in Ota itself."
---

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

# Ota

Use this skill when the task is about Ota-specific contract authoring, contract review, execution
governance for humans and AI agents, or Ota platform judgment.

Do not use this skill for generic YAML generation. It is for truthful execution governance, not
schema-only completion.

## Core product posture

- Doctor first, contract second.
- `ota.yaml` is the canonical source of execution governance truth.
- Prefer one explicit operational path over parallel scripts and tribal knowledge.
- If the repo needs ugly glue because Ota lacks a product feature, call it out as an Ota
  gap instead of normalizing the workaround.

## Architecture loop

Keep the Ota mental model in this order:

1. contract truth
2. execution truth
3. proof and receipt truth
4. semantic diff and correlation
5. policy and governance truth

Use the matching surface for the real question:

- contract truth: `ota.yaml`, `ota.workspace.yaml`, `ota validate`
- execution truth: `ota doctor`, `ota up`, `ota run`, `ota tasks`, `ota execution plan`
- proof and receipt truth: `ota receipt`
- semantic diff and correlation: `ota diff`, `ota receipt --snapshot`, `ota receipt --json --baseline ...`
- policy and governance truth: `.ota/org-policy.yaml`, `ota policy`, `ota policy review`

Do not collapse these into one artifact mentally or in guidance. The contract declares, execution
selects, proof records, diff compares semantic truth, and policy constrains approval.

For workspace contracts, keep one more boundary explicit:

- use `repos.<name>.tasks.<workspace_task>.task` when one shared workspace verb should map to a
  different repo-local task name
- do not force mixed-name cross-repo flows back into shell wrappers just because the repos do not
  share one literal task name

## Source priority

Prefer sources in this order:

1. the repo you are actively working on
2. local canonical Ota references, when they exist in the checkout:
   - `ota.yaml`
   - `examples/`
   - `docs/spec/contract-reference.md`
   - `docs/spec/json-output-reference.md`
   - `README.md`
3. public references in `references/official-sources.md`

When the question is specifically about archived semantic truth, semantic diff, or receipt
correlation as a public operator surface, prefer the dedicated public page
`https://ota.run/docs/reference/semantic-snapshots-and-correlation` after checking the local repo
sources above.

When the question is broader than one command or one receipt and you need the public architecture
loop itself, prefer `https://ota.run/docs/reference/execution-governance-loop` after checking the
local repo sources above.

When the active repo is `ota-run/ota`, also prefer the local core spec
`docs/spec/semantic-snapshots-and-correlation.md` for the shipped contract details behind:
- `receipt.contract_snapshot_hash`
- `receipt.assumption_set_hash`
- `ota receipt --snapshot`
- `contract_changes[]`
- `likely_related_changes[]`
- `summary.comparison.correlation`

Do not jump straight to public docs if the local repository already contains the canonical
answer. If the active repo is not the Ota repo, treat local repo files as evidence about that
project, not as Ota product documentation.

When the active repo is `ota-run/ota`, also inspect adjacent first-party repos when the task
touches their ownership boundary:

- inspect `ota-site` when the task affects public install docs, public contract docs, public
  examples, onboarding guidance, or anything the docs site promises to operators
- inspect `ota-run/skills` when the task affects first-party agent-skill guidance, contract
  authoring behavior, or the public skill installation story

Do this only when the task really crosses that boundary. Do not turn routine Ota implementation
work into a mandatory three-repo read.

## Bootstrap flow

Always prefer using the real Ota binary when it is available.

1. Check whether `ota` exists.
2. If it is missing, ask for approval before installing it.
3. Use the official install commands only:
   - macOS / Linux:
     - `curl -fsSL https://dist.ota.run/install.sh | sh`
   - Windows PowerShell:
     - `irm https://dist.ota.run/install.ps1 | iex`
   - when teaching repo-authored bootstrap truth, prefer structured `agent.bootstrap.ota.source`
     over raw shell strings:
     - `kind: version` for released proof
     - `kind: git_rev` for deterministic unreleased proof
     - `kind: branch` only for active pressure testing
   - when a repo already declares `agent.bootstrap.ota.source`, apply the canonical mapping
     directly instead of guessing:
     - `kind: version`
       - shell:
         `curl -fsSL https://dist.ota.run/install.sh | OTA_VERSION=<version> sh`
       - PowerShell:
         `$env:OTA_VERSION='<version>'; irm https://dist.ota.run/install.ps1 | iex`
     - `kind: git_rev`
       - shell:
         `curl -fsSL https://dist.ota.run/install.sh | OTA_GIT_REV=<rev> sh -s -- --from-git`
       - PowerShell:
         `$env:OTA_GIT_REV='<rev>'; & ([scriptblock]::Create((irm https://dist.ota.run/install.ps1))) -FromGit`
     - `kind: branch`
       - shell:
         `curl -fsSL https://dist.ota.run/install.sh | OTA_GIT_BRANCH=<branch> sh -s -- --from-git`
       - PowerShell:
         `$env:OTA_GIT_BRANCH='<branch>'; & ([scriptblock]::Create((irm https://dist.ota.run/install.ps1))) -FromGit`
   - when a GitHub Actions job needs direct `ota` commands and the repo already declares
     `agent.bootstrap.ota.source`, prefer the first-party
     `ota-run/setup@v1` action with `source: contract` over duplicating `OTA_VERSION`,
     `OTA_GIT_REV`, `OTA_GIT_BRANCH`, or `--from-git` in workflow YAML
   - once `agent.bootstrap.ota.source` exists, treat explicit workflow-owned Ota install truth as
     governance drift unless the lane is an intentional unreleased pressure path; `ota doctor`
     should be allowed to call out that duplication or conflict
4. After install, use real Ota commands instead of hand-wavy advice.

Prefer the official install docs and repository references in
`references/official-sources.md` when you need canonical links.

Do not silently install Ota, install agent skills, modify shell profiles, or overwrite an existing
`ota.yaml`. Ask first unless the user explicitly requested that action.

## Canonical command workflow

Use the smallest real Ota workflow that fits the task:

- `ota doctor`
  - inspect readiness blockers, warnings, next actions, and agent guidance
  - use `ota doctor --fix --dry-run` to preview the currently shipped deterministic fix lane
  - use `ota doctor --fix` when the repo truth should allow safe deterministic repair such as
    repo-hygiene cleanup or native command-acquired tool activation; plain `ota doctor` should
    stay non-mutating
- `ota init`
  - create a starter contract only when the user wants Ota adoption or no contract exists
  - prefer the emitted starter shapes Ota now owns directly: `toolchains.*`,
    `prepare.kind: dependency_hydration` for `setup`, and `command` for simple finite task bodies
- `ota detect`
  - inspect deterministic repo evidence before broadening a contract
  - treat `ota detect --write` as the conservative first-write lane, not the full starter lane
  - when reviewing a detect-written contract, read `metadata.ota.detect.field_ownership` together
    with `metadata.ota.detect.field_admission` so direct detector-owned writes are not confused
    with conservative starter-policy promotions
  - for `AGENTS.md` / `CLAUDE.md` pressure, keep the boundary explicit:
    structured external boundary lists may be admitted as detect evidence, narrow labeled command
    sections and bounded structured command tables inside those command sections may be admitted
    as low-authority task guidance, including exact `| Task | Command |` and adjacent
    `| Command | description |` forms under headings such as `Commands`, `Individual Commands`,
    `Common Commands`, `Quick Reference Commands`, `Build/Test Commands`, and
    `Build & Development Commands` when ota can still recover a stable canonical task name from
    the command itself or from a bounded task label such as `Run all unit tests`, `Run type
    checking`, or `Format code`; placeholder-heavy command templates like `<PROJECT>`,
    `<tests>`, or obvious `path/to/...` scaffolding should stay ignored because they are guidance,
    not runnable task truth; prose should stay ignored, and Ota-generated agent docs from
    `ota agents` should be treated as self-origin guidance and excluded from detect evidence,
    including older generated docs that only say `Generated from \`./ota.yaml\`.` without the
    newer `by ota agents` marker
- `ota validate`
  - verify structural and semantic contract correctness
- `ota diff`
  - compare semantic contract truth, including archived receipt-backed snapshot inputs
- `ota receipt --snapshot ...`
  - inspect archived normalized semantic contract truth directly
- `ota receipt --json --baseline ...`
  - compare current receipt state against archived baseline truth and read contract-drift
    correlation when the baseline carries snapshot identity
  - on repos with more than one declared workflow, keep archive, baseline, and snapshot selection
    scoped with `ota receipt --workflow <name> ...` instead of relying on repo-global `latest` or
    `promoted` receipt history
  - read `summary.comparison.correlation` first, then `contract_changes[]`, then
    `likely_related_changes[]`
  - expect sharper declared owners such as reusable `surfaces.<name>` or
    `readiness.probes.<name>` to outrank weaker adjacent workflow references when Ota can recover
    them honestly
- `ota tasks`
  - discover named task surfaces
  - prefer `ota tasks --use` when you need the runnable lane itself, including command preview,
    default versus alternate modes, safety posture, effect surface, and the dry-run / receipt
    follow-up commands that match that task
  - prefer `ota tasks --safe --use` first for agent-oriented execution because it keeps the
    routine runnable surface bounded before you decide whether any non-safe lane needs review
- `ota run <task>`
  - execute canonical task flows
- `ota up`
  - prepare the repo into a ready state

If a contract already exists, start with `ota doctor` and `ota validate` before editing it.

If the repository has no contract yet:

1. inspect the smallest real operational surface
2. model the minimum truthful contract
3. validate it
4. only then broaden the contract if real repo truth requires it

For agent, Studio, CI, or other integration surfaces, prefer Ota JSON output (`--json`) or documented
schemas. Do not parse rich human output unless no machine-readable surface exists, and call that out
as an Ota platform gap.
When reading receipt/proof machine output, prefer explicit stage ownership over inferring from
labels:
- `receipt.steps[*].stage_family` carries the broad governance family
- `ota proof runtime --json` carries `stage_family: "proof"` alongside the finer proof `phase`
- `artifact_routing[]` points to the next receipt/proof artifact or capture command with typed
  `role`, `kind`, and `stage_family`
For `ota run <task> --dry-run --json`, prefer top-level `provisioning` and `provisioning_request`
when present instead of scraping `plan.requirement_lines`; that selected-path provisioning truth is
the machine-readable host-fulfillment surface for direct tool acquisition.
Also prefer the additive top-level `governance` block for the selected lane’s safety posture,
review requirement, runnable mode commands, effect surface, and receipt follow-up command instead
of reconstructing those facts from task text or from the raw `requested_task` payload by hand.
For dependency-plane truth, prefer preview `plan.dependency_steps[]`, executed
`receipt.dependency_steps[]`, and validate `warning_details[].provenance` instead of inferring
backend selection from task names or advisory prose.
For interactive workspace automation with `ota workspace doctor --json --progress-json`,
`ota workspace check --json --progress-json`, `ota workspace diff --json --progress-json`,
`ota workspace status --json --progress-json`, `ota workspace receipt --json --progress-json`,
`ota workspace run --json --progress-json`, `ota workspace up --json --progress-json`, or
`ota workspace refresh --json --progress-json`, keep one output contract boundary explicit: final
machine JSON stays on stdout, while live NDJSON workspace progress events stream on stderr. Do not
treat stderr progress as the final roll-up payload, and when workspace task bindings are in play
expect progress events that carry `command` plus, when relevant, both `task` and `repo_task`
before the final receipt or repo report lands. Prefer additive `phase` plus `stage_family`
instead of inferring operational meaning from `status` text alone. For `ota workspace status` and
`ota workspace receipt`, expect `tail` to carry the repo drift state, and for
`ota workspace diff`, expect `status` to carry the diff verdict while `tail` carries the machine
`drift_kind`.

## Contract authoring workflow

When creating or refining a contract:

1. Identify the real operational truth with the minimum repo reading needed:
   - setup path
   - runtime dependencies
   - env sources and required vars
   - service and readiness ownership
   - canonical tasks
   - agent-safe boundaries
2. Model only what is actually true today.
3. Keep the contract minimal but complete enough that:
   - `ota doctor` is useful
   - `ota up` has a clear path
   - `ota run` executes named tasks honestly
4. Prefer contract fields over repo-local helper scripts when Ota already supports the
   behavior cleanly.

Prefer these concrete shapes when repo truth matches them:

- use `aggregate` for finite task grouping instead of fake `run: "true"` bodies
- use `command.cwd` when the task truth is still one finite executable plus stable argv but it
  should run from a repo subdirectory instead of hiding `cd ... && ...` in shell
- use `launch.kind: command` for long-running service processes instead of opaque `run`
- use `tasks.<name>.compose` when the repo truth is a finite `docker|podman compose`
  lane ota should own directly, whether that is an in-service `exec`/`run`/`attach` command or a
  staged `compose up`, `compose build`, `compose restart`, `compose rm`, `compose logs`, or
  project-scoped `compose down` task; use
  omitted `compose.engine` to use the default Docker Compose CLI, or set `compose.engine: podman`
  when the same body should execute through Podman Compose; use
  `compose.detach: true` only with `compose.kind: exec` or `compose.kind: up`, keep
  `compose.rm: true` only with `compose.kind: run`, keep
  `compose.build: true` only with `compose.kind: run` for one-off service shells that must
  rebuild the selected service image before execution, keep
  `compose.service_ports: true` only with `compose.kind: run` for one-off service shells that
  must publish the service's declared ports, keep `compose.force_recreate: true` only with
  `compose.kind: up`, keep `compose.force: true` only with `compose.kind: rm`, keep
  `compose.follow: true` only with `compose.kind: logs`, keep
  `compose.remove_volumes: true` only with `compose.kind: down` for `compose down -v`, keep
  `compose.timeout_seconds: <seconds>` only with `compose.kind: down` for `compose down -t <seconds>`, keep
  `compose.service` for `exec`/`run`/`attach`, and use `compose.services[]` for staged
  `compose.kind: up`, `compose.kind: build`, `compose.kind: stop`, `compose.kind: restart`,
  `compose.kind: rm`, `compose.kind: logs`, or `compose.kind: ps`
- use `launch.kind: compose` when the repo truth is a long-running `docker|podman compose up`
  runtime start rather than a finite Compose lane; keep host-side Compose cwd, env-file, file,
  profile, and project-name ownership under `adapter_inputs.overlays.compose.*`, then keep only
  `launch.engine`, `launch.action: up`, optional `launch.services[]`, and optional
  `launch.detach: true` under `launch`
- when a native structured Docker Compose lane owns one published host URL and operators may need
  one-run `--host-port` overrides, keep the Docker command/task truthful and declare
  `runtime.listeners.<name>.project.publication.compose.service` so ota can remap the published
  host port without changing the internal bind port or editing compose YAML
- use `launch.cwd` when the service-start truth is one executable plus stable argv rooted in a
  repo subdirectory instead of hiding `cd ... && ...` in shell
- use `prepare.kind: dependency_hydration` for dependency setup instead of raw package-manager
  install commands when Ota can own the lane truthfully
- when that typed setup lane must run inside a declared repo orchestrator such as `devbox` or
  `devenv`, use `execution.orchestrator.mode: exec` on command-backed
  `prepare.kind: dependency_hydration` or `prepare.kind: tool_bootstrap`; do not pretend mixed
  native `prepare.kind: sequence` can be orchestrator-mediated until Ota has a step-level model
- when `prepare.source.kind: docker_compose` owns image hydration, keep Compose file selection and
  interpolation input on `prepare.source.files` / `prepare.source.env_files` instead of burying
  `docker compose -f ... --env-file ... pull ...` in raw shell
- when that typed dependency lane truthfully runs inside a declared Compose service, keep the
  package-manager truth under `prepare.source.kind: ...` and add `prepare.source.compose` only as
  the service wrapper; in that shape the host requirement stays `requirements.tools.docker` or
  `requirements.tools.podman`, not a duplicate host language toolchain
- when the durable install state for that Compose-wrapped lane lives in a service volume instead
  of a repo path, declare it under `effects.adapter_state` with a token such as
  `compose_volume:node_modules` or `compose_volume:bundle_data` instead of faking repo writes
- for `source.kind: bundler`, keep `source.path` only when the repo truth is a repo-local gem
  lane such as `vendor/bundle`; omit it for compose-wrapped lanes that truthfully use the
  container-default Bundler path and declare the durable state under `effects.adapter_state`
- use `source.kind: composer` under `prepare.kind: dependency_hydration` for PHP dependency setup
  instead of raw `composer install`; keep durable install state such as `vendor` under
  `effects.writes`, or use `effects.adapter_state` when the lane is Compose-volume-backed
- use `source.kind: node_package_manager` with `manager: yarn`, `mode: install`, and
  `inline_builds: true` when the repo truth is `yarn install --inline-builds` instead of leaving
  that lane as raw shell
- use `source.kind: node_package_manager` with `manager: npm`, `mode: install` or `mode: ci`,
  and `force: true` only when the repo truth is explicitly `npm install --force` or
  `npm ci --force`; treat that as an exceptional override lane, not the normal npm default
- treat typed dependency hydration as stronger governance, not weaker safety: it removes
  replaceable install-shell drift, but the task still needs honest `requirements`, `effects`,
  writable-path boundaries, and usually remains outside routine `agent.safe_tasks` because the
  networked setup blast radius is still real
- use `prepare.kind: tool_bootstrap` when the task truth is contract-owned tool installation
  rather than repo dependency hydration; the shipped slices are bootstrapping `uv` through
  `source.kind: pip` with explicit `source.exe`, plus Node package-manager browser bootstrap
  through `prepare.tool: playwright_browsers` or `prepare.tool: cypress_browsers`
- treat typed tool bootstrap the same way: it removes replaceable shell drift, but keep
  `effects.network_kind: tool_bootstrap` explicit and do not pretend unattended tool installation
  is automatically routine agent-safe execution
- use `effects.network_kind: integration_test` for live, staging, or remote-backed verification
  lanes that depend on real services or non-local credentials; keep `requirements.env` and any
  real `effects.external_state` explicit, and do not treat those paths as routine `agent.safe_tasks`
- use `prepare.kind: sequence` when one honest finite setup lane needs more than one typed setup
  step in order, including structural prepare steps (`dependency_hydration`, `tool_bootstrap`) and
  deterministic bootstrap steps such as `ensure_env_file`, `ensure_file`, `ensure_directory`,
  `ensure_git_checkout`, `ensure_git_template`, `ensure_container_network`, or `reset_compose_service_volume`
- use `action.kind: ensure_env_file` when one honest setup lane is deterministic env-file
  bootstrap or normalization
- use `action.kind: ensure_git_checkout` when one honest setup lane owns clone-if-missing
  materialization of a sibling or vendored repo checkout instead of hiding `git clone` plus
  optional `git checkout` or deterministic remote-wiring shell glue in a helper script
- use `action.kind: ensure_git_template` when one honest setup lane owns deterministic scaffold or
  factory materialization from a Git-backed template instead of hiding `git clone`, inherited
  `.git` removal, and fresh `git init` glue in a helper script
- use `action.kind: ensure_container_network` when one honest setup lane owns shared external
  Docker network readiness as a standalone lane instead of shell `docker network inspect/create`
  glue
- use `action.kind: reset_compose_service_volume` when one destructive local recovery or reset
  lane truthfully owns stopping a Compose-managed service, removing one declared volume, and
  restarting the service instead of hiding `docker compose stop/rm` plus `docker volume rm`
  shell glue in the task body
- use `action.kind: ensure_bundle` when one honest setup lane owns more than one deterministic
  setup action and would otherwise become shell orchestration glue
- use `workflows.<name>.prepare.action` when the workflow itself honestly owns one finite
  deterministic host bootstrap action or bundle and a reusable helper task would only be glue
- use manager-specific native prerequisite package lanes (`apt`, `brew`, `winget`, `choco`,
  `scoop`) when the repo wants Ota-owned host package fulfillment or org-policy approval
- keep those manager lanes aligned to the OS platform entry they live under instead of mixing
  likely wrong-OS package-manager lanes into the same native prerequisite platform
- avoid mixing opaque `install` shell glue with manager-owned native package lanes on the same
  platform entry when the shell command is only there for host package installation
- use lockfile-strict npm hydration with `manager: npm` and `mode: ci` when the repo truth is npm
  plus `package-lock.json`
- use `source.kind: maven` or `source.kind: gradle` under
  `prepare.kind: dependency_hydration` for Java setup instead of raw `mvn ...` or `gradle ...`
  shell; set `wrapper: true` when the repo truth is `mvnw` or `gradlew`, and use
  `mode: go_offline` plus `skip_tests: true` when the real setup lane is
  `mvn -q -DskipTests dependency:go-offline`
- use `source.kind: cargo` under `prepare.kind: dependency_hydration` for Rust setup instead of
  raw `run: cargo fetch`
- use `source.kind: dotnet_restore` under `prepare.kind: dependency_hydration` for .NET setup
  instead of raw `run: dotnet restore`
- use `source.kind: helm` under `prepare.kind: dependency_hydration` for Helm chart setup instead
  of raw `helm dependency build ...` command or shell glue
- use `source.kind: composer` under `prepare.kind: dependency_hydration` for PHP setup instead of
  raw `run: composer install`
- use `tools.<name>.platforms.<os>.acquisition` for standalone CLI ownership when the repo truth is
  a host package-manager lane such as Helm via `apt`, `brew`, `winget`, `choco`, or `scoop`;
  keep that CLI in `tools` instead of splitting it into `native_prerequisites`
- use `tools.<name>.acquisition.provider: release_asset` when the truthful standalone CLI owner is
  one exact downloadable binary artifact or release archive and ota should own that selected-path
  source directly in the contract instead of hiding it in shell glue or org policy only
- use `tools.<name>.acquisition.source_config` when that package-manager-backed or release-asset
  standalone CLI also needs source truth such as a Brew tap, Winget source, Chocolatey feed, Scoop
  bucket, apt sources list, `asset_by_platform` release URLs, or archive extraction metadata such
  as `archive.format: tar_gz` / `zip` plus `archive.executable_path`
- use `source.kind: uv` under `prepare.kind: dependency_hydration` for uv-backed Python setup
  instead of raw `run: uv sync`
- use `toolchains.python.package_managers.poetry` instead of standalone `tools.poetry` when Poetry
  owns Python dependency truth
- use `${OTA_HOST_HOME}` when truthful instance or runtime input ownership depends on one host-home
  clone or cache root instead of shell `echo $HOME` / `%USERPROFILE%` glue
- use first-class env ownership such as `env_files`, `ensure_env_file`, workflow-owned env
  materialization, `adapter_inputs.overlays.compose.env_files` for compose interpolation truth, and
  `adapter_inputs.overlays.bake.files` for Bake file selection truth instead of baking adapter flags and
  shell rewrite glue into task commands
- use `checks[].kind: file` instead of shell `test -f ...` / `test -d ...` glue for deterministic
  filesystem assertions; keep the default repo-bound scope for in-repo paths and use
  `checks[].scope: workspace` only when the real contract truth depends on a sibling relative input
  such as `../task-sdk/schema.json`
- use canonical `effects.external_state` tokens when the task mutates out-of-repo systems;
  prefer shipped vocabulary such as `docker`, `postgres`, `redis`, `mysql`, `mariadb`, `kafka`,
  `rabbitmq`, `elasticsearch`, `opensearch`, `s3`, `gcs`, `azure_blob`, `cloudflare`,
  `kubernetes`, or `terraform` instead of repo-local aliases like `docker_compose`,
  `postgresql`, or `k8s`
- use `adapter_inputs.overlays.compose.cwd` / `adapter_inputs.overlays.bake.cwd` when the truthful compose or Bake
  working directory is a repo subdirectory instead of burying `cd ... && docker ...`,
  `cd ... && podman ...`, `docker compose --project-directory ...`, or
  `podman compose --project-directory ...` glue in task bodies
- use `services.<name>.manager.engine: podman` plus `command.exe: podman` / `launch.exe: podman`
  when the repo truth is `podman compose` rather than teaching Podman as a Docker-shaped shell
  variant
- use `services.<name>.manager.kind: host` with `manager.host.kind: systemd` plus
  `readiness.kind: systemd_active` when the repo truth is a host-managed systemd unit rather than
  shell `systemctl start` / `stop` / `is-active` glue
- use canonical `workflows.<name>.adapter_inputs.overlays.compose.*` when one workflow should own the
  adapter root, base compose file stack, compose profile set, or project naming across its
  selected compose task closure, instead of repeating that truth in task-local adapter inputs
- use `tasks.<name>.variants.<i>.env`, `.env_files`, `.env_bindings`, `.inputs`,
  `.requirements`, or `.adapter_inputs` when one task keeps the same body but needs an
  OS-scoped process, prerequisite, or adapter overlay such as Linux-only host uid/gid
  interpolation, service-derived URLs, input defaults/allowed values, platform-specific tool
  requirements, Compose files, env files, or profiles; do not clone the whole task body into
  shell-only variants just to express input drift
- use `workflows.<name>.instances` when one workflow is really a named runtime family such as
  `ws0`, `ws1`, or `preview`; select it as `workflow@instance` instead of cloning pseudo-workflows
- use `workflows.<name>.instances.<instance>.topology.requires_instances` when one selected
  instance truthfully needs another instance up first, such as `ws1+` requiring `ws0`
- use `workflows.<name>.instances.<instance>.env` for selected-instance host-clone or cache roots,
  and use `workflows.<name>.instances.<instance>.tasks.<task>.adapter_inputs` for instance-specific
  compose project naming or other adapter-owned runtime inputs
- use `workflows.<name>.instances.<instance>.tasks.<task>.runtime` when one selected service task
  keeps the same runtime identity but needs instance-specific listener bind/project ports or
  readiness listener selection; treat it as a strict overlay on the base task runtime instead of
  inventing a workflow-local listener model
- use `workflows.<name>.adapter_inputs.overlays.bake.*` when one workflow should own the adapter root
  or base Bake file stack across its selected `docker buildx bake` task closure instead of
  repeating that truth in task-local adapter inputs
- use `adapter_inputs.overlays.helm.*` or `workflows.<name>.adapter_inputs.overlays.helm.*` when one
  task path or workflow owns Helm chart root, values-file selection, release naming, or namespace
  truth instead of hard-coding Helm positionals or `--namespace` flags in argv
- treat `adapter_inputs.overlays.<family>` as a generalized contract surface with a strict shipped
  boundary: runtime semantics currently exist for `compose`, `bake`, and `helm`, and unsupported
  families should be called out as not yet shipped rather than modeled as if they execute
- set `metadata.ota.minimum_version` when the contract depends on newer parser, validator, or
  runtime surfaces

Before editing:

- preserve existing user intent in `ota.yaml`
- make the narrowest complete contract change
- update docs/tests only when command behavior, schema shape, or published examples change
- validate with `ota validate` and, when useful, `ota doctor`

Author from evidence, not vibes. Before writing or broadening a contract, inspect the smallest
set of repo files that reveal real behavior:

- package/build manifests (`package.json`, workspace files, lockfiles, language manifests)
- contributor docs (`README`, `CONTRIBUTING`, `DEVELOPERS`, setup docs)
- CI workflows that show canonical install, build, test, and smoke paths
- compose/container files only when the workflow actually needs services or containers
- existing scripts that users already run successfully

Keep scope honest. If the contract only models one slice of a large repo, say that in
`project.description`, workflow descriptions, and the final response. Do not make a partial
contract sound like full production readiness.

Default modeling areas:

- `project`
- `execution.contexts`
- `toolchains`, `runtimes`, and `tools`
- `env.sources` and `env.vars`
- `services` and readiness
- `tasks`
- `workflows`
- `checks`
- `agent`

When deciding where something belongs, prefer:

- `toolchains` for managed ecosystem ownership such as Node/Corepack/pnpm or Rust/rustup
- `runtimes` for direct runtime presence/version checks not owned by a toolchain
- `tools` for standalone command checks not owned by a toolchain
- `env` for runtime config truth
- `services` for declared managed services and readiness ownership
- `checks` for operator-facing blockers and warnings
- `tasks` for named execution paths
- `workflows` for canonical user-facing paths through prepare/setup/run/readiness
- `agent` for safety and automation boundaries

Do not duplicate ownership across `toolchains`, `runtimes`, and `tools`. If a package manager,
runtime, or command is owned by a declared toolchain, task requirements may select it, but top-level
runtime/tool ownership should not be duplicated.

Requirements should live at the narrowest truthful owner.

- use context-level `requirements` only when every task in that context genuinely needs them
- prefer task-level `requirements` for most tool/runtime ownership
- keep pure `action.kind:*`, file-prep, env-prep, and other deterministic non-runtime tasks free of
  heavyweight inherited requirements unless they actually execute that tool
- when a file action, env action, or other finite host prep lane fails only because a context
  inherited Docker, Node, Python, or another heavyweight tool, treat that as a contract issue first
  and tighten the owner boundary before changing the workflow

## Preferred modern contract shapes

When the repo truth supports them, push toward these shapes explicitly:

- finite verification grouping:
  - `aggregate.tasks` for `verify`, `ci`, and other bounded parent tasks
- long-running services:
  - `launch.kind: command` plus `runtime.kind: service` and surfaced readiness
- package-manager truth:
  - Node package managers under `toolchains.node.package_managers`
  - Composer-backed PHP dependency hydration through `prepare.source.kind: composer`
  - uv under `toolchains.python.package_managers.uv` when uv owns Python dependency setup/run
  - uv-backed Python dependency hydration through `prepare.source.kind: uv`
  - Poetry under `toolchains.python.package_managers.poetry`
  - Bundler under `toolchains.ruby.package_managers.bundler`
- deterministic setup:
  - `prepare.kind: dependency_hydration` instead of ad hoc install shell bodies where Ota already
    owns the manager lane
  - `prepare.kind: sequence` when one setup task must compose multiple structural finite steps
  - `action.kind: ensure_container_network` when shared external Docker network ownership belongs
    to one finite standalone setup task
  - `action.kind: reset_compose_service_volume` when one destructive local reset lane owns one
    Compose-managed service volume reset and restart sequence
- env and compose truth:
  - `env.sources`, `env.vars`, `env_files`, `ensure_env_file`, workflow-owned env rendering, and
    `adapter_inputs.overlays.compose.env_files` / `adapter_inputs.overlays.bake.files` for adapter-owned input
    truth before resorting to inline shell glue
  - `OTA_HOST_WORKSPACE`, `OTA_HOST_UID`, and `OTA_HOST_GID` when a native or compose task
    truthfully needs the real host repo path or Unix user/group ids for deterministic env
    interpolation; do not fall back to shell `pwd`, `id -u`, or `id -g` glue when ota already
    owns that lane
  - `adapter_inputs.overlays.compose.cwd` / `adapter_inputs.overlays.bake.cwd` when compose or Bake truth lives in a
    repo subdirectory and the task would otherwise need shell `cd ... && docker ...` or
    `docker compose --project-directory ...` glue
  - `workflows.<name>.adapter_inputs.overlays.compose.*` when compose file selection, compose profile
    selection, project naming, or adapter-root ownership belongs to the workflow rather than one
    isolated task body
  - `workflows.<name>.adapter_inputs.overlays.bake.*` when Bake file selection or adapter-root
    ownership belongs to the workflow rather than one isolated task body
- release/governance truth:
  - `metadata.ota.minimum_version` when the contract uses newer Ota capabilities

- pressure workflow truth:
  - separate contract/dry-run coverage lanes from real runtime proof lanes
  - execute heavyweight runtime paths once per meaningful proof lane instead of re-running the same
    expensive task through task, aggregate, and workflow entrypoints in one job
  - only run setup or runtime tasks on matrix lanes that truthfully advertise the required host
    capabilities
  - materialize declared file/env/setup prerequisites before broad task dry-run enumeration when the
    task surface depends on those artifacts

Prefer the strongest truthful contract surface, not the broadest valid YAML surface.

When the contract could be modeled more than one way, choose by owner boundary:

- use `prepare.kind: sequence` when the lane is still structural setup such as dependency or
  image hydration and those steps share one honest setup owner
- use `action.kind: ensure_bundle` when the lane is deterministic setup built from action
  primitives such as env/file prep plus shared Docker network bootstrap
- use `action.kind: ensure_git_checkout` when the lane is deterministic repo-local Git
  materialization, including optional declared remote reconciliation, and should stay on the same
  governed setup surface as file/env prep instead of shell bootstrap glue
- use `action.kind: ensure_container_network` when the lane is deterministic external Docker
  network bootstrap and should stay machine-readable as its own setup lane
- use `action.kind: reset_compose_service_volume` when the lane is a destructive local
  Compose-managed service-data reset and should stay explicit instead of disappearing into shell
- use `workflows.<name>.prepare.task` when that bootstrap step deserves reuse or its own task
  identity; use `workflows.<name>.prepare.action` when the workflow itself owns it directly
- keep steps as separate finite tasks when they need distinct reuse, separate requirements/effects,
  or independent operator entrypoints

For fuller holistic shapes, also use:

- `references/workflow-service-patterns.md` for workflows, services, env modeling,
  `requires_services`, context-bound `execution`, and post-run hooks
- `references/agent-and-governance-checklist.md` for `agent`, `checks`, `effects`, proof posture,
  and CI/version-floor governance
- the public examples repo when a compact copy-ready surface is better than prose alone:
  `reference/bake-adapter-inputs`, `reference/action-ensure-env-file`,
  `reference/action-ensure-bundle`, `reference/action-ensure-git-checkout`,
  `reference/action-ensure-container-network`, and
  `reference/compose-adapter-inputs`

## Known regression traps

Watch for the concrete regressions we have repeatedly seen in pressure-test repos:

- `runtime.kind: service` paired with opaque `run` instead of `launch.kind: command`
- fake aggregate bodies such as `run: "true"` where `aggregate` should own the task shape
- aggregate membership smuggled through `depends_on` instead of `aggregate.tasks`
- Poetry declared under `tools.poetry` when it actually owns Python dependency truth
- mixed-ecosystem setup script bodies where `prepare.kind: sequence` should own the lane instead
- raw `uv sync` setup bodies in Python repos where first-class `prepare.source.kind: uv` now exists
- raw `npm install` or non-lockfile setup when the repo truth is npm plus `package-lock.json`
- invalid generic native package fields where explicit manager-owned package fields should own
  fulfillment or policy truth
- public CI or proof workflows pinned to an older Ota build than the contract surface they execute
- env-file ownership baked into shell commands when first-class env surfaces can own that truth
- compose interpolation files modeled as process `env_files` instead of
  `tasks.<name>.adapter_inputs.overlays.compose.env_files`
- compose or Bake subdirectory truth still buried in shell `cd ... && docker ...` glue or
  `docker compose --project-directory ...` instead of `adapter_inputs.overlays.compose.cwd` or
  `adapter_inputs.overlays.bake.cwd`
- fake host alias tasks such as `typecheck:host` or `build:host` where one task identity plus
  `execution.modes.<mode>.depends_on` should own the plane-specific prerequisite truth
- Bake file selection buried in shell `docker buildx bake -f ...` flags instead of
  `tasks.<name>.adapter_inputs.overlays.bake.files` or
  `workflows.<name>.adapter_inputs.overlays.bake.files`
- missing `metadata.ota.minimum_version` when a contract depends on newer Ota parsing or runtime
  behavior
- context-level heavyweight requirements such as `docker`, `node`, or `python` that accidentally
  make pure file/env/action tasks unrunnable on contract-only lanes
- pressure workflows that dry-run or execute tasks before materializing declared file/env bootstrap
  truth such as `ensure_env_file`, `copy_if_missing`, or other deterministic setup lanes
- pressure workflows that prove the same heavyweight runtime lane multiple times in one job through
  direct task execution, aggregate execution, and workflow execution without gaining new coverage

## Production-readiness gates

When the user asks whether an Ota contract is solid, production-ready, PR-ready, or suitable for a
serious OSS repo, evaluate these gates explicitly:

- Scope honesty: the contract description and workflow names match the repo slice actually modeled.
- Deterministic setup: CI/proof install paths use lockfile-respecting commands where the repo
  supports them.
- Bounded agent defaults: `agent.default_task`, `agent.safe_tasks`, and `verify_after_changes`
  prefer finite verification tasks over long-running dev loops.
- Strong task-body modeling: aggregate verification is modeled with `aggregate`, and long-running
  services use `launch.kind: command` when Ota owns that surface.
- Readiness truth: surfaces/checks prove the declared workflow is usable, not just that a process
  started.
- Workflow fidelity: Ota workflows mirror real contributor/CI paths instead of inventing a parallel
  path.
- Ownership clarity: package managers, runtimes, and tools sit under the highest truthful owner and
  do not drift into duplicate declarations.
- Agent boundary: writable/protected paths are tight, and generated-file exceptions do not conflict
  with protected paths.
- CI proof posture: public PR workflows use released Ota setup/install paths unless the task is
  explicitly pressure-testing unreleased Ota.
- Version-floor honesty: contracts that use newer Ota surfaces declare `metadata.ota.minimum_version`
  and keep workflow-installed Ota in sync with that floor.
- Container/native parity: container and native workflows are both modeled only when the repo
  actually supports them, and lifecycle choices are intentional.
- Concurrency truth: when truthful parallel container lanes need the same logical dependency path,
  keep them on distinct execution contexts with matching `attachments.isolated_paths`; ota now
  distinguishes those owned paths by effective isolation namespace instead of blocking on raw path
  text alone, but still blocks when the write plane is actually shared.
- Ota gap honesty: missing provider/features are called out as Ota gaps instead of hidden in
  scripts.

If one of these gates fails, call it out directly before saying the contract is production-ready.

## Contract review workflow

When reviewing an `ota.yaml`, look for:

- fake readiness
- duplicated truth between tasks, scripts, and contract
- weak or missing blocker checks
- unclear `ota up` path
- over-modeled speculative surfaces
- agent writable/protected paths that are too loose
- tasks that depend on hidden local state
- readiness that only proves a process started, not that the repo is truly ready
- long-running dev tasks marked agent-safe or used as the default agent task
- service tasks that should be `launch.kind: command` but still hide behind opaque `run`
- finite subdirectory-rooted task bodies that still use shell only to express `cd ... && ...`
  even though `command.cwd` would be truthful
- fake aggregate parent tasks that should use `aggregate.tasks`
- install/setup commands that ignore the repo lockfile or canonical package manager
- missing first-class dependency hydration where Ota already owns the setup lane
- Poetry or other package-manager truth declared under the wrong owner
- env-file or env-rendering truth hidden in shell flags instead of first-class env surfaces
- weak dependency checks such as checking only that `node_modules` exists
- public CI workflows pinned to unreleased Ota branches or local source installs
- `agent.bootstrap.ota` declared only as raw shell when the contract should use structured
  `agent.bootstrap.ota.source`
- GitHub Actions jobs that restate ota install truth in workflow YAML instead of consuming the
  repo-owned `agent.bootstrap.ota.source` through `ota-run/setup@v1` in `source: contract` mode
- GitHub Actions jobs that conflict with `agent.bootstrap.ota.source` by pinning a different Ota
  release, git revision, branch, or source-install ref than the contract declares
- CI verification drift that is being judged from deploy/release/sync workflows instead of the
  repo's verification-oriented workflow files
- declared verifier aggregates that are split truthfully across multiple verification-oriented
  workflow files but are being reviewed as if one workflow file had to restate the whole set
- GitHub Actions `run:` lines containing `${{ ... }}` interpolation being treated as local task
  command truth instead of CI templating
- verifier-shaped inferred tasks such as `docker:test` being treated as agent-safe merely because
  the name contains `test` even though the lane still owns orchestration or adapter control
- generated `AGENTS.md` / `CLAUDE.md` being treated as external detect evidence instead of
  self-origin repo guidance
- structured external agent-boundary docs being ignored when they match Ota's admitted detect
  boundary shape
- public CI workflows pinned to older Ota builds than the contract surface they execute
- protected paths that contradict generated safe setup actions
- workflow names/descriptions that overclaim the modeled slice
- missing bounded verification tasks for the repo's known preflight checks
- missing `metadata.ota.minimum_version` when newer contract surfaces are in use
- duplicated ownership across toolchains, runtimes, and tools
- context-level requirements that are broader than the actual task bodies in that context
- pure `action.kind:*` or file/env/bootstrap tasks that inherit heavyweight runtime requirements
  they do not execute
- pressure workflows that execute setup/runtime tasks on lanes that intentionally do not advertise
  the needed host capabilities
- pressure workflows that prove the same heavyweight runtime path multiple times instead of keeping
  one real proof lane plus broader dry-run/contract coverage

A good review should separate:

- repo contract issue
- repo implementation issue
- Ota platform gap

A good review response should usually end with:

- the top contract issues
- any Ota gaps
- the next best change

When reviewing, lead with findings in priority order and include concrete file/line references when
available. State whether validation was run. If it was not run, say why. Then summarize what is
solid, what is missing, what to add, and what to remove.

## Ota gap detection

If the strongest solution is blocked by Ota itself:

- say that explicitly
- identify the missing Ota capability precisely
- prefer the product fix over a repo-local workaround when feasible

Do not normalize:

- shell retry hacks
- duplicated config
- UI surfaces that bypass Ota truth
- local glue used only to route around an Ota defect

## Studio guidance

When the task touches Ota Studio:

- keep one UI system
- keep local and cloud behind adapters
- keep `ota` canonical
- keep the UI consuming shaped Ota data, not terminal scraping
- keep `ota.yaml` and Ota JSON output as the data contract boundary

Prefer:

- local mode through `ota studio`
- cloud mode through private backend adapters
- shared view models above both

## Anti-patterns to reject

- giant autogenerated contracts with low trust
- YAML that is valid but not operationally honest
- task surfaces that duplicate existing Ota semantics
- “just put it in a script” when a contract field already exists
- making users carry platform defects in repo-local glue
- overfitting the contract to one temporary workflow
- parsing human CLI output when JSON/schema output exists
- broadening agent permissions to make a weak contract pass

## References

Read `references/official-sources.md` when you need canonical install links, official docs,
or public GitHub references for examples and contract behavior.

Read `references/contract-patterns.md` when you want compact canonical shapes for service launch,
aggregate verification, Poetry ownership, lockfile-strict npm hydration, env ownership, and
minimum-version governance.

Read `references/review-checklist.md` when you want a compact review pass that focuses on modern
contract-shape regressions rather than generic YAML validity.

Read `references/workflow-service-patterns.md` when the repo needs stronger workflow structure,
service ownership, env modeling, `requires_services`, `execution`, or post-run hook truth.

Read `references/agent-and-governance-checklist.md` when you want a compact pass over `agent`,
`checks`, `effects`, proof posture, and CI/version-floor governance.

## Expected output style

When the task is analytical rather than editing, keep the response high-signal and concrete.

Prefer:

- what is modeled well
- what is weak or missing
- whether the issue belongs in the repo or in Ota
- the narrowest correct next step

Do not produce generic YAML commentary, long tutorials, or broad best-practice lists that are
not tied to the actual repo.
