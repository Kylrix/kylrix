---
name: why.ispublic-isguest-escape-hatches
description: Detail the isPublic, isGuest, and isGeneral columns that serve as secure server-side escape hatches to manage resource access for public, guest, and project contexts.
---

# Why: Public, Guest, and Project Resource Escape Hatches

To support rich sharing flows (such as publishing a note to the public web or adding a resource to a shared project) without bloating our database permissions, Kylrix utilizes column-level escape hatches: **`isPublic`**, **`isGuest`**, and **`isGeneral`**.

We process these flags in `lib/actions/secure-ops.ts` and `lib/permissions.ts`.

---

## 1. `isPublic` vs. `isGuest` Columns

At the database level, we keep native ACL permissions private to protect against scraping attacks. When a user shares a resource publicly, we update these column flags instead of modifying database permissions:

- **`isPublic: true`**: Tells the Server SDK that the resource can be served to any **authenticated user** in the ecosystem (e.g. enabling discovery in search queries).
- **`isGuest: true`**: Tells the Server SDK that the resource can be served to **anyone, literally anybody** (including unauthenticated browser sessions).

```typescript
// Gating access checks in secure-ops.ts
export async function getResourceSecure(rowId: string, jwt?: string) {
  const adminTables = createSystemTablesDB();
  const row = await adminTables.getRow(DB_ID, TABLE_ID, rowId);
  
  // 1. Check Guest Access (No auth required)
  if (row.isGuest === true) {
    return sanitizeOutput(row);
  }
  
  // 2. Resolve Active Actor
  const actor = jwt ? await getActor(jwt) : null;
  if (!actor && row.isPublic === true) {
    throw new Error('Unauthorized: Authentication required to view this public resource.');
  }
  
  // 3. Check Public Access (Authenticated only)
  if (row.isPublic === true) {
    return sanitizeOutput(row);
  }
  
  // 4. Fallback to strict ACL checks for private assets...
  if (row.userId === actor?.$id || isCollaborator(row, actor?.$id)) {
    return row;
  }
  
  throw new Error('Forbidden');
}
```

---

## 2. Project Resources: The `isGeneral` Flag

When a resource (like a Note or Task) is added to a Project, we need to determine its access rules:
- Does it inherit the project's permissions and become visible to all project members?
- Or does it retain its own isolated permission logic?

We solve this using the **`isGeneral`** flag in the project resources table:

```typescript
// Checking project resource access
const isProjectAuthorized = async () => {
  const mapping = await adminTables.getRow(FLOW_DB, PROJECT_RESOURCES_TABLE, mappingId);
  
  if (mapping.isGeneral === true) {
    // Inherit project-level access: if the user is in the project, they can view the note
    return await isProjectMember(projectId, actor.$id);
  }
  
  // Keep original permission logic: check user permissions on the resource itself
  return await hasDirectResourceAccess(mapping.resourceId, actor.$id);
};
```

This hybrid model gives users granular control over their data sharing within collaborative projects.
