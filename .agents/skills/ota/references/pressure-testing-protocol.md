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

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
-->

# Pressure Testing Protocol

Pressure testing proves Ota against real repo truth and deliberately searches for the next Ota
product boundary. It is not a contract-formatting exercise.

## Governance Completion Bar

The bar for a pressure repo is complete execution governance, not merely a passing Ota matrix.
Every material setup, verification, runtime, lifecycle, input, and external-effect behavior must
end in exactly one honest state:

- **contract-owned**: Ota declares and can execute or evaluate the behavior through a first-class
  surface
- **explicitly bounded**: the contract names the external dependency, selected proof scope, or
  `not_proved` boundary so a green lane cannot be over-read
- **named Ota platform gap**: the behavior cannot yet be modeled without shell glue, duplicate
  truth, or a false narrowing; record the precise missing surface and prioritize it by reuse

Do not claim that Ota operates an external cloud system just because the repo declares it. The
goal is that nothing material remains silently implicit or gets hidden in prose and helper scripts.

## Select The Repo

Prefer an existing pressure repo when it exercises a materially new Ota surface. Clone and fork a
new public repo only when the current set cannot prove the next boundary. A high-signal repo has:

- documented setup, verification, and runtime paths
- maintained CI or a meaningful contributor workflow
- a real service, toolchain, adapter, or governance shape
- enough complexity to expose a boundary, but a narrow slice that can be proved honestly

Stars are useful evidence of relevance, not a selection criterion by themselves. Do not clone a
repo merely to repeat a shape Ota already governs cleanly.

Before editing, name the target surface and the expected new evidence. If the repo exposes no new
surface after inspection, stop and select a better target.

## Model Truthfully

Read the smallest evidence set that proves the selected slice: contributor docs, manifests and
lockfiles, CI workflows, runtime/adapter files, and existing scripts. Model the documented path,
not a broader claim about the whole repo.

Use the strongest shipped Ota surface. If the only honest model needs shell glue because Ota lacks
an owned surface, state the precise Ota gap. Do not hide it as a repo convention or workaround.

For unreleased pressure, pin `agent.bootstrap.ota.source.kind: branch` to the active Ota branch.
For released proof, pin `kind: version`. CI must consume that truth through the first-party setup
or action surface where possible.

## Required Proof

Every pressure repo must prove both native and Ota-owned container execution for the selected
portable slice. Native and container execution are both first-class Ota value surfaces. The absence
of repo-owned Docker or Compose files is not an exemption: model an Ota-owned execution image when
the documented setup and verification path can run there.

Every pressure repo should prove, where the contract advertises the relevant surface:

- `ota validate`
- `ota doctor`
- `ota tasks --use`
- `ota tasks --safe --use`
- dry-run coverage for the meaningful public task surface
- real task execution for the meaningful executable surface
- workflow dry-run coverage
- real workflow/runtime proof for truthful primary runtime paths
- native coverage for every supported host path
- container coverage and Ubuntu matrix proof for the selected portable slice
- matrix coverage across intended OS/runtime lanes
- bootstrap/install truth for the exact released version, branch, or git revision under test

Do not manufacture coverage. A container exception is allowed only after attempting the selected
slice and recording a concrete technical blocker that makes an Ota-owned execution image dishonest
or impossible; missing repo Docker files alone is not a blocker. A non-hermetic or credentialed
runtime must declare its boundary and prove only the honest narrow path.

## Mandatory Gap Review

Every pressure pass must actively look for:

- shell glue that exists only because Ota lacks a first-class surface
- duplicated truth between contract, workflow, and helper scripts
- runtime, service, adapter, env, provisioning, or lifecycle truth Ota cannot model cleanly
- governance gaps where doctor, validate, detect, or init should guide authors to a stronger
  declarative surface
- repo truth narrowed to one instance or path because Ota does not yet own the broader shape

For lifecycle proof specifically, record whether Ota observed an inactive manager state before
start, acquired a transaction-local cleanup lease, finalized every leased service after each
failure/interrupt path, and produced a content-addressed local archive. Classify native generic
host start/stop smoke as an Ota platform gap unless a typed manager or isolated boundary can prove
current-boundary absence and cleanup authority. Do not promote a local lifecycle archive into CI,
claim assurance, application-output, or repo-global proof.

Classify each finding explicitly:

- **repo contract issue**: Ota already owns the truth; upgrade the contract.
- **repo implementation issue**: the repo behavior is broken or undocumented independently of Ota.
- **Ota platform gap**: the truthful contract would require shell glue, duplicate ownership, or a
  false narrowing because the product surface is missing.

An Ota platform gap should be fixed in Ota before teaching a repo-local workaround when it is
feasible and repeated or architecturally important.

Do not close a pressure repo as "fully governed" while a material behavior remains only in a
note, README, CI shell, or helper script without one of the three explicit states above.

## Propagate Connected Changes

For every Ota product change, make an explicit connected-surface decision before completion:

- core: schema, validation, runner, JSON, tests, command/spec docs, and `CHANGELOG.md` when the
  change is user-visible
- examples: update when authors need a copy-ready contract shape
- skills: update when authoring, review, pressure testing, or agent execution guidance changes
- site: update when public reference, onboarding, or product claims change

Do not update every repo mechanically. Review each surface and state why it changed or why it did
not. Public behavior must never ship with the skill, examples, or site teaching an older truth.

## Completion Record

Close every pressure pass with:

1. the slice proved and its honest boundary
2. commands and matrix/runtime evidence that passed or failed
3. the exact Ota version, branch, or revision tested
4. repo contract issues, repo implementation issues, and Ota platform gaps separately
5. first-party propagation completed or deliberately not required
