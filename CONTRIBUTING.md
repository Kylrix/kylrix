# Contributing to Kylrix 🏴

Thank you for contributing to the future of sovereign, agentic workspaces. To ensure the integrity and high velocity of the Kylrix ecosystem, please follow these guidelines.

---

## 🏛️ The Contributor's Path

### 1. Study the Architecture
Before touching any code, you must read the [ARCHITECTURE.md](ARCHITECTURE.md). It outlines the core security protocols (WESP), identity management, and ZK-principles that define Kylrix. Understanding these is mandatory to avoid breaking system-wide security invariants.

### 2. Leverage Agent Skills
Kylrix features a modular "Skill" architecture to assist with development and maintenance.
- **Check available skills**: Run `ls .agents/skills/` to see available tools.
- **Use skills proactively**: If you are working on a specific area (e.g., UI, security, or API flows), activate the relevant skill using the agent CLI. These skills provide pre-baked, expert-vetted workflows for common tasks.

### 3. Local Workflow
We prioritize simplicity.
- **Install Dependencies**: `pnpm install`
- **Start Development**: `pnpm dev`
- **Verify**: Run `pnpm build` to ensure your changes pass the production build check before submitting.

### 4. Strict Mandates
- **Sovereign Source Control**: We maintain an external, independent source control workflow. **DO NOT run `git commit`, `git add`, `git push`, or any other Git-modifying commands.** You are strictly prohibited from altering the repository history or index.
- **Surgical Changes**: Resolve identified issues surgically. Do not perform speculative refactoring.
- **Design Philosophy**: Adhere to the "Muted Bold" (Deep Earth) design language. No gradients, no translucency, pure OLED-black backgrounds.

### 5. Responsible Disclosure
If you find a security vulnerability, **do not disclose it publicly**. Send a comprehensive report, including logs, directly to `security@kylrix.space`.

---

**Build freely. Stay sovereign. Work while you sleep.** 🌙
