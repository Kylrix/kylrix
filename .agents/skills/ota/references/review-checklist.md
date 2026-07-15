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

# Review Checklist

Use this checklist when deciding whether a contract is merely valid or genuinely strong.

- Does a service task that declares `runtime.kind: service` use `launch.kind: command` instead of
  opaque `run`?
- Does a bounded parent task use `aggregate.tasks` instead of `run: "true"` or aggregate membership
  hidden in `depends_on`?
- Does dependency setup use `prepare.kind: dependency_hydration` when Ota owns the package-manager
  lane?
- If setup already uses typed dependency hydration, are any remaining warnings about the real
  network/write blast radius instead of old install-shell glue?
- If the task is installing a required tool rather than repo dependencies, is that modeled with
  `prepare.kind: tool_bootstrap` instead of raw shell `pip install ...` glue?
- If a verification lane depends on real services, staging credentials, or other remote-backed
  state, does it use `effects.network_kind: integration_test` plus explicit `requirements.env`
  and `effects.external_state` instead of collapsing that truth into a generic broad network lane?
- If one setup lane spans more than one typed finite setup step under shared requirements/effects,
  is that modeled with `prepare.kind: sequence` instead of a fallback shell script?
- If one setup lane is deterministic env bootstrap, does it use `action.kind: ensure_env_file`
  instead of shell copy-plus-`sed` glue?
- If one setup lane truthfully owns clone-if-missing materialization of a sibling or vendored
  repo checkout, does it use `action.kind: ensure_git_checkout` instead of shell `git clone`
  glue?
- If one setup lane truthfully owns deterministic scaffold or factory materialization from a
  Git-backed template, does it use `action.kind: ensure_git_template` instead of shell `git clone`
  plus `rm -rf .git` and `git init` glue?
- If one setup lane owns shared external Docker network readiness, does it use
  `action.kind: ensure_container_network` instead of shell `docker network inspect/create` glue?
- If one destructive local recovery lane owns stopping a Compose-managed service, removing one
  named volume, and restarting the service, does it use
  `action.kind: reset_compose_service_volume` instead of shell `docker compose stop/rm` plus
  `docker volume rm` glue?
- If the repo declares Ota bootstrap truth for agents or CI, does it prefer
  `agent.bootstrap.ota.source` (`version`, `git_rev`, or pressure-only `branch`) instead of
  carrying install semantics only in raw shell strings?
- If GitHub Actions already has repo-owned bootstrap truth available, does it consume that through
  `ota-run/setup@v1 source: contract` or `ota-run/action@v1 source: contract` instead of
  restating Ota version, git revision, branch, or source-install refs in workflow YAML?
- If one setup lane is a bundle of deterministic setup actions under one owner, does it use
  `action.kind: ensure_bundle` instead of shell orchestration?
- If a setup lane was collapsed into one parent body, is that the right owner boundary, or should
  those steps stay as separate finite tasks because they have different reuse, requirements, or
  effects?
- If the repo uses uv for Python dependency setup, is that modeled with `source.kind: uv` instead
  of a raw `run: uv sync` body?
- If the repo uses npm with `package-lock.json`, is setup modeled with `manager: npm` and `mode: ci`?
- If Poetry owns Python dependency truth, is it declared under
  `toolchains.python.package_managers.poetry`?
- If the repo depends on deterministic file inputs, are those checks modeled with `kind: file`
  instead of shell `test -f ...` glue, and does any sibling relative input use
  `scope: workspace` explicitly instead of pretending it is repo-local?
- Are env-file and env-rendering responsibilities owned by first-class env surfaces before shell
  glue?
- When tasks mutate out-of-repo systems, does `effects.external_state` use shipped canonical
  tokens like `docker`, `postgres`, `redis`, `s3`, `cloudflare`, or `kubernetes` instead of
  repo-local aliases such as `docker_compose`, `postgresql`, or `k8s`?
- If `docker compose` or `docker buildx bake` truth lives under a repo subdirectory, is that
  adapter root modeled with `adapter_inputs.overlays.compose.cwd` or `adapter_inputs.overlays.bake.cwd` instead of
  shell `cd ... && ...` or `docker compose --project-directory ...` glue?
- If the repo uses `docker buildx bake`, is Bake file selection owned by
  `adapter_inputs.overlays.bake.files` instead of shell `-f` / `--file` flags?
- If the repo uses Helm render/install/lint lanes, is chart root, values-file selection, release
  naming, or namespace truth owned by `adapter_inputs.overlays.helm.*` instead of shell `cd ... && helm ...`,
  chart positionals, or `--namespace` flags?
- Does the contract declare `metadata.ota.minimum_version` when newer Ota surfaces are in use?
- Are public CI or proof workflows installing an Ota build new enough to execute the contract they
  validate?
