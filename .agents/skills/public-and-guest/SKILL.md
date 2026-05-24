# Public & Guest Paradigm (Global Resource Perms)

## The Evolution from Metadata to Native Columns
Previously, the Kylrix ecosystem relied on `metadata` JSON parsing or client SDK roles (e.g. `Role.any()`) to govern broad access rules (like public links or guest access). To improve query performance and support secure server-side SDK actions without costly JSON scans, we now strictly utilize native columns for resource visibility:

### 1. `isPublic` (boolean | null)
- **Purpose**: Defines whether a resource is globally readable outside the immediate collaborator pool.
- **Default**: `false` or `null` (treated as Private).
- **Usage**: Enables server actions to instantly filter or serve public links (e.g., published forms, public notes) simply via `Query.equal('isPublic', true)`.

### 2. `isGuest` (boolean | null)
- **Purpose**: Specifically governs whether unauthenticated (guest) users can interact with or submit data to a resource.
- **Default**: `false` or `null` (treated as Denied).
- **Usage**: Primarily used in Form deployments to determine if anonymous submissions are accepted, completely bypassing the need to grant `guests()` write permissions at the database level.

### 3. `isGeneral` (boolean | null)
- **Purpose**: Determines broad internal access for resources linked to an umbrella container (like a Project).
- **Default**: `false` or `null` (Requires manual, discrete collaborator selection).
- **Usage**: When a note, task, or credential is added to a project with `isGeneral = true`, every member of that project automatically inherits access to the resource. This eliminates the need to recursively update discrete collaborator tables when new members join the parent container.

## Developer Rules
- **Never** use `settings.allowAnonymousFill` or similar nested JSON properties as the primary source of truth for access queries. Always rely on the native columns.
- **Always** ensure your `Query.select` arrays pull `isPublic`, `isGuest`, and `isGeneral` when mapping resource states.
- **Fallbacks**: When reading older documents, fallback gracefully (e.g. `form.isGuest ?? JSON.parse(form.settings).allowAnonymousFill ?? false`).
