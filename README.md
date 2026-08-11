<p align="center">
  <img src="public/logo.svg" width="120" alt="Kylrix Logo">
</p>

<h1 align="center">Kylrix</h1>

<p align="center">
  <strong>The agentic workspace that 10x the productivity of high agency builders.</strong>
</p>

<p align="center">
  Notes, tasks, chat, vault, and agents — in one fast workspace. Open source. Self-hostable.
</p>

<p align="center">
  <a href="LICENSE">AGPL-3.0-or-later</a> ·
  <a href="ARCHITECTURE.md">Architecture</a> ·
  <a href="https://www.kylrix.space">kylrix.space</a>
</p>

---

## What it is

Kylrix is a single workspace for people who ship fast: capture ideas, run projects, message your team, store secrets, and let agents help — without jumping between a dozen apps.

Built for **high-agency builders** who want depth without clutter.

## What you get

- **Ideas** — write, link, and share notes
- **Flow** — goals, calendar, and focus
- **Connect** — moments, chats, and mail
- **Vault** — passwords and 2FA codes
- **Projects** — everything tied to outcomes
- **Agents** — Kylie and custom agents in the loop

Details on security, sync, and internals: [ARCHITECTURE.md](ARCHITECTURE.md).


## Quick start

```bash
git clone https://github.com/Kylrix/kylrix.git
cd kylrix
cp .env.example .env
pnpm install
pnpm dev
```

Open **http://localhost:3005**.

## Ota

This repository includes an [`ota.yaml`](./ota.yaml) contract for contributor setup, deterministic
verification, the SQLite development runtime, and the self-hosted Compose boundary. Install Ota
from the [official installation guide](https://ota.run/docs/install), then inspect the declared
surface before running a task.

```bash
# validate the contract and inspect readiness
ota validate .
ota doctor

# discover human and agent-safe task usage
ota tasks --use
ota tasks --safe --use

# run the finite verification workflow on the host
ota up --workflow verify --mode native

# run the same portable verification workflow in Ota's container boundary
ota up --workflow verify --mode container

# start the contributor SQLite runtime
ota up --workflow sqlite-dev
```

The `selfhost` workflow owns the Compose lifecycle. Inspect that workflow before running it.

## Stack

Next.js · React · TypeScript · Appwrite · Tailwind

## Security

Found a vulnerability? Report it privately via [kylrix bug report](https://www.kylrix.space/flow/form/6a19dc99002634bd33ae) — not a public GitHub issue.

## Downloads

Web app: **[kylrix.space](https://www.kylrix.space)**. Native builds: [kylrix-app](https://github.com/Kylrix/kylrix-app).
