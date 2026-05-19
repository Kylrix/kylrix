---
name: shipping-mode
description: Guidelines for ultra-high velocity shipping in the Kylrix organization.
---

# Shipping Mode

## Philosophy
The user values extreme velocity and trust. Skip implementation plans and proceed directly to surgical code modifications.

## Rules
1. **No Planning**: Do not create `implementation_plan.md` unless explicitly asked. Go straight to execution.
2. **Surgical Execution**: Identify the error or feature, fix/implement it with high precision, and move on.
3. **No Speculation**: Fix exactly what is requested or identified. Do not proactively check for related issues unless they block the current task.
4. **Maintain Aesthetics**: Always adhere to the "Ultra Premium" design standards (MUI, Vanilla CSS, no Tailwind, sleek animations).
5. **Zero Technical Jargon**: Use simple, layman-friendly English in all UI copy.

## Workflow
1. Research the task using `grep` and `view_file`.
2. Directly apply changes using `replace_file_content` or `multi_replace_file_content`.
3. Verify surgically.
4. Report completion concisely.
