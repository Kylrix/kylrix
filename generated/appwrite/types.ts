import { type Models } from 'appwrite';

export enum NotesStatus {
    DRAFT = "draft",
    PUBLISHED = "published",
    ARCHIVED = "archived"
}

export enum ReactionsTargetType {
    NOTE = "note",
    COMMENT = "comment"
}

export enum CollaboratorsPermission {
    READ = "read",
    WRITE = "write",
    ADMIN = "admin"
}

export enum NoteRevisionsCause {
    MANUAL = "manual",
    AI = "ai",
    COLLAB = "collab"
}

export enum SubscriptionsPlan {
    FREE = "free",
    PRO = "pro",
    ORG = "org"
}

export enum SubscriptionsStatus {
    ACTIVE = "active",
    CANCELED = "canceled",
    TRIALING = "trialing"
}

export enum MessagesType {
    TEXT = "text",
    IMAGE = "image",
    VIDEO = "video",
    AUDIO = "audio",
    FILE = "file",
    CALL_SIGNAL = "call_signal",
    SYSTEM = "system"
}

export enum ConversationsType {
    DIRECT = "direct",
    GROUP = "group",
    CHANNEL = "channel",
    BROADCAST = "broadcast",
    COMMUNITY = "community"
}

export enum ContactsRelationship {
    FRIEND = "friend",
    FAMILY = "family",
    COLLEAGUE = "colleague",
    ACQUAINTANCE = "acquaintance",
    BLOCKED = "blocked",
    FAVORITE = "favorite"
}

export enum FollowsStatus {
    PENDING = "pending",
    ACCEPTED = "accepted",
    BLOCKED = "blocked"
}

export enum AppActivityStatus {
    ONLINE = "online",
    OFFLINE = "offline",
    AWAY = "away",
    BUSY = "busy"
}

export enum CallLinksType {
    AUDIO = "audio",
    VIDEO = "video"
}

export enum CallLogsType {
    AUDIO = "audio",
    VIDEO = "video"
}

export enum CallLogsStatus {
    MISSED = "missed",
    COMPLETED = "completed",
    DECLINED = "declined",
    ONGOING = "ongoing"
}

export enum MomentsType {
    IMAGE = "image",
    VIDEO = "video"
}

export enum FormsStatus {
    DRAFT = "draft",
    PUBLISHED = "published",
    CLOSED = "closed"
}

export enum FormsVisibility {
    PRIVATE = "private",
    PUBLIC = "public",
    WORKSPACE = "workspace"
}

export enum FormSubmissionsStatus {
    UNREAD = "unread",
    READ = "read",
    ARCHIVED = "archived",
    FLAGGED = "flagged"
}
export type WhisperNoteUsersCreate = {
    "id"?: string | null;
    "email"?: string | null;
    "name"?: string | null;
    "walletAddress"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
}

export type WhisperNoteUsers = Models.Row & {
    "id"?: string | null;
    "email"?: string | null;
    "name"?: string | null;
    "walletAddress"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
}

export type NotesCreate = {
    "id"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
    "userId"?: string | null;
    "isPublic"?: boolean | null;
    "status"?: NotesStatus | null;
    "parentNoteId"?: string | null;
    "title"?: string | null;
    "content"?: string | null;
    "tags"?: string[] | null;
    "comments"?: string[] | null;
    "extensions"?: string[] | null;
    "collaborators"?: string[] | null;
    "metadata"?: string | null;
    "attachments"?: string | null;
    "format"?: string | null;
}

export type Notes = Models.Row & {
    "id"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
    "userId"?: string | null;
    "isPublic"?: boolean | null;
    "status"?: NotesStatus | null;
    "parentNoteId"?: string | null;
    "title"?: string | null;
    "content"?: string | null;
    "tags"?: string[] | null;
    "comments"?: string[] | null;
    "extensions"?: string[] | null;
    "collaborators"?: string[] | null;
    "metadata"?: string | null;
    "attachments"?: string | null;
    "format"?: string | null;
}

export type TagsCreate = {
    "id"?: string | null;
    "name"?: string | null;
    "notes"?: string[] | null;
    "createdAt"?: string | null;
    "color"?: string | null;
    "description"?: string | null;
    "usageCount"?: number | null;
    "userId"?: string | null;
    "nameLower"?: string | null;
}

export type Tags = Models.Row & {
    "id"?: string | null;
    "name"?: string | null;
    "notes"?: string[] | null;
    "createdAt"?: string | null;
    "color"?: string | null;
    "description"?: string | null;
    "usageCount"?: number | null;
    "userId"?: string | null;
    "nameLower"?: string | null;
}

export type ApiKeysCreate = {
    "id"?: string | null;
    "key"?: string | null;
    "name"?: string | null;
    "userId"?: string | null;
    "createdAt"?: string | null;
    "lastUsed"?: string | null;
    "expiresAt"?: string | null;
    "scopes"?: string[] | null;
    "lastUsedIp"?: string | null;
    "keyHash"?: string | null;
}

export type ApiKeys = Models.Row & {
    "id"?: string | null;
    "key"?: string | null;
    "name"?: string | null;
    "userId"?: string | null;
    "createdAt"?: string | null;
    "lastUsed"?: string | null;
    "expiresAt"?: string | null;
    "scopes"?: string[] | null;
    "lastUsedIp"?: string | null;
    "keyHash"?: string | null;
}

export type CommentsCreate = {
    "noteId": string;
    "userId": string;
    "content": string;
    "createdAt": string;
    "parentCommentId"?: string | null;
}

export type Comments = Models.Row & {
    "noteId": string;
    "userId": string;
    "content": string;
    "createdAt": string;
    "parentCommentId"?: string | null;
}

export type ExtensionsCreate = {
    "name": string;
    "description"?: string | null;
    "version"?: string | null;
    "authorId"?: string | null;
    "enabled"?: boolean | null;
    "settings"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
    "isPublic"?: boolean | null;
}

export type Extensions = Models.Row & {
    "name": string;
    "description"?: string | null;
    "version"?: string | null;
    "authorId"?: string | null;
    "enabled"?: boolean | null;
    "settings"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
    "isPublic"?: boolean | null;
}

export type ReactionsCreate = {
    "targetType": ReactionsTargetType;
    "emoji": string;
    "createdAt": string;
    "targetId": string;
    "userId": string;
}

export type Reactions = Models.Row & {
    "targetType": ReactionsTargetType;
    "emoji": string;
    "createdAt": string;
    "targetId": string;
    "userId": string;
}

export type CollaboratorsCreate = {
    "noteId": string;
    "userId": string;
    "permission": CollaboratorsPermission;
    "invitedAt"?: string | null;
    "accepted"?: boolean | null;
}

export type Collaborators = Models.Row & {
    "noteId": string;
    "userId": string;
    "permission": CollaboratorsPermission;
    "invitedAt"?: string | null;
    "accepted"?: boolean | null;
}

export type ActivityLogCreate = {
    "userId": string;
    "action": string;
    "targetType": string;
    "targetId": string;
    "timestamp": string;
    "details"?: string | null;
}

export type ActivityLog = Models.Row & {
    "userId": string;
    "action": string;
    "targetType": string;
    "targetId": string;
    "timestamp": string;
    "details"?: string | null;
}

export type SettingsCreate = {
    "userId": string;
    "settings": string;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
    "mode"?: string | null;
}

export type Settings = Models.Row & {
    "userId": string;
    "settings": string;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
    "mode"?: string | null;
}

export type WalletMapCreate = {
    "walletAddressLower": string;
    "userId": string;
    "updatedAt"?: string | null;
}

export type WalletMap = Models.Row & {
    "walletAddressLower": string;
    "userId": string;
    "updatedAt"?: string | null;
}

export type NoteTagsCreate = {
    "noteId": string;
    "tagId": string;
    "userId": string;
    "createdAt"?: string | null;
    "tag"?: string | null;
}

export type NoteTags = Models.Row & {
    "noteId": string;
    "tagId": string;
    "userId": string;
    "createdAt"?: string | null;
    "tag"?: string | null;
}

export type NoteRevisionsCreate = {
    "noteId": string;
    "revision": number;
    "userId"?: string | null;
    "title"?: string | null;
    "content"?: string | null;
    "createdAt"?: string | null;
    "diff"?: string | null;
    "diffFormat"?: string | null;
    "fullSnapshot"?: boolean | null;
    "cause"?: NoteRevisionsCause | null;
}

export type NoteRevisions = Models.Row & {
    "noteId": string;
    "revision": number;
    "userId"?: string | null;
    "title"?: string | null;
    "content"?: string | null;
    "createdAt"?: string | null;
    "diff"?: string | null;
    "diffFormat"?: string | null;
    "fullSnapshot"?: boolean | null;
    "cause"?: NoteRevisionsCause | null;
}

export type AiGenerationsCreate = {
    "userId": string;
    "promptHash"?: string | null;
    "prompt"?: string | null;
    "mode"?: string | null;
    "providerId"?: string | null;
    "model"?: string | null;
    "durationMs"?: number | null;
    "tokensUsed"?: number | null;
    "success"?: boolean | null;
    "error"?: string | null;
    "createdAt"?: string | null;
}

export type AiGenerations = Models.Row & {
    "userId": string;
    "promptHash"?: string | null;
    "prompt"?: string | null;
    "mode"?: string | null;
    "providerId"?: string | null;
    "model"?: string | null;
    "durationMs"?: number | null;
    "tokensUsed"?: number | null;
    "success"?: boolean | null;
    "error"?: string | null;
    "createdAt"?: string | null;
}

export type SubscriptionsCreate = {
    "userId": string;
    "plan": SubscriptionsPlan;
    "status"?: SubscriptionsStatus | null;
    "currentPeriodStart"?: string | null;
    "currentPeriodEnd"?: string | null;
    "seats"?: number | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
}

export type Subscriptions = Models.Row & {
    "userId": string;
    "plan": SubscriptionsPlan;
    "status"?: SubscriptionsStatus | null;
    "currentPeriodStart"?: string | null;
    "currentPeriodEnd"?: string | null;
    "seats"?: number | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
}

export type SecurityLogsCreate = {
    "userId": string;
    "eventType": string;
    "ipAddress"?: string | null;
    "userAgent"?: string | null;
    "deviceFingerprint"?: string | null;
    "details"?: string | null;
    "success": boolean;
    "severity"?: string;
    "timestamp": string;
}

export type SecurityLogs = Models.Row & {
    "userId": string;
    "eventType": string;
    "ipAddress"?: string | null;
    "userAgent"?: string | null;
    "deviceFingerprint"?: string | null;
    "details"?: string | null;
    "success": boolean;
    "severity"?: string;
    "timestamp": string;
}

export type CredentialsCreate = {
    "userId": string;
    "itemType": string;
    "name": string;
    "url"?: string | null;
    "notes"?: string | null;
    "totpId"?: string | null;
    "password"?: string | null;
    "cardNumber"?: string | null;
    "cardholderName"?: string | null;
    "cardExpiry"?: string | null;
    "cardCVV"?: string | null;
    "cardPIN"?: string | null;
    "cardType"?: string | null;
    "folderId"?: string | null;
    "tags"?: string[] | null;
    "customFields"?: string | null;
    "faviconUrl"?: string | null;
    "isFavorite"?: boolean;
    "isDeleted"?: boolean;
    "deletedAt"?: string | null;
    "lastAccessedAt"?: string | null;
    "passwordChangedAt"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
    "username"?: string | null;
}

export type Credentials = Models.Row & {
    "userId": string;
    "itemType": string;
    "name": string;
    "url"?: string | null;
    "notes"?: string | null;
    "totpId"?: string | null;
    "password"?: string | null;
    "cardNumber"?: string | null;
    "cardholderName"?: string | null;
    "cardExpiry"?: string | null;
    "cardCVV"?: string | null;
    "cardPIN"?: string | null;
    "cardType"?: string | null;
    "folderId"?: string | null;
    "tags"?: string[] | null;
    "customFields"?: string | null;
    "faviconUrl"?: string | null;
    "isFavorite"?: boolean;
    "isDeleted"?: boolean;
    "deletedAt"?: string | null;
    "lastAccessedAt"?: string | null;
    "passwordChangedAt"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
    "username"?: string | null;
}

export type IdentitiesCreate = {
    "userId": string;
    "identityType": string;
    "label": string;
    "credentialId"?: string | null;
    "publicKey"?: string | null;
    "counter"?: number;
    "passkeyBlob"?: string | null;
    "transports"?: string[] | null;
    "aaguid"?: string | null;
    "deviceInfo"?: string | null;
    "isPrimary"?: boolean;
    "isBackup"?: boolean;
    "lastUsedAt"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
}

export type Identities = Models.Row & {
    "userId": string;
    "identityType": string;
    "label": string;
    "credentialId"?: string | null;
    "publicKey"?: string | null;
    "counter"?: number;
    "passkeyBlob"?: string | null;
    "transports"?: string[] | null;
    "aaguid"?: string | null;
    "deviceInfo"?: string | null;
    "isPrimary"?: boolean;
    "isBackup"?: boolean;
    "lastUsedAt"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
}

export type UserCreate = {
    "userId": string;
    "email"?: string | null;
    "masterpass"?: boolean | null;
    "twofa"?: boolean | null;
    "twofaSecret"?: string | null;
    "backupCodes"?: string | null;
    "isPasskey"?: boolean | null;
    "sessionFingerprint"?: string | null;
    "lastLoginAt"?: string | null;
    "lastPasswordChangeAt"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
}

export type User = Models.Row & {
    "userId": string;
    "email"?: string | null;
    "masterpass"?: boolean | null;
    "twofa"?: boolean | null;
    "twofaSecret"?: string | null;
    "backupCodes"?: string | null;
    "isPasskey"?: boolean | null;
    "sessionFingerprint"?: string | null;
    "lastLoginAt"?: string | null;
    "lastPasswordChangeAt"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
}

export type FoldersCreate = {
    "userId": string;
    "name": string;
    "parentFolderId"?: string | null;
    "icon"?: string | null;
    "color"?: string | null;
    "sortOrder"?: number;
    "isDeleted"?: boolean;
    "deletedAt"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
}

export type Folders = Models.Row & {
    "userId": string;
    "name": string;
    "parentFolderId"?: string | null;
    "icon"?: string | null;
    "color"?: string | null;
    "sortOrder"?: number;
    "isDeleted"?: boolean;
    "deletedAt"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
}

export type TotpSecretsCreate = {
    "userId": string;
    "issuer": string;
    "accountName": string;
    "secretKey": string;
    "algorithm": string;
    "digits": number;
    "period": number;
    "url"?: string | null;
    "folderId"?: string | null;
    "tags"?: string[] | null;
    "isFavorite"?: boolean;
    "isDeleted"?: boolean;
    "deletedAt"?: string | null;
    "lastUsedAt"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
}

export type TotpSecrets = Models.Row & {
    "userId": string;
    "issuer": string;
    "accountName": string;
    "secretKey": string;
    "algorithm": string;
    "digits": number;
    "period": number;
    "url"?: string | null;
    "folderId"?: string | null;
    "tags"?: string[] | null;
    "isFavorite"?: boolean;
    "isDeleted"?: boolean;
    "deletedAt"?: string | null;
    "lastUsedAt"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
}

export type KeychainCreate = {
    "userId": string;
    "type": string;
    "credentialId"?: string | null;
    "wrappedKey": string;
    "salt": string;
    "params"?: string | null;
    "isBackup"?: boolean;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
}

export type Keychain = Models.Row & {
    "userId": string;
    "type": string;
    "credentialId"?: string | null;
    "wrappedKey": string;
    "salt": string;
    "params"?: string | null;
    "isBackup"?: boolean;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
}

export type MessagesCreate = {
    "conversationId": string;
    "senderId": string;
    "createdAt": string;
    "updatedAt": string;
    "type": MessagesType;
    "content"?: string | null;
    "attachments"?: string[] | null;
    "replyTo"?: string | null;
    "readBy"?: string[] | null;
}

export type Messages = Models.Row & {
    "conversationId": string;
    "senderId": string;
    "createdAt": string;
    "updatedAt": string;
    "type": MessagesType;
    "content"?: string | null;
    "attachments"?: string[] | null;
    "replyTo"?: string | null;
    "readBy"?: string[] | null;
}

export type ConversationsCreate = {
    "type": ConversationsType;
    "name"?: string | null;
    "lastMessageId"?: string | null;
    "lastMessageAt"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
    "creatorId": string;
    "participants"?: string[] | null;
    "admins"?: string[] | null;
    "description"?: string | null;
    "avatarUrl"?: string | null;
    "avatarFileId"?: string | null;
    "avatar"?: string | null;
    "participantCount"?: number;
    "maxParticipants"?: number;
    "isEncrypted"?: boolean;
    "encryptionVersion"?: string | null;
    "encryptionKey"?: string | null;
    "isPinned": string[];
    "isMuted": string[];
    "isArchived": string[];
    "lastMessageText"?: string | null;
    "lastMessageSenderId"?: string | null;
    "unreadCount"?: string | null;
    "settings"?: string | null;
    "isPublic"?: boolean;
    "inviteLink"?: string | null;
    "inviteLinkExpiry"?: string | null;
    "category"?: string | null;
    "tags": string[];
    "contextType"?: string | null;
    "contextId"?: string | null;
}

export type Conversations = Models.Row & {
    "type": ConversationsType;
    "name"?: string | null;
    "lastMessageId"?: string | null;
    "lastMessageAt"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
    "creatorId": string;
    "participants"?: string[] | null;
    "admins"?: string[] | null;
    "description"?: string | null;
    "avatarUrl"?: string | null;
    "avatarFileId"?: string | null;
    "avatar"?: string | null;
    "participantCount"?: number;
    "maxParticipants"?: number;
    "isEncrypted"?: boolean;
    "encryptionVersion"?: string | null;
    "encryptionKey"?: string | null;
    "isPinned": string[];
    "isMuted": string[];
    "isArchived": string[];
    "lastMessageText"?: string | null;
    "lastMessageSenderId"?: string | null;
    "unreadCount"?: string | null;
    "settings"?: string | null;
    "isPublic"?: boolean;
    "inviteLink"?: string | null;
    "inviteLinkExpiry"?: string | null;
    "category"?: string | null;
    "tags": string[];
    "contextType"?: string | null;
    "contextId"?: string | null;
}

export type ContactsCreate = {
    "userId": string;
    "contactUserId": string;
    "nickname"?: string | null;
    "relationship"?: ContactsRelationship;
    "isBlocked"?: boolean;
    "isFavorite"?: boolean;
    "notes"?: string | null;
    "tags": string[];
    "lastInteraction"?: string | null;
    "addedAt"?: string | null;
    "updatedAt"?: string | null;
}

export type Contacts = Models.Row & {
    "userId": string;
    "contactUserId": string;
    "nickname"?: string | null;
    "relationship"?: ContactsRelationship;
    "isBlocked"?: boolean;
    "isFavorite"?: boolean;
    "notes"?: string | null;
    "tags": string[];
    "lastInteraction"?: string | null;
    "addedAt"?: string | null;
    "updatedAt"?: string | null;
}

export type ChatUsersCreate = {
    "username": string;
    "displayName"?: string | null;
    "bio"?: string | null;
    "walletAddress"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
    "publicKey"?: string | null;
    "avatar"?: string | null;
}

export type ChatUsers = Models.Row & {
    "username": string;
    "displayName"?: string | null;
    "bio"?: string | null;
    "walletAddress"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
    "publicKey"?: string | null;
    "avatar"?: string | null;
}

export type FollowsCreate = {
    "followerId": string;
    "followingId": string;
    "status"?: FollowsStatus;
    "isCloseFriend"?: boolean;
    "notificationsEnabled"?: boolean;
    "createdAt"?: string | null;
}

export type Follows = Models.Row & {
    "followerId": string;
    "followingId": string;
    "status"?: FollowsStatus;
    "isCloseFriend"?: boolean;
    "notificationsEnabled"?: boolean;
    "createdAt"?: string | null;
}

export type AppActivityCreate = {
    "userId": string;
    "status"?: AppActivityStatus;
    "lastSeen"?: string | null;
    "customStatus"?: string | null;
}

export type AppActivity = Models.Row & {
    "userId": string;
    "status"?: AppActivityStatus;
    "lastSeen"?: string | null;
    "customStatus"?: string | null;
}

export type CallLinksCreate = {
    "userId": string;
    "conversationId"?: string | null;
    "code": string;
    "type"?: CallLinksType;
    "url"?: string | null;
    "expiresAt"?: string | null;
}

export type CallLinks = Models.Row & {
    "userId": string;
    "conversationId"?: string | null;
    "code": string;
    "type"?: CallLinksType;
    "url"?: string | null;
    "expiresAt"?: string | null;
}

export type InteractionsCreate = {
    "messageId": string;
    "userId": string;
    "emoji": string;
    "createdAt": string;
}

export type Interactions = Models.Row & {
    "messageId": string;
    "userId": string;
    "emoji": string;
    "createdAt": string;
}

export type CallLogsCreate = {
    "callerId": string;
    "receiverId"?: string | null;
    "conversationId"?: string | null;
    "type"?: CallLogsType;
    "status"?: CallLogsStatus;
    "duration"?: number;
    "startedAt": string;
}

export type CallLogs = Models.Row & {
    "callerId": string;
    "receiverId"?: string | null;
    "conversationId"?: string | null;
    "type"?: CallLogsType;
    "status"?: CallLogsStatus;
    "duration"?: number;
    "startedAt": string;
}

export type MomentsCreate = {
    "userId": string;
    "fileId": string;
    "type"?: MomentsType;
    "caption"?: string | null;
    "createdAt": string;
    "expiresAt": string;
}

export type Moments = Models.Row & {
    "userId": string;
    "fileId": string;
    "type"?: MomentsType;
    "caption"?: string | null;
    "createdAt": string;
    "expiresAt": string;
}

export type FocusSessionsCreate = {
    "userId": string;
    "taskId"?: string | null;
    "startTime": string;
    "endTime"?: string | null;
    "duration"?: number;
    "status"?: string;
}

export type FocusSessions = Models.Row & {
    "userId": string;
    "taskId"?: string | null;
    "startTime": string;
    "endTime"?: string | null;
    "duration"?: number;
    "status"?: string;
}

export type EventGuestsCreate = {
    "eventId": string;
    "userId"?: string | null;
    "email"?: string | null;
    "status"?: string;
    "role"?: string;
}

export type EventGuests = Models.Row & {
    "eventId": string;
    "userId"?: string | null;
    "email"?: string | null;
    "status"?: string;
    "role"?: string;
}

export type EventsCreate = {
    "title": string;
    "description"?: string | null;
    "startTime": string;
    "endTime": string;
    "location"?: string | null;
    "meetingUrl"?: string | null;
    "visibility"?: string;
    "status"?: string;
    "coverImageId"?: string | null;
    "maxAttendees"?: number;
    "recurrenceRule"?: string | null;
    "calendarId": string;
    "userId": string;
}

export type Events = Models.Row & {
    "title": string;
    "description"?: string | null;
    "startTime": string;
    "endTime": string;
    "location"?: string | null;
    "meetingUrl"?: string | null;
    "visibility"?: string;
    "status"?: string;
    "coverImageId"?: string | null;
    "maxAttendees"?: number;
    "recurrenceRule"?: string | null;
    "calendarId": string;
    "userId": string;
}

export type CalendarsCreate = {
    "name": string;
    "color"?: string;
    "isDefault"?: boolean;
    "userId": string;
}

export type Calendars = Models.Row & {
    "name": string;
    "color"?: string;
    "isDefault"?: boolean;
    "userId": string;
}

export type TasksCreate = {
    "title": string;
    "description"?: string | null;
    "status"?: string;
    "priority"?: string;
    "dueDate"?: string | null;
    "recurrenceRule"?: string | null;
    "tags"?: string[] | null;
    "assigneeIds"?: string[] | null;
    "attachmentIds"?: string[] | null;
    "eventId"?: string | null;
    "userId": string;
    "parentId"?: string | null;
}

export type Tasks = Models.Row & {
    "title": string;
    "description"?: string | null;
    "status"?: string;
    "priority"?: string;
    "dueDate"?: string | null;
    "recurrenceRule"?: string | null;
    "tags"?: string[] | null;
    "assigneeIds"?: string[] | null;
    "attachmentIds"?: string[] | null;
    "eventId"?: string | null;
    "userId": string;
    "parentId"?: string | null;
}

export type FormsCreate = {
    "userId": string;
    "title": string;
    "description"?: string | null;
    "schema": string;
    "settings"?: string | null;
    "status"?: FormsStatus;
    "visibility"?: FormsVisibility;
}

export type Forms = Models.Row & {
    "userId": string;
    "title": string;
    "description"?: string | null;
    "schema": string;
    "settings"?: string | null;
    "status"?: FormsStatus;
    "visibility"?: FormsVisibility;
}

export type FormSubmissionsCreate = {
    "formId": string;
    "submitterId"?: string | null;
    "payload": string;
    "status"?: FormSubmissionsStatus;
    "metadata"?: string | null;
}

export type FormSubmissions = Models.Row & {
    "formId": string;
    "submitterId"?: string | null;
    "payload": string;
    "status"?: FormSubmissionsStatus;
    "metadata"?: string | null;
}

declare const __roleStringBrand: unique symbol;
export type RoleString = string & { readonly [__roleStringBrand]: never };

export type RoleBuilder = {
  any: () => RoleString;
  user: (userId: string, status?: string) => RoleString;
  users: (status?: string) => RoleString;
  guests: () => RoleString;
  team: (teamId: string, role?: string) => RoleString;
  member: (memberId: string) => RoleString;
  label: (label: string) => RoleString;
}

export type PermissionBuilder = {
  read: (role: RoleString) => string;
  write: (role: RoleString) => string;
  create: (role: RoleString) => string;
  update: (role: RoleString) => string;
  delete: (role: RoleString) => string;
}

export type PermissionCallback = (permission: PermissionBuilder, role: RoleBuilder) => string[];

export type QueryValue = string | number | boolean;

export type ExtractQueryValue<T> = T extends (infer U)[]
  ? U extends QueryValue ? U : never
  : T extends QueryValue | null ? NonNullable<T> : never;

export type QueryableKeys<T> = {
  [K in keyof T]: ExtractQueryValue<T[K]> extends never ? never : K;
}[keyof T];

export type QueryBuilder<T> = {
  equal: <K extends QueryableKeys<T>>(field: K, value: ExtractQueryValue<T[K]>) => string;
  notEqual: <K extends QueryableKeys<T>>(field: K, value: ExtractQueryValue<T[K]>) => string;
  lessThan: <K extends QueryableKeys<T>>(field: K, value: ExtractQueryValue<T[K]>) => string;
  lessThanEqual: <K extends QueryableKeys<T>>(field: K, value: ExtractQueryValue<T[K]>) => string;
  greaterThan: <K extends QueryableKeys<T>>(field: K, value: ExtractQueryValue<T[K]>) => string;
  greaterThanEqual: <K extends QueryableKeys<T>>(field: K, value: ExtractQueryValue<T[K]>) => string;
  contains: <K extends QueryableKeys<T>>(field: K, value: ExtractQueryValue<T[K]>) => string;
  search: <K extends QueryableKeys<T>>(field: K, value: string) => string;
  isNull: <K extends QueryableKeys<T>>(field: K) => string;
  isNotNull: <K extends QueryableKeys<T>>(field: K) => string;
  startsWith: <K extends QueryableKeys<T>>(field: K, value: string) => string;
  endsWith: <K extends QueryableKeys<T>>(field: K, value: string) => string;
  between: <K extends QueryableKeys<T>>(field: K, start: ExtractQueryValue<T[K]>, end: ExtractQueryValue<T[K]>) => string;
  select: <K extends keyof T>(fields: K[]) => string;
  orderAsc: <K extends keyof T>(field: K) => string;
  orderDesc: <K extends keyof T>(field: K) => string;
  limit: (value: number) => string;
  offset: (value: number) => string;
  cursorAfter: (documentId: string) => string;
  cursorBefore: (documentId: string) => string;
  or: (...queries: string[]) => string;
  and: (...queries: string[]) => string;
}

export type DatabaseId = "67ff05a9000296822396" | "passwordManagerDb" | "chat" | "whisperrflow";

export type DatabaseTableMap = {
  "67ff05a9000296822396": {
    "users": {
      create: (data: {
        "id"?: string | null;
        "email"?: string | null;
        "name"?: string | null;
        "walletAddress"?: string | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<WhisperNoteUsers>;
      get: (id: string) => Promise<WhisperNoteUsers>;
      update: (id: string, data: Partial<{
        "id"?: string | null;
        "email"?: string | null;
        "name"?: string | null;
        "walletAddress"?: string | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<WhisperNoteUsers>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: WhisperNoteUsers[] }>;
    };
    "notes": {
      create: (data: {
        "id"?: string | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
        "userId"?: string | null;
        "isPublic"?: boolean | null;
        "status"?: NotesStatus | null;
        "parentNoteId"?: string | null;
        "title"?: string | null;
        "content"?: string | null;
        "tags"?: string[] | null;
        "comments"?: string[] | null;
        "extensions"?: string[] | null;
        "collaborators"?: string[] | null;
        "metadata"?: string | null;
        "attachments"?: string | null;
        "format"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Notes>;
      get: (id: string) => Promise<Notes>;
      update: (id: string, data: Partial<{
        "id"?: string | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
        "userId"?: string | null;
        "isPublic"?: boolean | null;
        "status"?: NotesStatus | null;
        "parentNoteId"?: string | null;
        "title"?: string | null;
        "content"?: string | null;
        "tags"?: string[] | null;
        "comments"?: string[] | null;
        "extensions"?: string[] | null;
        "collaborators"?: string[] | null;
        "metadata"?: string | null;
        "attachments"?: string | null;
        "format"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Notes>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: Notes[] }>;
    };
    "tags": {
      create: (data: {
        "id"?: string | null;
        "name"?: string | null;
        "notes"?: string[] | null;
        "createdAt"?: string | null;
        "color"?: string | null;
        "description"?: string | null;
        "usageCount"?: number | null;
        "userId"?: string | null;
        "nameLower"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Tags>;
      get: (id: string) => Promise<Tags>;
      update: (id: string, data: Partial<{
        "id"?: string | null;
        "name"?: string | null;
        "notes"?: string[] | null;
        "createdAt"?: string | null;
        "color"?: string | null;
        "description"?: string | null;
        "usageCount"?: number | null;
        "userId"?: string | null;
        "nameLower"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Tags>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: Tags[] }>;
    };
    "apiKeys": {
      create: (data: {
        "id"?: string | null;
        "key"?: string | null;
        "name"?: string | null;
        "userId"?: string | null;
        "createdAt"?: string | null;
        "lastUsed"?: string | null;
        "expiresAt"?: string | null;
        "scopes"?: string[] | null;
        "lastUsedIp"?: string | null;
        "keyHash"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<ApiKeys>;
      get: (id: string) => Promise<ApiKeys>;
      update: (id: string, data: Partial<{
        "id"?: string | null;
        "key"?: string | null;
        "name"?: string | null;
        "userId"?: string | null;
        "createdAt"?: string | null;
        "lastUsed"?: string | null;
        "expiresAt"?: string | null;
        "scopes"?: string[] | null;
        "lastUsedIp"?: string | null;
        "keyHash"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<ApiKeys>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: ApiKeys[] }>;
    };
    "Comments": {
      create: (data: {
        "noteId": string;
        "userId": string;
        "content": string;
        "createdAt": string;
        "parentCommentId"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Comments>;
      get: (id: string) => Promise<Comments>;
      update: (id: string, data: Partial<{
        "noteId": string;
        "userId": string;
        "content": string;
        "createdAt": string;
        "parentCommentId"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Comments>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: Comments[] }>;
    };
    "Extensions": {
      create: (data: {
        "name": string;
        "description"?: string | null;
        "version"?: string | null;
        "authorId"?: string | null;
        "enabled"?: boolean | null;
        "settings"?: string | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
        "isPublic"?: boolean | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Extensions>;
      get: (id: string) => Promise<Extensions>;
      update: (id: string, data: Partial<{
        "name": string;
        "description"?: string | null;
        "version"?: string | null;
        "authorId"?: string | null;
        "enabled"?: boolean | null;
        "settings"?: string | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
        "isPublic"?: boolean | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Extensions>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: Extensions[] }>;
    };
    "Reactions": {
      create: (data: {
        "targetType": ReactionsTargetType;
        "emoji": string;
        "createdAt": string;
        "targetId": string;
        "userId": string;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Reactions>;
      get: (id: string) => Promise<Reactions>;
      update: (id: string, data: Partial<{
        "targetType": ReactionsTargetType;
        "emoji": string;
        "createdAt": string;
        "targetId": string;
        "userId": string;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Reactions>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: Reactions[] }>;
    };
    "Collaborators": {
      create: (data: {
        "noteId": string;
        "userId": string;
        "permission": CollaboratorsPermission;
        "invitedAt"?: string | null;
        "accepted"?: boolean | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Collaborators>;
      get: (id: string) => Promise<Collaborators>;
      update: (id: string, data: Partial<{
        "noteId": string;
        "userId": string;
        "permission": CollaboratorsPermission;
        "invitedAt"?: string | null;
        "accepted"?: boolean | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Collaborators>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: Collaborators[] }>;
    };
    "ActivityLog": {
      create: (data: {
        "userId": string;
        "action": string;
        "targetType": string;
        "targetId": string;
        "timestamp": string;
        "details"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<ActivityLog>;
      get: (id: string) => Promise<ActivityLog>;
      update: (id: string, data: Partial<{
        "userId": string;
        "action": string;
        "targetType": string;
        "targetId": string;
        "timestamp": string;
        "details"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<ActivityLog>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: ActivityLog[] }>;
    };
    "Settings": {
      create: (data: {
        "userId": string;
        "settings": string;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
        "mode"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Settings>;
      get: (id: string) => Promise<Settings>;
      update: (id: string, data: Partial<{
        "userId": string;
        "settings": string;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
        "mode"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Settings>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: Settings[] }>;
    };
    "walletMap": {
      create: (data: {
        "walletAddressLower": string;
        "userId": string;
        "updatedAt"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<WalletMap>;
      get: (id: string) => Promise<WalletMap>;
      update: (id: string, data: Partial<{
        "walletAddressLower": string;
        "userId": string;
        "updatedAt"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<WalletMap>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: WalletMap[] }>;
    };
    "note_tags": {
      create: (data: {
        "noteId": string;
        "tagId": string;
        "userId": string;
        "createdAt"?: string | null;
        "tag"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<NoteTags>;
      get: (id: string) => Promise<NoteTags>;
      update: (id: string, data: Partial<{
        "noteId": string;
        "tagId": string;
        "userId": string;
        "createdAt"?: string | null;
        "tag"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<NoteTags>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: NoteTags[] }>;
    };
    "note_revisions": {
      create: (data: {
        "noteId": string;
        "revision": number;
        "userId"?: string | null;
        "title"?: string | null;
        "content"?: string | null;
        "createdAt"?: string | null;
        "diff"?: string | null;
        "diffFormat"?: string | null;
        "fullSnapshot"?: boolean | null;
        "cause"?: NoteRevisionsCause | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<NoteRevisions>;
      get: (id: string) => Promise<NoteRevisions>;
      update: (id: string, data: Partial<{
        "noteId": string;
        "revision": number;
        "userId"?: string | null;
        "title"?: string | null;
        "content"?: string | null;
        "createdAt"?: string | null;
        "diff"?: string | null;
        "diffFormat"?: string | null;
        "fullSnapshot"?: boolean | null;
        "cause"?: NoteRevisionsCause | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<NoteRevisions>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: NoteRevisions[] }>;
    };
    "ai_generations": {
      create: (data: {
        "userId": string;
        "promptHash"?: string | null;
        "prompt"?: string | null;
        "mode"?: string | null;
        "providerId"?: string | null;
        "model"?: string | null;
        "durationMs"?: number | null;
        "tokensUsed"?: number | null;
        "success"?: boolean | null;
        "error"?: string | null;
        "createdAt"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<AiGenerations>;
      get: (id: string) => Promise<AiGenerations>;
      update: (id: string, data: Partial<{
        "userId": string;
        "promptHash"?: string | null;
        "prompt"?: string | null;
        "mode"?: string | null;
        "providerId"?: string | null;
        "model"?: string | null;
        "durationMs"?: number | null;
        "tokensUsed"?: number | null;
        "success"?: boolean | null;
        "error"?: string | null;
        "createdAt"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<AiGenerations>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: AiGenerations[] }>;
    };
    "subscriptions": {
      create: (data: {
        "userId": string;
        "plan": SubscriptionsPlan;
        "status"?: SubscriptionsStatus | null;
        "currentPeriodStart"?: string | null;
        "currentPeriodEnd"?: string | null;
        "seats"?: number | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Subscriptions>;
      get: (id: string) => Promise<Subscriptions>;
      update: (id: string, data: Partial<{
        "userId": string;
        "plan": SubscriptionsPlan;
        "status"?: SubscriptionsStatus | null;
        "currentPeriodStart"?: string | null;
        "currentPeriodEnd"?: string | null;
        "seats"?: number | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Subscriptions>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: Subscriptions[] }>;
    }
  };
  "passwordManagerDb": {
    "Security Logs": {
      create: (data: {
        "userId": string;
        "eventType": string;
        "ipAddress"?: string | null;
        "userAgent"?: string | null;
        "deviceFingerprint"?: string | null;
        "details"?: string | null;
        "success": boolean;
        "severity"?: string;
        "timestamp": string;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<SecurityLogs>;
      get: (id: string) => Promise<SecurityLogs>;
      update: (id: string, data: Partial<{
        "userId": string;
        "eventType": string;
        "ipAddress"?: string | null;
        "userAgent"?: string | null;
        "deviceFingerprint"?: string | null;
        "details"?: string | null;
        "success": boolean;
        "severity"?: string;
        "timestamp": string;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<SecurityLogs>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: SecurityLogs[] }>;
    };
    "Credentials": {
      create: (data: {
        "userId": string;
        "itemType": string;
        "name": string;
        "url"?: string | null;
        "notes"?: string | null;
        "totpId"?: string | null;
        "password"?: string | null;
        "cardNumber"?: string | null;
        "cardholderName"?: string | null;
        "cardExpiry"?: string | null;
        "cardCVV"?: string | null;
        "cardPIN"?: string | null;
        "cardType"?: string | null;
        "folderId"?: string | null;
        "tags"?: string[] | null;
        "customFields"?: string | null;
        "faviconUrl"?: string | null;
        "isFavorite"?: boolean;
        "isDeleted"?: boolean;
        "deletedAt"?: string | null;
        "lastAccessedAt"?: string | null;
        "passwordChangedAt"?: string | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
        "username"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Credentials>;
      get: (id: string) => Promise<Credentials>;
      update: (id: string, data: Partial<{
        "userId": string;
        "itemType": string;
        "name": string;
        "url"?: string | null;
        "notes"?: string | null;
        "totpId"?: string | null;
        "password"?: string | null;
        "cardNumber"?: string | null;
        "cardholderName"?: string | null;
        "cardExpiry"?: string | null;
        "cardCVV"?: string | null;
        "cardPIN"?: string | null;
        "cardType"?: string | null;
        "folderId"?: string | null;
        "tags"?: string[] | null;
        "customFields"?: string | null;
        "faviconUrl"?: string | null;
        "isFavorite"?: boolean;
        "isDeleted"?: boolean;
        "deletedAt"?: string | null;
        "lastAccessedAt"?: string | null;
        "passwordChangedAt"?: string | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
        "username"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Credentials>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: Credentials[] }>;
    };
    "Identities": {
      create: (data: {
        "userId": string;
        "identityType": string;
        "label": string;
        "credentialId"?: string | null;
        "publicKey"?: string | null;
        "counter"?: number;
        "passkeyBlob"?: string | null;
        "transports"?: string[] | null;
        "aaguid"?: string | null;
        "deviceInfo"?: string | null;
        "isPrimary"?: boolean;
        "isBackup"?: boolean;
        "lastUsedAt"?: string | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Identities>;
      get: (id: string) => Promise<Identities>;
      update: (id: string, data: Partial<{
        "userId": string;
        "identityType": string;
        "label": string;
        "credentialId"?: string | null;
        "publicKey"?: string | null;
        "counter"?: number;
        "passkeyBlob"?: string | null;
        "transports"?: string[] | null;
        "aaguid"?: string | null;
        "deviceInfo"?: string | null;
        "isPrimary"?: boolean;
        "isBackup"?: boolean;
        "lastUsedAt"?: string | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Identities>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: Identities[] }>;
    };
    "user": {
      create: (data: {
        "userId": string;
        "email"?: string | null;
        "masterpass"?: boolean | null;
        "twofa"?: boolean | null;
        "twofaSecret"?: string | null;
        "backupCodes"?: string | null;
        "isPasskey"?: boolean | null;
        "sessionFingerprint"?: string | null;
        "lastLoginAt"?: string | null;
        "lastPasswordChangeAt"?: string | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<User>;
      get: (id: string) => Promise<User>;
      update: (id: string, data: Partial<{
        "userId": string;
        "email"?: string | null;
        "masterpass"?: boolean | null;
        "twofa"?: boolean | null;
        "twofaSecret"?: string | null;
        "backupCodes"?: string | null;
        "isPasskey"?: boolean | null;
        "sessionFingerprint"?: string | null;
        "lastLoginAt"?: string | null;
        "lastPasswordChangeAt"?: string | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<User>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: User[] }>;
    };
    "Folders": {
      create: (data: {
        "userId": string;
        "name": string;
        "parentFolderId"?: string | null;
        "icon"?: string | null;
        "color"?: string | null;
        "sortOrder"?: number;
        "isDeleted"?: boolean;
        "deletedAt"?: string | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Folders>;
      get: (id: string) => Promise<Folders>;
      update: (id: string, data: Partial<{
        "userId": string;
        "name": string;
        "parentFolderId"?: string | null;
        "icon"?: string | null;
        "color"?: string | null;
        "sortOrder"?: number;
        "isDeleted"?: boolean;
        "deletedAt"?: string | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Folders>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: Folders[] }>;
    };
    "TOTP Secrets": {
      create: (data: {
        "userId": string;
        "issuer": string;
        "accountName": string;
        "secretKey": string;
        "algorithm": string;
        "digits": number;
        "period": number;
        "url"?: string | null;
        "folderId"?: string | null;
        "tags"?: string[] | null;
        "isFavorite"?: boolean;
        "isDeleted"?: boolean;
        "deletedAt"?: string | null;
        "lastUsedAt"?: string | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<TotpSecrets>;
      get: (id: string) => Promise<TotpSecrets>;
      update: (id: string, data: Partial<{
        "userId": string;
        "issuer": string;
        "accountName": string;
        "secretKey": string;
        "algorithm": string;
        "digits": number;
        "period": number;
        "url"?: string | null;
        "folderId"?: string | null;
        "tags"?: string[] | null;
        "isFavorite"?: boolean;
        "isDeleted"?: boolean;
        "deletedAt"?: string | null;
        "lastUsedAt"?: string | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<TotpSecrets>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: TotpSecrets[] }>;
    };
    "Keychain": {
      create: (data: {
        "userId": string;
        "type": string;
        "credentialId"?: string | null;
        "wrappedKey": string;
        "salt": string;
        "params"?: string | null;
        "isBackup"?: boolean;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Keychain>;
      get: (id: string) => Promise<Keychain>;
      update: (id: string, data: Partial<{
        "userId": string;
        "type": string;
        "credentialId"?: string | null;
        "wrappedKey": string;
        "salt": string;
        "params"?: string | null;
        "isBackup"?: boolean;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Keychain>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: Keychain[] }>;
    }
  };
  "chat": {
    "Messages": {
      create: (data: {
        "conversationId": string;
        "senderId": string;
        "createdAt": string;
        "updatedAt": string;
        "type": MessagesType;
        "content"?: string | null;
        "attachments"?: string[] | null;
        "replyTo"?: string | null;
        "readBy"?: string[] | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Messages>;
      get: (id: string) => Promise<Messages>;
      update: (id: string, data: Partial<{
        "conversationId": string;
        "senderId": string;
        "createdAt": string;
        "updatedAt": string;
        "type": MessagesType;
        "content"?: string | null;
        "attachments"?: string[] | null;
        "replyTo"?: string | null;
        "readBy"?: string[] | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Messages>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: Messages[] }>;
    };
    "Conversations": {
      create: (data: {
        "type": ConversationsType;
        "name"?: string | null;
        "lastMessageId"?: string | null;
        "lastMessageAt"?: string | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
        "creatorId": string;
        "participants"?: string[] | null;
        "admins"?: string[] | null;
        "description"?: string | null;
        "avatarUrl"?: string | null;
        "avatarFileId"?: string | null;
        "avatar"?: string | null;
        "participantCount"?: number;
        "maxParticipants"?: number;
        "isEncrypted"?: boolean;
        "encryptionVersion"?: string | null;
        "encryptionKey"?: string | null;
        "isPinned": string[];
        "isMuted": string[];
        "isArchived": string[];
        "lastMessageText"?: string | null;
        "lastMessageSenderId"?: string | null;
        "unreadCount"?: string | null;
        "settings"?: string | null;
        "isPublic"?: boolean;
        "inviteLink"?: string | null;
        "inviteLinkExpiry"?: string | null;
        "category"?: string | null;
        "tags": string[];
        "contextType"?: string | null;
        "contextId"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Conversations>;
      get: (id: string) => Promise<Conversations>;
      update: (id: string, data: Partial<{
        "type": ConversationsType;
        "name"?: string | null;
        "lastMessageId"?: string | null;
        "lastMessageAt"?: string | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
        "creatorId": string;
        "participants"?: string[] | null;
        "admins"?: string[] | null;
        "description"?: string | null;
        "avatarUrl"?: string | null;
        "avatarFileId"?: string | null;
        "avatar"?: string | null;
        "participantCount"?: number;
        "maxParticipants"?: number;
        "isEncrypted"?: boolean;
        "encryptionVersion"?: string | null;
        "encryptionKey"?: string | null;
        "isPinned": string[];
        "isMuted": string[];
        "isArchived": string[];
        "lastMessageText"?: string | null;
        "lastMessageSenderId"?: string | null;
        "unreadCount"?: string | null;
        "settings"?: string | null;
        "isPublic"?: boolean;
        "inviteLink"?: string | null;
        "inviteLinkExpiry"?: string | null;
        "category"?: string | null;
        "tags": string[];
        "contextType"?: string | null;
        "contextId"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Conversations>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: Conversations[] }>;
    };
    "Contacts": {
      create: (data: {
        "userId": string;
        "contactUserId": string;
        "nickname"?: string | null;
        "relationship"?: ContactsRelationship;
        "isBlocked"?: boolean;
        "isFavorite"?: boolean;
        "notes"?: string | null;
        "tags": string[];
        "lastInteraction"?: string | null;
        "addedAt"?: string | null;
        "updatedAt"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Contacts>;
      get: (id: string) => Promise<Contacts>;
      update: (id: string, data: Partial<{
        "userId": string;
        "contactUserId": string;
        "nickname"?: string | null;
        "relationship"?: ContactsRelationship;
        "isBlocked"?: boolean;
        "isFavorite"?: boolean;
        "notes"?: string | null;
        "tags": string[];
        "lastInteraction"?: string | null;
        "addedAt"?: string | null;
        "updatedAt"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Contacts>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: Contacts[] }>;
    };
    "users": {
      create: (data: {
        "username": string;
        "displayName"?: string | null;
        "bio"?: string | null;
        "walletAddress"?: string | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
        "publicKey"?: string | null;
        "avatar"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<ChatUsers>;
      get: (id: string) => Promise<ChatUsers>;
      update: (id: string, data: Partial<{
        "username": string;
        "displayName"?: string | null;
        "bio"?: string | null;
        "walletAddress"?: string | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
        "publicKey"?: string | null;
        "avatar"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<ChatUsers>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: ChatUsers[] }>;
    };
    "Follows": {
      create: (data: {
        "followerId": string;
        "followingId": string;
        "status"?: FollowsStatus;
        "isCloseFriend"?: boolean;
        "notificationsEnabled"?: boolean;
        "createdAt"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Follows>;
      get: (id: string) => Promise<Follows>;
      update: (id: string, data: Partial<{
        "followerId": string;
        "followingId": string;
        "status"?: FollowsStatus;
        "isCloseFriend"?: boolean;
        "notificationsEnabled"?: boolean;
        "createdAt"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Follows>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: Follows[] }>;
    };
    "AppActivity": {
      create: (data: {
        "userId": string;
        "status"?: AppActivityStatus;
        "lastSeen"?: string | null;
        "customStatus"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<AppActivity>;
      get: (id: string) => Promise<AppActivity>;
      update: (id: string, data: Partial<{
        "userId": string;
        "status"?: AppActivityStatus;
        "lastSeen"?: string | null;
        "customStatus"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<AppActivity>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: AppActivity[] }>;
    };
    "CallLinks": {
      create: (data: {
        "userId": string;
        "conversationId"?: string | null;
        "code": string;
        "type"?: CallLinksType;
        "url"?: string | null;
        "expiresAt"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<CallLinks>;
      get: (id: string) => Promise<CallLinks>;
      update: (id: string, data: Partial<{
        "userId": string;
        "conversationId"?: string | null;
        "code": string;
        "type"?: CallLinksType;
        "url"?: string | null;
        "expiresAt"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<CallLinks>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: CallLinks[] }>;
    };
    "Interactions": {
      create: (data: {
        "messageId": string;
        "userId": string;
        "emoji": string;
        "createdAt": string;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Interactions>;
      get: (id: string) => Promise<Interactions>;
      update: (id: string, data: Partial<{
        "messageId": string;
        "userId": string;
        "emoji": string;
        "createdAt": string;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Interactions>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: Interactions[] }>;
    };
    "CallLogs": {
      create: (data: {
        "callerId": string;
        "receiverId"?: string | null;
        "conversationId"?: string | null;
        "type"?: CallLogsType;
        "status"?: CallLogsStatus;
        "duration"?: number;
        "startedAt": string;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<CallLogs>;
      get: (id: string) => Promise<CallLogs>;
      update: (id: string, data: Partial<{
        "callerId": string;
        "receiverId"?: string | null;
        "conversationId"?: string | null;
        "type"?: CallLogsType;
        "status"?: CallLogsStatus;
        "duration"?: number;
        "startedAt": string;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<CallLogs>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: CallLogs[] }>;
    };
    "Moments": {
      create: (data: {
        "userId": string;
        "fileId": string;
        "type"?: MomentsType;
        "caption"?: string | null;
        "createdAt": string;
        "expiresAt": string;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Moments>;
      get: (id: string) => Promise<Moments>;
      update: (id: string, data: Partial<{
        "userId": string;
        "fileId": string;
        "type"?: MomentsType;
        "caption"?: string | null;
        "createdAt": string;
        "expiresAt": string;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Moments>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: Moments[] }>;
    }
  };
  "whisperrflow": {
    "focusSessions": {
      create: (data: {
        "userId": string;
        "taskId"?: string | null;
        "startTime": string;
        "endTime"?: string | null;
        "duration"?: number;
        "status"?: string;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<FocusSessions>;
      get: (id: string) => Promise<FocusSessions>;
      update: (id: string, data: Partial<{
        "userId": string;
        "taskId"?: string | null;
        "startTime": string;
        "endTime"?: string | null;
        "duration"?: number;
        "status"?: string;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<FocusSessions>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: FocusSessions[] }>;
    };
    "eventGuests": {
      create: (data: {
        "eventId": string;
        "userId"?: string | null;
        "email"?: string | null;
        "status"?: string;
        "role"?: string;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<EventGuests>;
      get: (id: string) => Promise<EventGuests>;
      update: (id: string, data: Partial<{
        "eventId": string;
        "userId"?: string | null;
        "email"?: string | null;
        "status"?: string;
        "role"?: string;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<EventGuests>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: EventGuests[] }>;
    };
    "events": {
      create: (data: {
        "title": string;
        "description"?: string | null;
        "startTime": string;
        "endTime": string;
        "location"?: string | null;
        "meetingUrl"?: string | null;
        "visibility"?: string;
        "status"?: string;
        "coverImageId"?: string | null;
        "maxAttendees"?: number;
        "recurrenceRule"?: string | null;
        "calendarId": string;
        "userId": string;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Events>;
      get: (id: string) => Promise<Events>;
      update: (id: string, data: Partial<{
        "title": string;
        "description"?: string | null;
        "startTime": string;
        "endTime": string;
        "location"?: string | null;
        "meetingUrl"?: string | null;
        "visibility"?: string;
        "status"?: string;
        "coverImageId"?: string | null;
        "maxAttendees"?: number;
        "recurrenceRule"?: string | null;
        "calendarId": string;
        "userId": string;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Events>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: Events[] }>;
    };
    "calendars": {
      create: (data: {
        "name": string;
        "color"?: string;
        "isDefault"?: boolean;
        "userId": string;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Calendars>;
      get: (id: string) => Promise<Calendars>;
      update: (id: string, data: Partial<{
        "name": string;
        "color"?: string;
        "isDefault"?: boolean;
        "userId": string;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Calendars>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: Calendars[] }>;
    };
    "tasks": {
      create: (data: {
        "title": string;
        "description"?: string | null;
        "status"?: string;
        "priority"?: string;
        "dueDate"?: string | null;
        "recurrenceRule"?: string | null;
        "tags"?: string[] | null;
        "assigneeIds"?: string[] | null;
        "attachmentIds"?: string[] | null;
        "eventId"?: string | null;
        "userId": string;
        "parentId"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Tasks>;
      get: (id: string) => Promise<Tasks>;
      update: (id: string, data: Partial<{
        "title": string;
        "description"?: string | null;
        "status"?: string;
        "priority"?: string;
        "dueDate"?: string | null;
        "recurrenceRule"?: string | null;
        "tags"?: string[] | null;
        "assigneeIds"?: string[] | null;
        "attachmentIds"?: string[] | null;
        "eventId"?: string | null;
        "userId": string;
        "parentId"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Tasks>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: Tasks[] }>;
    };
    "forms": {
      create: (data: {
        "userId": string;
        "title": string;
        "description"?: string | null;
        "schema": string;
        "settings"?: string | null;
        "status"?: FormsStatus;
        "visibility"?: FormsVisibility;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Forms>;
      get: (id: string) => Promise<Forms>;
      update: (id: string, data: Partial<{
        "userId": string;
        "title": string;
        "description"?: string | null;
        "schema": string;
        "settings"?: string | null;
        "status"?: FormsStatus;
        "visibility"?: FormsVisibility;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Forms>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: Forms[] }>;
    };
    "formSubmissions": {
      create: (data: {
        "formId": string;
        "submitterId"?: string | null;
        "payload": string;
        "status"?: FormSubmissionsStatus;
        "metadata"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<FormSubmissions>;
      get: (id: string) => Promise<FormSubmissions>;
      update: (id: string, data: Partial<{
        "formId": string;
        "submitterId"?: string | null;
        "payload": string;
        "status"?: FormSubmissionsStatus;
        "metadata"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<FormSubmissions>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: string[] }) => Promise<{ total: number; rows: FormSubmissions[] }>;
    }
  }
};

export type DatabaseHandle<D extends DatabaseId> = {
  use: <T extends keyof DatabaseTableMap[D] & string>(tableId: T) => DatabaseTableMap[D][T];

};

export type DatabaseTables = {
  use: <D extends DatabaseId>(databaseId: D) => DatabaseHandle<D>;

};
