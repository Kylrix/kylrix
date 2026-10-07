# 🤝 Contributing to Kylrix & Developer Contributor Program

Welcome to the Kylrix engineering community! We believe the developers who build and sustain open infrastructure should never have to pay for it.

---

## 🎁 Contributor Program: Kylrix Pro Free Forever

> **Kylrix Pro is completely free forever for any developer who contributes to Kylrix.**  
> As long as you have at least **one merged pull request in the Kylrix codebase in the past 30 days**, your account automatically receives full **Kylrix Pro** features.

### ⚡ 100% Automated Verification (Zero Manual Review)

You never need to ask an admin or file a support ticket to verify your contributions:
1. Connect or sign in with your **GitHub account** on [kylrix.space](https://www.kylrix.space) (or in **Settings → Accounts**).
2. The verification engine automatically inspects GitHub for merged pull requests authored by you on [`Kylrix/kylrix`](https://github.com/Kylrix/kylrix) within the last 30 days:
   ```text
   repo:Kylrix/kylrix is:pr is:merged author:{your-github-username} merged:>={now-30d}
   ```
3. Your account is immediately upgraded to **Pro** with full quotas, cloud sync, team collaboration, and priority agent execution.
4. Keep contributing at least once every 30 days to keep Pro active permanently.

---

## 🎯 What to Work On

We keep high-value engineering opportunities clearly organized:
- [**`TODO.md`**](TODO.md) — Concrete architectural bottlenecks, sync challenges, security hardening, and performance pain points.
- [**`ROADMAP.md`**](ROADMAP.md) — Decade-scale pillars and long-term systemic architecture.
- [**GitHub Issues**](https://github.com/Kylrix/kylrix/issues) — Triaged feature requests and active bug reports.

*Note: To keep code quality world-class, trivial commits (typo fixes, spacing tweaks) are not eligible for automated Pro renewal. We encourage tackling real roadmap issues.*

---

## 🛠️ Development Setup

### 1. Fork & Clone
```bash
git clone https://github.com/<your-username>/kylrix.git
cd kylrix
```

### 2. Install Dependencies
```bash
# We strictly use pnpm
pnpm install
```

### 3. Local Development
```bash
# Launch Next.js application
pnpm dev
# App starts on http://localhost:3005
```

### 4. CLI Development (`@kylrix/cli`)
```bash
# Build CLI subpackage
pnpm --filter @kylrix/cli build

# Test local CLI commands
./packages/cli/dist/index.js --help
```

---

## 📋 Pull Request Guidelines

1. **Focused Scope**: Keep PRs focused on a single issue or pain point.
2. **Commit Hygiene**: Write clear, descriptive commit messages. Do not add co-author or bot signatures.
3. **Continuous Testing**: Ensure all unit tests pass before opening your PR:
   ```bash
   pnpm test
   ```
4. **Link Your PR**: Reference the corresponding item in `TODO.md` or GitHub Issue in your PR description.
