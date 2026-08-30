import { Query } from 'node-appwrite';

/** Indexed queries for top-level workspaces (excludes sub-projects). */
export function ownedWorkspaceListQueries(ownerId: string) {
  return [
    Query.equal('ownerId', ownerId),
    Query.notEqual('isTrash', true),
    Query.isNull('parentProjectId'),
    Query.or([
      Query.equal('kind', 'workspace'),
      Query.isNull('kind'),
    ]),
  ];
}

/** Indexed queries for sub-projects under a parent workspace. */
export function subProjectsListQueries(parentWorkspaceId: string) {
  return [
    Query.equal('parentProjectId', parentWorkspaceId),
    Query.equal('kind', 'project'),
    Query.notEqual('isTrash', true),
    Query.orderDesc('updatedAt'),
  ];
}
