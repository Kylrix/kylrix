# Incident Report: Goal Title Squeezing & wrapping

This document logs the layout bug affecting the goal detail panel title and the attempts made to resolve it.

## 1. The Problem
When opening the goal detail panel (TaskDetails), the title text was being constrained to a narrow width (under 1/5th of the container width), causing it to wrap incessantly into a vertical wall of text while leaving empty horizontal space on the side.

## 2. Analyzed Layout Hierarchy
- **Header Grid**: The header uses `<div className="flex items-start justify-between gap-4">`.
- **Title Block**: The title on the left is wrapped in `<div className="flex items-start gap-2 flex-1 min-w-0">`.
- **Title Element**: The `<h2>` element representing the title was styled with `inline-flex items-center gap-2`.
- **Buttons Block**: The button tray on the right uses `<div className="flex items-center gap-1.5 flex-shrink-0">`.

## 3. Suspected Cause
Under flex layout conditions, `inline-flex` restricts the element to shrink-wrap its contents minimum-width instead of expanding to occupy the `flex-1` space allocated by its parent. This caused the title text to wrap to the absolute minimum width (less than 1/5th of the header space).

## 4. Attempts
- **Attempt 1**: Focused on the description box layout wrapper (`min-h-[100px] md:min-h-[140px] flex`), changing it to `w-full` (this did not address the title header).
- **Attempt 2**: Replaced `inline-flex` with `flex w-full` on the `<h2>` — still squeezed because SyncStatusDot/Label lived **inside** the title flex row.
- **Fix (shipped)**: Dedicated text column (`flex-1 min-w-0 flex flex-col`): block `h2`/`input` for the title; status on a separate `shrink-0` row below (same pattern as note detail content header). Action buttons stay `shrink-0` on the right.
- **Fix 2**: Break the shared line entirely — **row 1** = back + action icons only; **row 2** = full-width title (+ sync status). Title no longer competes with chrome for horizontal space.
