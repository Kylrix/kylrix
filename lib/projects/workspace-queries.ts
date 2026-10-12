/** Indexed queries for workspaces. */
export function ownedWorkspaceListQueries(ownerId: string) {
  return [
    `equal("ownerId", ${JSON.stringify(ownerId)})`,
    `notEqual("isTrash", true)`,
  ];
}
