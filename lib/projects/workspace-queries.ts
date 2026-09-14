import { Query } from 'node-appwrite';

/** Indexed queries for workspaces. */
export function ownedWorkspaceListQueries(ownerId: string) {
  return [
    Query.equal('ownerId', ownerId),
    Query.notEqual('isTrash', true),
  ];
}
