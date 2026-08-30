import type { Models } from 'appwrite';

export enum TargetType {
    NOTE = "note",
    COMMENT = "comment"
}

export type Users = Models.Row & {
    id: string | null;
    email: string | null;
    name: string | null;
    username?: string | null;
    displayName?: string | null;
    avatar?: string | null;
    bio?: string | null;
    walletAddress: string | null;
    authMethod?: string | null;
    profilePicId?: string | null;
    walletEth?: string | null;
    subscriptionTier?: string | 'FREE' | 'PRO' | 'LIFETIME';
    subscriptionExpiresAt?: string | null;
    publicProfile?: boolean | null;
    deletedAt?: string | null;
    identities?: any[] | null;
    createdAt: string | null;
    updatedAt: string | null;
    prefs?: any;
}

export type Notes = Models.Row & {
    id: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    userId: string | null;
    isPublic: boolean | null;
    isGuest: boolean | null;
    status: string | null;
    parentNoteId: string | null;
    title: string | null;
    content: string | null;
    tags: string[] | null;
    comments: string[] | null;
    extensions: string[] | null;
    collaborators: string[] | null;
    metadata: string | null;
    format: string | null;
    attachments: string[] | null;
    article?: boolean | null;
    // Virtual attributes (hydrated from metadata)
    linkedTaskId?: string | null;
    linkedTaskIds?: string[] | null;
    linkedEventId?: string | null;
    linkedEventIds?: string[] | null;
    linkedCredentialId?: string | null;
    linkedCredentialIds?: string[] | null;
    linkedSource?: string | null;
    isPinned?: boolean | null;
    isEncrypted?: boolean | null;
    isThread?: boolean;
    isChat?: boolean;
    creatorId?: string | null;
    resourceId?: string | null;
    resourceType?: string | null;
    keepPermission?: boolean | null;
    source?: string | null;
    dek?: string | null;
    isDeleted?: boolean;
    /** True when this object lives outside the default (no-workspace) view. */
    isWorkspace?: boolean | null;
    }

    export type Tags = Models.Row & {
    id: string | null;
    name: string | null;
    notes: string[] | null;
    createdAt: string | null;
    color: string | null;
    description: string | null;
    isDeleted?: boolean;
    userId: string | null;
    nameLower: string | null;
};

export type Comments = Models.Row & {
    noteId: string;
    userId: string;
    content: string;
    createdAt: string;
    parentCommentId: string | null;
}

export type Reactions = Models.Row & {
    targetType: TargetType;
    emoji: string;
    createdAt: string;
    targetId: string;
    userId: string;
}

export type ActivityLog = Models.Row & {
    userId: string;
    action: string;
    targetType: string;
    targetId: string;
    timestamp: string;
    details: string | null;
}

export type Settings = Models.Row & {
    userId: string;
    settings: string;
    createdAt: string | null;
    updatedAt: string | null;
    mode: string | null;
}

export type SecurityLogs = Models.Row & { userId: string; eventType: string; ipAddress: string | null; userAgent: string | null; deviceFingerprint: string | null; details: string | null; success: boolean; severity: string; timestamp: string; }

export type Credentials = Models.Row & { userId: string; itemType: string; name: string; url: string | null; notes: string | null; totpId: string | null; username: string | null; password: string | null; cardNumber: string | null; cardholderName: string | null; cardExpiry: string | null; cardCVV: string | null; cardPIN: string | null; cardType: string | null; folderId: string | null; tags: string[] | null; customFields: string | null; faviconUrl: string | null; isFavorite: boolean; isDeleted: boolean; deletedAt: string | null; lastAccessedAt: string | null; passwordChangedAt: string | null; createdAt: string | null; updatedAt: string | null; attachments: string | null; isPinned?: boolean | null; isPublic?: boolean | null; isGuest?: boolean | null; sharedFrom?: string | null; dek?: string | null; keepPermission?: boolean | null; source?: string | null; isWorkspace?: boolean | null; }

export type User = Models.Row & { userId: string; email: string | null; masterpass: boolean | null; twofa: boolean | null; salt: string | null; twofaSecret: string | null; backupCodes: string | null; isPasskey: boolean | null; check: string | null; passkeyBlob: string | null; credentialId: string | null; publicKey: string | null; counter: number | null; authVersion: number; v2Migrated: boolean; mustCreatePasskey: boolean; sessionFingerprint: string | null; lastLoginAt: string | null; lastPasswordChangeAt: string | null; createdAt: string | null; updatedAt: string | null; }

export type Folders = Models.Row & { userId: string; name: string; parentFolderId: string | null; icon: string | null; color: string | null; sortOrder: number; isDeleted: boolean; deletedAt: string | null; createdAt: string | null; updatedAt: string | null; }

export type TotpSecrets = Models.Row & { userId: string; issuer: string; accountName: string; secretKey: string; algorithm: string; digits: number; period: number; url: string | null; folderId: string | null; tags: string[] | null; isFavorite: boolean; isDeleted: boolean; deletedAt: string | null; lastUsedAt: string | null; createdAt: string | null; updatedAt: string | null; isPinned?: boolean | null; isPublic?: boolean | null; isGuest?: boolean | null; sharedFrom?: string | null; dek?: string | null; keepPermission?: boolean | null; source?: string | null; isWorkspace?: boolean | null; }

export type EventGuests = Models.Row & {
    eventId: string;
    userId: string | null;
    email: string | null;
    status: string;
    role: string;
}

export type Events = Models.Row & {
    title: string;
    description: string | null;
    startTime: string;
    endTime: string;
    location: string | null;
    meetingUrl: string | null;
    visibility: string;
    status: string;
    coverImageId: string | null;
    maxAttendees: number;
    recurrenceRule: string | null;
    calendarId: string;
    userId: string;
    isPinned?: boolean | null;
    isPublic?: boolean | null;
    isGuest?: boolean | null;
    keepPermission?: boolean | null;
    source?: string | null;
    isDeleted?: boolean;
    updatedAt?: string | null;
    isWorkspace?: boolean | null;
}

export type Calendars = Models.Row & {
    name: string;
    color: string;
    isDefault: boolean;
    userId: string;
}

export type Tasks = Models.Row & {
    title: string;
    description: string | null;
    status: string;
    priority: string;
    dueDate: string | null;
    recurrenceRule: string | null;
    tags: string[] | null;
    assigneeIds: string[] | null;
    attachmentIds: string[] | null;
    eventId: string | null;
    userId: string;
    parentId: string | null;
    isPinned?: boolean | null;
    isPublic?: boolean | null;
    isGuest?: boolean | null;
    keepPermission?: boolean | null;
    source?: string | null;
    isDeleted?: boolean;
    updatedAt?: string | null;
    scheduled?: boolean | null;
    isAgentic?: boolean | null;
    isEncrypted?: boolean | null;
    dek?: string | null;
    isWorkspace?: boolean | null;
}

export type Projects = Models.Row & {
    title: string;
    summary: string | null;
    description: string | null;
    ownerId: string;
    visibility: 'private' | 'shared' | 'public';
    status: 'active' | 'paused' | 'archived' | 'completed' | 'on_hold';
    metadata: string | null;
    kind?: 'workspace' | 'project' | null;
    parentProjectId?: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    isDeleted?: boolean;
    isPinned?: boolean;
    isGuest?: boolean;
    isPublic?: boolean;
}

export type ProjectObjects = Models.Row & {
    projectId: string;
    entityKind: string;
    entityId: string;
    role: string | null;
    position: number;
    metadata: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    isDeleted?: boolean;
    isPinned?: boolean;
}

// Keychain / KeyMapping — from generated SoT (not duplicated here)
export type { Keychain, KeyMapping } from '@/generated/appwrite/types';
