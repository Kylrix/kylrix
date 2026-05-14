Task: Architect a non-blocking UI/task framework for the app.

Problem:
- The UI has blocking hotspots, especially in the topbar and several subapps like note, flow, connect, and vault.
- Some components and background-style work appear to run on the main interaction path and freeze or hang pages.

Goal:
- Define a superior non-blocking architecture that keeps current and future background tasks isolated, reliable, and safe to plug into.
- Preserve the codebase shape while reducing UI freezes and click starvation.

Scope:
- Audit the codebase for current task, process, and topbar interaction patterns.
- Identify where work should move off the critical UI path into safer background execution.
- Produce a framework-level task plan for delegation, scheduling, and lifecycle handling.

Notes:
- This is a cache task only; do not change implementation files here.
- Prefer approaches that fit the existing Next.js/Node.js stack and do not introduce new attack surface.
