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

# Agent And Governance Checklist

Use this checklist when deciding whether a contract is trustworthy for humans, CI, and agents.

- Does `agent.entrypoint` lead into the canonical verification or readiness path?
- Is `agent.default_task` finite, bounded, and suitable as the normal post-change verification task?
- Are `agent.safe_tasks` honest about network and dependency hydration behavior rather than marking
  long-running or broad-mutation tasks safe?
- Does `verify_after_changes` point to the real bounded verification surface?
- Do `writable_paths` and `protected_paths` match the effects of safe tasks, generated files, and
  dependency hydration?
- If `AGENTS.md` or `CLAUDE.md` exists, is it the right kind of source for the job:
  Ota-generated guidance should stay self-origin and excluded from detect evidence, prose-only
  docs should not be over-interpreted, and only structured external boundary lists plus narrow
  command surfaces such as labeled command bullets or exact `| Task | Command |` tables inside
  explicit command sections should be treated as admissible detect truth?
- Are task `effects` explicit when the task writes, touches external state, or uses the network?
- Are blocker `checks` present when the repo has known preconditions that should fail early in
  `ota doctor`?
- Do runtime-proof workflows prove surfaced readiness rather than only process startup?
- If the contract uses newer surfaces, do workflow pins and `metadata.ota.minimum_version` stay in
  sync?
