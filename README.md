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
  <a href="CONTRIBUTING.md">Contributing</a> ·
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

## Screenshots

Replace placeholders with real captures. Use the route path as the alt text.

<div align="center">
  <table>
    <tr>
      <td width="50%" align="center">
        <img src="https://via.placeholder.com/600x340/161412/EC4899?text=/app" width="100%" alt="/app" />
        <br><strong>Ideas</strong>
      </td>
      <td width="50%" align="center">
        <img src="https://via.placeholder.com/600x340/161412/F59E0B?text=/connect" width="100%" alt="/connect" />
        <br><strong>Connect</strong>
      </td>
    </tr>
    <tr>
      <td width="50%" align="center">
        <img src="https://via.placeholder.com/600x340/161412/6366F1?text=/projects" width="100%" alt="/projects" />
        <br><strong>Projects</strong>
      </td>
      <td width="50%" align="center">
        <img src="https://via.placeholder.com/600x340/161412/10B981?text=/flow" width="100%" alt="/flow" />
        <br><strong>Flow</strong>
      </td>
    </tr>
    <tr>
      <td width="50%" align="center">
        <img src="https://via.placeholder.com/600x340/161412/A855F7?text=/vault" width="100%" alt="/vault" />
        <br><strong>Vault</strong>
      </td>
      <td width="50%" align="center">
        <img src="https://via.placeholder.com/600x340/161412/6366F1?text=/agents" width="100%" alt="/agents" />
        <br><strong>Agents</strong>
      </td>
    </tr>
  </table>
</div>

## Quick start

```bash
curl -fsSL https://raw.githubusercontent.com/Kylrix/kylrix/master/setup.sh | bash
```

Or manually:

```bash
git clone https://github.com/Kylrix/kylrix.git
cd kylrix
./setup.sh
pnpm dev
```

Open **http://localhost:3005**.

## Stack

Next.js · React · TypeScript · Appwrite · Tailwind

## Security

Found a vulnerability? Report it privately via [kylrix bug report](https://www.kylrix.space/flow/form/6a19dc99002634bd33ae) — not a public GitHub issue.

## Downloads

Web app: **[kylrix.space](https://www.kylrix.space)**. Native builds: [kylrix-app](https://github.com/Kylrix/kylrix-app).
