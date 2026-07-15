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

# Official Ota Sources

Use these sources when the task needs canonical public references rather than local repo-only
knowledge.

## Install

- Public install page:
  - `https://ota.run/docs/install`
- macOS / Linux installer:
  - `https://dist.ota.run/install.sh`
- Windows PowerShell installer:
  - `https://dist.ota.run/install.ps1`

## Skill installation and distribution

- Ota-managed Codex install:
  - `ota skills install --agent codex`
- Ota-managed Claude Code install:
  - `ota skills install --agent claude`
- Skills CLI install:
  - `npx skills add ota-run/skills --full-depth`
- Raw skill distribution base for tooling:
  - `https://raw.githubusercontent.com/ota-run/skills/main/skills/ota`

## GitHub

- Skills repository:
  - `https://github.com/ota-run/skills`
- Main repository:
  - `https://github.com/ota-run/ota`
- Canonical in-repo examples:
  - `https://github.com/ota-run/ota/tree/main/examples`
- Dedicated examples repository:
  - `https://github.com/ota-run/examples`
- Public README:
  - `https://github.com/ota-run/ota/blob/main/README.md`

## Contract and behavior references

- Installation docs:
  - `https://github.com/ota-run/ota/blob/main/docs/installation.md`
- Contract reference:
  - `https://github.com/ota-run/ota/blob/main/docs/spec/contract-reference.md`
- JSON output reference:
  - `https://github.com/ota-run/ota/blob/main/docs/spec/json-output-reference.md`
- Main site docs:
  - `https://ota.run/docs`

## When to use which

- Use the skills repository when referencing, installing, or changing the Ota skill itself.
- Use the skill install commands when the user wants the agent skill, not the Ota CLI.
- Use the raw skill distribution base only for installer/tooling implementation, not as the
  human-facing install link.
- Use the install page when the user needs a public human-facing setup link.
- Use the installer URLs when the workflow needs the exact install command.
- Use the examples directory when authoring or reviewing contracts against canonical patterns.
- Use the contract reference when deciding field shape or semantics.
- Use the JSON output reference when modeling Studio adapters or machine-readable surfaces.
- Use the main docs site when the user needs a public landing page rather than repository
  documentation.
