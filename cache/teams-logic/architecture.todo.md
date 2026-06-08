# Hybrid Team Collaboration Architecture

## Architectural Summary
To bypass the 8-user limit without inflating individual database row permissions, Kylrix implements a **Hybrid Collaboration Protocol**.
- The first 8 collaborators are bound directly to the resource via the `collaborators` table, establishing an immutable base with `Role.user()` access.
- For Pro workspaces extending beyond 8 members, a background Appwrite Team is silently provisioned. Members 9+ are added to this background team.
- The resource's database ACL is updated to grant `Role.team(ID)` read access.
- **Zero-Trust Downgrade Guarantee**: If the Pro subscription expires, the background team is purged. This instantly revokes access for members 9+, but the foundational 8 collaborators remain untouched. This self-cleaning fallback guarantees safety and incentivizes upgrades without destroying the user's workspace structure upon downgrade.

## Security Mandate
- **Read-Only RLS Absolute**: Appwrite Teams provide **Read-Only** database access via `read("team:ID")`.
- **Write Escalation**: All write operations for Team members route strictly through `secure-ops.ts` Server Actions, which check the actor's membership and execute mutations via the elevated Admin SDK. No client can mutate records directly.

## To-Do List

- [ ] **1. Provision Background Team Creation**
  - Implement a hook in `secure-ops.ts` to automatically provision a hidden Appwrite Team when a Pro user adds a 9th collaborator to a Project or Goal.

- [ ] **2. Refactor ACL Permissions Sync**
  - Update `updateNoteAccessForUser` (or equivalent resource permission functions) to dynamically append `read("team:<ID>")` to the row's permissions if a background team exists.

- [ ] **3. Implement Team Role Mapping**
  - Map Kylrix roles (e.g., 'editor', 'viewer') to Appwrite Team Membership roles (`Role.team(ID, ['editor'])`) to enforce granular CRUD limits for members 9+.

- [ ] **4. Server Action Validation Updates**
  - Refactor `verifyResourcePermissionSecure` to check both the `collaborators` table AND Appwrite Team membership when evaluating if an actor has write/delete privileges.

- [ ] **5. Automated Downgrade Purge**
  - Implement the downgrade lifecycle hook. When Pro status is lost, identify all background teams owned by the user, sever the resource links, and delete the teams to enforce the free-tier boundaries cleanly.
