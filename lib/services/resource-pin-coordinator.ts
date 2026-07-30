'use client';

import {
  PinnableResourceType,
  UserResourcePinService} from '@/lib/services/user-resource-pins';

;

const PER_USER_ONLY_TYPES: PinnableResourceType[] = ['message', 'conversation'];

export async function toggleResourcePin(params: {
  actorId: string;
  ownerId: string;
  resourceType: PinnableResourceType;
  resourceId: string;
  currentlyPinned: boolean;
  setOwnerRowPin: (pinned: boolean) => Promise<void>;
}): Promise<boolean> {
  const { actorId, ownerId, resourceType, resourceId, currentlyPinned, setOwnerRowPin } = params;
  const nextPinned = !currentlyPinned;

  if (PER_USER_ONLY_TYPES.includes(resourceType)) {
    if (nextPinned) {
      await UserResourcePinService.pin(actorId, resourceType, resourceId);
    } else {
      await UserResourcePinService.unpin(actorId, resourceType, resourceId);
    }
    return nextPinned;
  }

  const isOwner = actorId === ownerId;

  if (isOwner) {
    await setOwnerRowPin(nextPinned);
    return nextPinned;
  }

  if (nextPinned) {
    await UserResourcePinService.pin(actorId, resourceType, resourceId);
  } else {
    await UserResourcePinService.unpin(actorId, resourceType, resourceId);
  }
  return nextPinned;
}
