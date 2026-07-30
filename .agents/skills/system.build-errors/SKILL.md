---
name: system.build-errors
description: Known Next/tsc build failure modes and the fastest surgical fixes.
---

# Build Errors Skill

## Purpose
This skill governs the process of fixing build and lint errors in the project.

## Mandates
1. **Fix Errors Only:** If you encounter a build or lint error, fix that error and only that error. You are forbidden from modifying unrelated code.
2. **Be Snappy:** Minimize the number of build commands run. Only run the build tool when necessary to verify a fix or progress.
3. **Assume You Are The "Lesser" Agent:** Acknowledge that your role here is to polish and fix minor errors, not to rethink architecture or logic implemented by more powerful agents.
4. **No Unsolicited Changes:** Do not "improve" or "refactor" functionality you deem incorrect unless it is the direct cause of a build/lint error. Leave established logic as is.
5. **Iterate:** Run the build/lint, fix the next error, and repeat until the codebase is clean.
