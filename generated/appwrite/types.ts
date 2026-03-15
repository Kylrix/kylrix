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
export type UsersCreate = {
    "id"?: string | null;
    "email"?: string | null;
    "name"?: string | null;
    "walletAddress"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
}

export type Users = Models.Row & {
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

export type UsersCreate = {
    "username": string;
    "displayName"?: string | null;
    "bio"?: string | null;
    "walletAddress"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
    "publicKey"?: string | null;
    "avatar"?: string | null;
}

export type Users = Models.Row & {
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
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Users>;
      get: (id: string) => Promise<Users>;
      update: (id: string, data: Partial<{
        "id"?: string | null;
        "email"?: string | null;
        "name"?: string | null;
        "walletAddress"?: string | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Users>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Users>>(field: K, value: ExtractQueryValue<Users[K]>) => string; notEqual: <K extends QueryableKeys<Users>>(field: K, value: ExtractQueryValue<Users[K]>) => string; lessThan: <K extends QueryableKeys<Users>>(field: K, value: ExtractQueryValue<Users[K]>) => string; lessThanEqual: <K extends QueryableKeys<Users>>(field: K, value: ExtractQueryValue<Users[K]>) => string; greaterThan: <K extends QueryableKeys<Users>>(field: K, value: ExtractQueryValue<Users[K]>) => string; greaterThanEqual: <K extends QueryableKeys<Users>>(field: K, value: ExtractQueryValue<Users[K]>) => string; contains: <K extends QueryableKeys<Users>>(field: K, value: ExtractQueryValue<Users[K]>) => string; search: <K extends QueryableKeys<Users>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Users>>(field: K) => string; isNotNull: <K extends QueryableKeys<Users>>(field: K) => string; startsWith: <K extends QueryableKeys<Users>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Users>>(field: K, value: string) => string; between: <K extends QueryableKeys<Users>>(field: K, start: ExtractQueryValue<Users[K]>, end: ExtractQueryValue<Users[K]>) => string; select: <K extends keyof Users>(fields: K[]) => string; orderAsc: <K extends keyof Users>(field: K) => string; orderDesc: <K extends keyof Users>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Users[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Notes>>(field: K, value: ExtractQueryValue<Notes[K]>) => string; notEqual: <K extends QueryableKeys<Notes>>(field: K, value: ExtractQueryValue<Notes[K]>) => string; lessThan: <K extends QueryableKeys<Notes>>(field: K, value: ExtractQueryValue<Notes[K]>) => string; lessThanEqual: <K extends QueryableKeys<Notes>>(field: K, value: ExtractQueryValue<Notes[K]>) => string; greaterThan: <K extends QueryableKeys<Notes>>(field: K, value: ExtractQueryValue<Notes[K]>) => string; greaterThanEqual: <K extends QueryableKeys<Notes>>(field: K, value: ExtractQueryValue<Notes[K]>) => string; contains: <K extends QueryableKeys<Notes>>(field: K, value: ExtractQueryValue<Notes[K]>) => string; search: <K extends QueryableKeys<Notes>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Notes>>(field: K) => string; isNotNull: <K extends QueryableKeys<Notes>>(field: K) => string; startsWith: <K extends QueryableKeys<Notes>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Notes>>(field: K, value: string) => string; between: <K extends QueryableKeys<Notes>>(field: K, start: ExtractQueryValue<Notes[K]>, end: ExtractQueryValue<Notes[K]>) => string; select: <K extends keyof Notes>(fields: K[]) => string; orderAsc: <K extends keyof Notes>(field: K) => string; orderDesc: <K extends keyof Notes>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Notes[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Tags>>(field: K, value: ExtractQueryValue<Tags[K]>) => string; notEqual: <K extends QueryableKeys<Tags>>(field: K, value: ExtractQueryValue<Tags[K]>) => string; lessThan: <K extends QueryableKeys<Tags>>(field: K, value: ExtractQueryValue<Tags[K]>) => string; lessThanEqual: <K extends QueryableKeys<Tags>>(field: K, value: ExtractQueryValue<Tags[K]>) => string; greaterThan: <K extends QueryableKeys<Tags>>(field: K, value: ExtractQueryValue<Tags[K]>) => string; greaterThanEqual: <K extends QueryableKeys<Tags>>(field: K, value: ExtractQueryValue<Tags[K]>) => string; contains: <K extends QueryableKeys<Tags>>(field: K, value: ExtractQueryValue<Tags[K]>) => string; search: <K extends QueryableKeys<Tags>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Tags>>(field: K) => string; isNotNull: <K extends QueryableKeys<Tags>>(field: K) => string; startsWith: <K extends QueryableKeys<Tags>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Tags>>(field: K, value: string) => string; between: <K extends QueryableKeys<Tags>>(field: K, start: ExtractQueryValue<Tags[K]>, end: ExtractQueryValue<Tags[K]>) => string; select: <K extends keyof Tags>(fields: K[]) => string; orderAsc: <K extends keyof Tags>(field: K) => string; orderDesc: <K extends keyof Tags>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Tags[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<ApiKeys>>(field: K, value: ExtractQueryValue<ApiKeys[K]>) => string; notEqual: <K extends QueryableKeys<ApiKeys>>(field: K, value: ExtractQueryValue<ApiKeys[K]>) => string; lessThan: <K extends QueryableKeys<ApiKeys>>(field: K, value: ExtractQueryValue<ApiKeys[K]>) => string; lessThanEqual: <K extends QueryableKeys<ApiKeys>>(field: K, value: ExtractQueryValue<ApiKeys[K]>) => string; greaterThan: <K extends QueryableKeys<ApiKeys>>(field: K, value: ExtractQueryValue<ApiKeys[K]>) => string; greaterThanEqual: <K extends QueryableKeys<ApiKeys>>(field: K, value: ExtractQueryValue<ApiKeys[K]>) => string; contains: <K extends QueryableKeys<ApiKeys>>(field: K, value: ExtractQueryValue<ApiKeys[K]>) => string; search: <K extends QueryableKeys<ApiKeys>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<ApiKeys>>(field: K) => string; isNotNull: <K extends QueryableKeys<ApiKeys>>(field: K) => string; startsWith: <K extends QueryableKeys<ApiKeys>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<ApiKeys>>(field: K, value: string) => string; between: <K extends QueryableKeys<ApiKeys>>(field: K, start: ExtractQueryValue<ApiKeys[K]>, end: ExtractQueryValue<ApiKeys[K]>) => string; select: <K extends keyof ApiKeys>(fields: K[]) => string; orderAsc: <K extends keyof ApiKeys>(field: K) => string; orderDesc: <K extends keyof ApiKeys>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: ApiKeys[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Comments>>(field: K, value: ExtractQueryValue<Comments[K]>) => string; notEqual: <K extends QueryableKeys<Comments>>(field: K, value: ExtractQueryValue<Comments[K]>) => string; lessThan: <K extends QueryableKeys<Comments>>(field: K, value: ExtractQueryValue<Comments[K]>) => string; lessThanEqual: <K extends QueryableKeys<Comments>>(field: K, value: ExtractQueryValue<Comments[K]>) => string; greaterThan: <K extends QueryableKeys<Comments>>(field: K, value: ExtractQueryValue<Comments[K]>) => string; greaterThanEqual: <K extends QueryableKeys<Comments>>(field: K, value: ExtractQueryValue<Comments[K]>) => string; contains: <K extends QueryableKeys<Comments>>(field: K, value: ExtractQueryValue<Comments[K]>) => string; search: <K extends QueryableKeys<Comments>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Comments>>(field: K) => string; isNotNull: <K extends QueryableKeys<Comments>>(field: K) => string; startsWith: <K extends QueryableKeys<Comments>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Comments>>(field: K, value: string) => string; between: <K extends QueryableKeys<Comments>>(field: K, start: ExtractQueryValue<Comments[K]>, end: ExtractQueryValue<Comments[K]>) => string; select: <K extends keyof Comments>(fields: K[]) => string; orderAsc: <K extends keyof Comments>(field: K) => string; orderDesc: <K extends keyof Comments>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Comments[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Extensions>>(field: K, value: ExtractQueryValue<Extensions[K]>) => string; notEqual: <K extends QueryableKeys<Extensions>>(field: K, value: ExtractQueryValue<Extensions[K]>) => string; lessThan: <K extends QueryableKeys<Extensions>>(field: K, value: ExtractQueryValue<Extensions[K]>) => string; lessThanEqual: <K extends QueryableKeys<Extensions>>(field: K, value: ExtractQueryValue<Extensions[K]>) => string; greaterThan: <K extends QueryableKeys<Extensions>>(field: K, value: ExtractQueryValue<Extensions[K]>) => string; greaterThanEqual: <K extends QueryableKeys<Extensions>>(field: K, value: ExtractQueryValue<Extensions[K]>) => string; contains: <K extends QueryableKeys<Extensions>>(field: K, value: ExtractQueryValue<Extensions[K]>) => string; search: <K extends QueryableKeys<Extensions>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Extensions>>(field: K) => string; isNotNull: <K extends QueryableKeys<Extensions>>(field: K) => string; startsWith: <K extends QueryableKeys<Extensions>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Extensions>>(field: K, value: string) => string; between: <K extends QueryableKeys<Extensions>>(field: K, start: ExtractQueryValue<Extensions[K]>, end: ExtractQueryValue<Extensions[K]>) => string; select: <K extends keyof Extensions>(fields: K[]) => string; orderAsc: <K extends keyof Extensions>(field: K) => string; orderDesc: <K extends keyof Extensions>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Extensions[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Reactions>>(field: K, value: ExtractQueryValue<Reactions[K]>) => string; notEqual: <K extends QueryableKeys<Reactions>>(field: K, value: ExtractQueryValue<Reactions[K]>) => string; lessThan: <K extends QueryableKeys<Reactions>>(field: K, value: ExtractQueryValue<Reactions[K]>) => string; lessThanEqual: <K extends QueryableKeys<Reactions>>(field: K, value: ExtractQueryValue<Reactions[K]>) => string; greaterThan: <K extends QueryableKeys<Reactions>>(field: K, value: ExtractQueryValue<Reactions[K]>) => string; greaterThanEqual: <K extends QueryableKeys<Reactions>>(field: K, value: ExtractQueryValue<Reactions[K]>) => string; contains: <K extends QueryableKeys<Reactions>>(field: K, value: ExtractQueryValue<Reactions[K]>) => string; search: <K extends QueryableKeys<Reactions>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Reactions>>(field: K) => string; isNotNull: <K extends QueryableKeys<Reactions>>(field: K) => string; startsWith: <K extends QueryableKeys<Reactions>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Reactions>>(field: K, value: string) => string; between: <K extends QueryableKeys<Reactions>>(field: K, start: ExtractQueryValue<Reactions[K]>, end: ExtractQueryValue<Reactions[K]>) => string; select: <K extends keyof Reactions>(fields: K[]) => string; orderAsc: <K extends keyof Reactions>(field: K) => string; orderDesc: <K extends keyof Reactions>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Reactions[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Collaborators>>(field: K, value: ExtractQueryValue<Collaborators[K]>) => string; notEqual: <K extends QueryableKeys<Collaborators>>(field: K, value: ExtractQueryValue<Collaborators[K]>) => string; lessThan: <K extends QueryableKeys<Collaborators>>(field: K, value: ExtractQueryValue<Collaborators[K]>) => string; lessThanEqual: <K extends QueryableKeys<Collaborators>>(field: K, value: ExtractQueryValue<Collaborators[K]>) => string; greaterThan: <K extends QueryableKeys<Collaborators>>(field: K, value: ExtractQueryValue<Collaborators[K]>) => string; greaterThanEqual: <K extends QueryableKeys<Collaborators>>(field: K, value: ExtractQueryValue<Collaborators[K]>) => string; contains: <K extends QueryableKeys<Collaborators>>(field: K, value: ExtractQueryValue<Collaborators[K]>) => string; search: <K extends QueryableKeys<Collaborators>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Collaborators>>(field: K) => string; isNotNull: <K extends QueryableKeys<Collaborators>>(field: K) => string; startsWith: <K extends QueryableKeys<Collaborators>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Collaborators>>(field: K, value: string) => string; between: <K extends QueryableKeys<Collaborators>>(field: K, start: ExtractQueryValue<Collaborators[K]>, end: ExtractQueryValue<Collaborators[K]>) => string; select: <K extends keyof Collaborators>(fields: K[]) => string; orderAsc: <K extends keyof Collaborators>(field: K) => string; orderDesc: <K extends keyof Collaborators>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Collaborators[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<ActivityLog>>(field: K, value: ExtractQueryValue<ActivityLog[K]>) => string; notEqual: <K extends QueryableKeys<ActivityLog>>(field: K, value: ExtractQueryValue<ActivityLog[K]>) => string; lessThan: <K extends QueryableKeys<ActivityLog>>(field: K, value: ExtractQueryValue<ActivityLog[K]>) => string; lessThanEqual: <K extends QueryableKeys<ActivityLog>>(field: K, value: ExtractQueryValue<ActivityLog[K]>) => string; greaterThan: <K extends QueryableKeys<ActivityLog>>(field: K, value: ExtractQueryValue<ActivityLog[K]>) => string; greaterThanEqual: <K extends QueryableKeys<ActivityLog>>(field: K, value: ExtractQueryValue<ActivityLog[K]>) => string; contains: <K extends QueryableKeys<ActivityLog>>(field: K, value: ExtractQueryValue<ActivityLog[K]>) => string; search: <K extends QueryableKeys<ActivityLog>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<ActivityLog>>(field: K) => string; isNotNull: <K extends QueryableKeys<ActivityLog>>(field: K) => string; startsWith: <K extends QueryableKeys<ActivityLog>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<ActivityLog>>(field: K, value: string) => string; between: <K extends QueryableKeys<ActivityLog>>(field: K, start: ExtractQueryValue<ActivityLog[K]>, end: ExtractQueryValue<ActivityLog[K]>) => string; select: <K extends keyof ActivityLog>(fields: K[]) => string; orderAsc: <K extends keyof ActivityLog>(field: K) => string; orderDesc: <K extends keyof ActivityLog>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: ActivityLog[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Settings>>(field: K, value: ExtractQueryValue<Settings[K]>) => string; notEqual: <K extends QueryableKeys<Settings>>(field: K, value: ExtractQueryValue<Settings[K]>) => string; lessThan: <K extends QueryableKeys<Settings>>(field: K, value: ExtractQueryValue<Settings[K]>) => string; lessThanEqual: <K extends QueryableKeys<Settings>>(field: K, value: ExtractQueryValue<Settings[K]>) => string; greaterThan: <K extends QueryableKeys<Settings>>(field: K, value: ExtractQueryValue<Settings[K]>) => string; greaterThanEqual: <K extends QueryableKeys<Settings>>(field: K, value: ExtractQueryValue<Settings[K]>) => string; contains: <K extends QueryableKeys<Settings>>(field: K, value: ExtractQueryValue<Settings[K]>) => string; search: <K extends QueryableKeys<Settings>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Settings>>(field: K) => string; isNotNull: <K extends QueryableKeys<Settings>>(field: K) => string; startsWith: <K extends QueryableKeys<Settings>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Settings>>(field: K, value: string) => string; between: <K extends QueryableKeys<Settings>>(field: K, start: ExtractQueryValue<Settings[K]>, end: ExtractQueryValue<Settings[K]>) => string; select: <K extends keyof Settings>(fields: K[]) => string; orderAsc: <K extends keyof Settings>(field: K) => string; orderDesc: <K extends keyof Settings>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Settings[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<WalletMap>>(field: K, value: ExtractQueryValue<WalletMap[K]>) => string; notEqual: <K extends QueryableKeys<WalletMap>>(field: K, value: ExtractQueryValue<WalletMap[K]>) => string; lessThan: <K extends QueryableKeys<WalletMap>>(field: K, value: ExtractQueryValue<WalletMap[K]>) => string; lessThanEqual: <K extends QueryableKeys<WalletMap>>(field: K, value: ExtractQueryValue<WalletMap[K]>) => string; greaterThan: <K extends QueryableKeys<WalletMap>>(field: K, value: ExtractQueryValue<WalletMap[K]>) => string; greaterThanEqual: <K extends QueryableKeys<WalletMap>>(field: K, value: ExtractQueryValue<WalletMap[K]>) => string; contains: <K extends QueryableKeys<WalletMap>>(field: K, value: ExtractQueryValue<WalletMap[K]>) => string; search: <K extends QueryableKeys<WalletMap>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<WalletMap>>(field: K) => string; isNotNull: <K extends QueryableKeys<WalletMap>>(field: K) => string; startsWith: <K extends QueryableKeys<WalletMap>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<WalletMap>>(field: K, value: string) => string; between: <K extends QueryableKeys<WalletMap>>(field: K, start: ExtractQueryValue<WalletMap[K]>, end: ExtractQueryValue<WalletMap[K]>) => string; select: <K extends keyof WalletMap>(fields: K[]) => string; orderAsc: <K extends keyof WalletMap>(field: K) => string; orderDesc: <K extends keyof WalletMap>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: WalletMap[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<NoteTags>>(field: K, value: ExtractQueryValue<NoteTags[K]>) => string; notEqual: <K extends QueryableKeys<NoteTags>>(field: K, value: ExtractQueryValue<NoteTags[K]>) => string; lessThan: <K extends QueryableKeys<NoteTags>>(field: K, value: ExtractQueryValue<NoteTags[K]>) => string; lessThanEqual: <K extends QueryableKeys<NoteTags>>(field: K, value: ExtractQueryValue<NoteTags[K]>) => string; greaterThan: <K extends QueryableKeys<NoteTags>>(field: K, value: ExtractQueryValue<NoteTags[K]>) => string; greaterThanEqual: <K extends QueryableKeys<NoteTags>>(field: K, value: ExtractQueryValue<NoteTags[K]>) => string; contains: <K extends QueryableKeys<NoteTags>>(field: K, value: ExtractQueryValue<NoteTags[K]>) => string; search: <K extends QueryableKeys<NoteTags>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<NoteTags>>(field: K) => string; isNotNull: <K extends QueryableKeys<NoteTags>>(field: K) => string; startsWith: <K extends QueryableKeys<NoteTags>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<NoteTags>>(field: K, value: string) => string; between: <K extends QueryableKeys<NoteTags>>(field: K, start: ExtractQueryValue<NoteTags[K]>, end: ExtractQueryValue<NoteTags[K]>) => string; select: <K extends keyof NoteTags>(fields: K[]) => string; orderAsc: <K extends keyof NoteTags>(field: K) => string; orderDesc: <K extends keyof NoteTags>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: NoteTags[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<NoteRevisions>>(field: K, value: ExtractQueryValue<NoteRevisions[K]>) => string; notEqual: <K extends QueryableKeys<NoteRevisions>>(field: K, value: ExtractQueryValue<NoteRevisions[K]>) => string; lessThan: <K extends QueryableKeys<NoteRevisions>>(field: K, value: ExtractQueryValue<NoteRevisions[K]>) => string; lessThanEqual: <K extends QueryableKeys<NoteRevisions>>(field: K, value: ExtractQueryValue<NoteRevisions[K]>) => string; greaterThan: <K extends QueryableKeys<NoteRevisions>>(field: K, value: ExtractQueryValue<NoteRevisions[K]>) => string; greaterThanEqual: <K extends QueryableKeys<NoteRevisions>>(field: K, value: ExtractQueryValue<NoteRevisions[K]>) => string; contains: <K extends QueryableKeys<NoteRevisions>>(field: K, value: ExtractQueryValue<NoteRevisions[K]>) => string; search: <K extends QueryableKeys<NoteRevisions>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<NoteRevisions>>(field: K) => string; isNotNull: <K extends QueryableKeys<NoteRevisions>>(field: K) => string; startsWith: <K extends QueryableKeys<NoteRevisions>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<NoteRevisions>>(field: K, value: string) => string; between: <K extends QueryableKeys<NoteRevisions>>(field: K, start: ExtractQueryValue<NoteRevisions[K]>, end: ExtractQueryValue<NoteRevisions[K]>) => string; select: <K extends keyof NoteRevisions>(fields: K[]) => string; orderAsc: <K extends keyof NoteRevisions>(field: K) => string; orderDesc: <K extends keyof NoteRevisions>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: NoteRevisions[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<AiGenerations>>(field: K, value: ExtractQueryValue<AiGenerations[K]>) => string; notEqual: <K extends QueryableKeys<AiGenerations>>(field: K, value: ExtractQueryValue<AiGenerations[K]>) => string; lessThan: <K extends QueryableKeys<AiGenerations>>(field: K, value: ExtractQueryValue<AiGenerations[K]>) => string; lessThanEqual: <K extends QueryableKeys<AiGenerations>>(field: K, value: ExtractQueryValue<AiGenerations[K]>) => string; greaterThan: <K extends QueryableKeys<AiGenerations>>(field: K, value: ExtractQueryValue<AiGenerations[K]>) => string; greaterThanEqual: <K extends QueryableKeys<AiGenerations>>(field: K, value: ExtractQueryValue<AiGenerations[K]>) => string; contains: <K extends QueryableKeys<AiGenerations>>(field: K, value: ExtractQueryValue<AiGenerations[K]>) => string; search: <K extends QueryableKeys<AiGenerations>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<AiGenerations>>(field: K) => string; isNotNull: <K extends QueryableKeys<AiGenerations>>(field: K) => string; startsWith: <K extends QueryableKeys<AiGenerations>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<AiGenerations>>(field: K, value: string) => string; between: <K extends QueryableKeys<AiGenerations>>(field: K, start: ExtractQueryValue<AiGenerations[K]>, end: ExtractQueryValue<AiGenerations[K]>) => string; select: <K extends keyof AiGenerations>(fields: K[]) => string; orderAsc: <K extends keyof AiGenerations>(field: K) => string; orderDesc: <K extends keyof AiGenerations>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: AiGenerations[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Subscriptions>>(field: K, value: ExtractQueryValue<Subscriptions[K]>) => string; notEqual: <K extends QueryableKeys<Subscriptions>>(field: K, value: ExtractQueryValue<Subscriptions[K]>) => string; lessThan: <K extends QueryableKeys<Subscriptions>>(field: K, value: ExtractQueryValue<Subscriptions[K]>) => string; lessThanEqual: <K extends QueryableKeys<Subscriptions>>(field: K, value: ExtractQueryValue<Subscriptions[K]>) => string; greaterThan: <K extends QueryableKeys<Subscriptions>>(field: K, value: ExtractQueryValue<Subscriptions[K]>) => string; greaterThanEqual: <K extends QueryableKeys<Subscriptions>>(field: K, value: ExtractQueryValue<Subscriptions[K]>) => string; contains: <K extends QueryableKeys<Subscriptions>>(field: K, value: ExtractQueryValue<Subscriptions[K]>) => string; search: <K extends QueryableKeys<Subscriptions>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Subscriptions>>(field: K) => string; isNotNull: <K extends QueryableKeys<Subscriptions>>(field: K) => string; startsWith: <K extends QueryableKeys<Subscriptions>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Subscriptions>>(field: K, value: string) => string; between: <K extends QueryableKeys<Subscriptions>>(field: K, start: ExtractQueryValue<Subscriptions[K]>, end: ExtractQueryValue<Subscriptions[K]>) => string; select: <K extends keyof Subscriptions>(fields: K[]) => string; orderAsc: <K extends keyof Subscriptions>(field: K) => string; orderDesc: <K extends keyof Subscriptions>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Subscriptions[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<SecurityLogs>>(field: K, value: ExtractQueryValue<SecurityLogs[K]>) => string; notEqual: <K extends QueryableKeys<SecurityLogs>>(field: K, value: ExtractQueryValue<SecurityLogs[K]>) => string; lessThan: <K extends QueryableKeys<SecurityLogs>>(field: K, value: ExtractQueryValue<SecurityLogs[K]>) => string; lessThanEqual: <K extends QueryableKeys<SecurityLogs>>(field: K, value: ExtractQueryValue<SecurityLogs[K]>) => string; greaterThan: <K extends QueryableKeys<SecurityLogs>>(field: K, value: ExtractQueryValue<SecurityLogs[K]>) => string; greaterThanEqual: <K extends QueryableKeys<SecurityLogs>>(field: K, value: ExtractQueryValue<SecurityLogs[K]>) => string; contains: <K extends QueryableKeys<SecurityLogs>>(field: K, value: ExtractQueryValue<SecurityLogs[K]>) => string; search: <K extends QueryableKeys<SecurityLogs>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<SecurityLogs>>(field: K) => string; isNotNull: <K extends QueryableKeys<SecurityLogs>>(field: K) => string; startsWith: <K extends QueryableKeys<SecurityLogs>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<SecurityLogs>>(field: K, value: string) => string; between: <K extends QueryableKeys<SecurityLogs>>(field: K, start: ExtractQueryValue<SecurityLogs[K]>, end: ExtractQueryValue<SecurityLogs[K]>) => string; select: <K extends keyof SecurityLogs>(fields: K[]) => string; orderAsc: <K extends keyof SecurityLogs>(field: K) => string; orderDesc: <K extends keyof SecurityLogs>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: SecurityLogs[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Credentials>>(field: K, value: ExtractQueryValue<Credentials[K]>) => string; notEqual: <K extends QueryableKeys<Credentials>>(field: K, value: ExtractQueryValue<Credentials[K]>) => string; lessThan: <K extends QueryableKeys<Credentials>>(field: K, value: ExtractQueryValue<Credentials[K]>) => string; lessThanEqual: <K extends QueryableKeys<Credentials>>(field: K, value: ExtractQueryValue<Credentials[K]>) => string; greaterThan: <K extends QueryableKeys<Credentials>>(field: K, value: ExtractQueryValue<Credentials[K]>) => string; greaterThanEqual: <K extends QueryableKeys<Credentials>>(field: K, value: ExtractQueryValue<Credentials[K]>) => string; contains: <K extends QueryableKeys<Credentials>>(field: K, value: ExtractQueryValue<Credentials[K]>) => string; search: <K extends QueryableKeys<Credentials>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Credentials>>(field: K) => string; isNotNull: <K extends QueryableKeys<Credentials>>(field: K) => string; startsWith: <K extends QueryableKeys<Credentials>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Credentials>>(field: K, value: string) => string; between: <K extends QueryableKeys<Credentials>>(field: K, start: ExtractQueryValue<Credentials[K]>, end: ExtractQueryValue<Credentials[K]>) => string; select: <K extends keyof Credentials>(fields: K[]) => string; orderAsc: <K extends keyof Credentials>(field: K) => string; orderDesc: <K extends keyof Credentials>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Credentials[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Identities>>(field: K, value: ExtractQueryValue<Identities[K]>) => string; notEqual: <K extends QueryableKeys<Identities>>(field: K, value: ExtractQueryValue<Identities[K]>) => string; lessThan: <K extends QueryableKeys<Identities>>(field: K, value: ExtractQueryValue<Identities[K]>) => string; lessThanEqual: <K extends QueryableKeys<Identities>>(field: K, value: ExtractQueryValue<Identities[K]>) => string; greaterThan: <K extends QueryableKeys<Identities>>(field: K, value: ExtractQueryValue<Identities[K]>) => string; greaterThanEqual: <K extends QueryableKeys<Identities>>(field: K, value: ExtractQueryValue<Identities[K]>) => string; contains: <K extends QueryableKeys<Identities>>(field: K, value: ExtractQueryValue<Identities[K]>) => string; search: <K extends QueryableKeys<Identities>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Identities>>(field: K) => string; isNotNull: <K extends QueryableKeys<Identities>>(field: K) => string; startsWith: <K extends QueryableKeys<Identities>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Identities>>(field: K, value: string) => string; between: <K extends QueryableKeys<Identities>>(field: K, start: ExtractQueryValue<Identities[K]>, end: ExtractQueryValue<Identities[K]>) => string; select: <K extends keyof Identities>(fields: K[]) => string; orderAsc: <K extends keyof Identities>(field: K) => string; orderDesc: <K extends keyof Identities>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Identities[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<User>>(field: K, value: ExtractQueryValue<User[K]>) => string; notEqual: <K extends QueryableKeys<User>>(field: K, value: ExtractQueryValue<User[K]>) => string; lessThan: <K extends QueryableKeys<User>>(field: K, value: ExtractQueryValue<User[K]>) => string; lessThanEqual: <K extends QueryableKeys<User>>(field: K, value: ExtractQueryValue<User[K]>) => string; greaterThan: <K extends QueryableKeys<User>>(field: K, value: ExtractQueryValue<User[K]>) => string; greaterThanEqual: <K extends QueryableKeys<User>>(field: K, value: ExtractQueryValue<User[K]>) => string; contains: <K extends QueryableKeys<User>>(field: K, value: ExtractQueryValue<User[K]>) => string; search: <K extends QueryableKeys<User>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<User>>(field: K) => string; isNotNull: <K extends QueryableKeys<User>>(field: K) => string; startsWith: <K extends QueryableKeys<User>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<User>>(field: K, value: string) => string; between: <K extends QueryableKeys<User>>(field: K, start: ExtractQueryValue<User[K]>, end: ExtractQueryValue<User[K]>) => string; select: <K extends keyof User>(fields: K[]) => string; orderAsc: <K extends keyof User>(field: K) => string; orderDesc: <K extends keyof User>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: User[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Folders>>(field: K, value: ExtractQueryValue<Folders[K]>) => string; notEqual: <K extends QueryableKeys<Folders>>(field: K, value: ExtractQueryValue<Folders[K]>) => string; lessThan: <K extends QueryableKeys<Folders>>(field: K, value: ExtractQueryValue<Folders[K]>) => string; lessThanEqual: <K extends QueryableKeys<Folders>>(field: K, value: ExtractQueryValue<Folders[K]>) => string; greaterThan: <K extends QueryableKeys<Folders>>(field: K, value: ExtractQueryValue<Folders[K]>) => string; greaterThanEqual: <K extends QueryableKeys<Folders>>(field: K, value: ExtractQueryValue<Folders[K]>) => string; contains: <K extends QueryableKeys<Folders>>(field: K, value: ExtractQueryValue<Folders[K]>) => string; search: <K extends QueryableKeys<Folders>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Folders>>(field: K) => string; isNotNull: <K extends QueryableKeys<Folders>>(field: K) => string; startsWith: <K extends QueryableKeys<Folders>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Folders>>(field: K, value: string) => string; between: <K extends QueryableKeys<Folders>>(field: K, start: ExtractQueryValue<Folders[K]>, end: ExtractQueryValue<Folders[K]>) => string; select: <K extends keyof Folders>(fields: K[]) => string; orderAsc: <K extends keyof Folders>(field: K) => string; orderDesc: <K extends keyof Folders>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Folders[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<TotpSecrets>>(field: K, value: ExtractQueryValue<TotpSecrets[K]>) => string; notEqual: <K extends QueryableKeys<TotpSecrets>>(field: K, value: ExtractQueryValue<TotpSecrets[K]>) => string; lessThan: <K extends QueryableKeys<TotpSecrets>>(field: K, value: ExtractQueryValue<TotpSecrets[K]>) => string; lessThanEqual: <K extends QueryableKeys<TotpSecrets>>(field: K, value: ExtractQueryValue<TotpSecrets[K]>) => string; greaterThan: <K extends QueryableKeys<TotpSecrets>>(field: K, value: ExtractQueryValue<TotpSecrets[K]>) => string; greaterThanEqual: <K extends QueryableKeys<TotpSecrets>>(field: K, value: ExtractQueryValue<TotpSecrets[K]>) => string; contains: <K extends QueryableKeys<TotpSecrets>>(field: K, value: ExtractQueryValue<TotpSecrets[K]>) => string; search: <K extends QueryableKeys<TotpSecrets>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<TotpSecrets>>(field: K) => string; isNotNull: <K extends QueryableKeys<TotpSecrets>>(field: K) => string; startsWith: <K extends QueryableKeys<TotpSecrets>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<TotpSecrets>>(field: K, value: string) => string; between: <K extends QueryableKeys<TotpSecrets>>(field: K, start: ExtractQueryValue<TotpSecrets[K]>, end: ExtractQueryValue<TotpSecrets[K]>) => string; select: <K extends keyof TotpSecrets>(fields: K[]) => string; orderAsc: <K extends keyof TotpSecrets>(field: K) => string; orderDesc: <K extends keyof TotpSecrets>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: TotpSecrets[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Keychain>>(field: K, value: ExtractQueryValue<Keychain[K]>) => string; notEqual: <K extends QueryableKeys<Keychain>>(field: K, value: ExtractQueryValue<Keychain[K]>) => string; lessThan: <K extends QueryableKeys<Keychain>>(field: K, value: ExtractQueryValue<Keychain[K]>) => string; lessThanEqual: <K extends QueryableKeys<Keychain>>(field: K, value: ExtractQueryValue<Keychain[K]>) => string; greaterThan: <K extends QueryableKeys<Keychain>>(field: K, value: ExtractQueryValue<Keychain[K]>) => string; greaterThanEqual: <K extends QueryableKeys<Keychain>>(field: K, value: ExtractQueryValue<Keychain[K]>) => string; contains: <K extends QueryableKeys<Keychain>>(field: K, value: ExtractQueryValue<Keychain[K]>) => string; search: <K extends QueryableKeys<Keychain>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Keychain>>(field: K) => string; isNotNull: <K extends QueryableKeys<Keychain>>(field: K) => string; startsWith: <K extends QueryableKeys<Keychain>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Keychain>>(field: K, value: string) => string; between: <K extends QueryableKeys<Keychain>>(field: K, start: ExtractQueryValue<Keychain[K]>, end: ExtractQueryValue<Keychain[K]>) => string; select: <K extends keyof Keychain>(fields: K[]) => string; orderAsc: <K extends keyof Keychain>(field: K) => string; orderDesc: <K extends keyof Keychain>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Keychain[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Messages>>(field: K, value: ExtractQueryValue<Messages[K]>) => string; notEqual: <K extends QueryableKeys<Messages>>(field: K, value: ExtractQueryValue<Messages[K]>) => string; lessThan: <K extends QueryableKeys<Messages>>(field: K, value: ExtractQueryValue<Messages[K]>) => string; lessThanEqual: <K extends QueryableKeys<Messages>>(field: K, value: ExtractQueryValue<Messages[K]>) => string; greaterThan: <K extends QueryableKeys<Messages>>(field: K, value: ExtractQueryValue<Messages[K]>) => string; greaterThanEqual: <K extends QueryableKeys<Messages>>(field: K, value: ExtractQueryValue<Messages[K]>) => string; contains: <K extends QueryableKeys<Messages>>(field: K, value: ExtractQueryValue<Messages[K]>) => string; search: <K extends QueryableKeys<Messages>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Messages>>(field: K) => string; isNotNull: <K extends QueryableKeys<Messages>>(field: K) => string; startsWith: <K extends QueryableKeys<Messages>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Messages>>(field: K, value: string) => string; between: <K extends QueryableKeys<Messages>>(field: K, start: ExtractQueryValue<Messages[K]>, end: ExtractQueryValue<Messages[K]>) => string; select: <K extends keyof Messages>(fields: K[]) => string; orderAsc: <K extends keyof Messages>(field: K) => string; orderDesc: <K extends keyof Messages>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Messages[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Conversations>>(field: K, value: ExtractQueryValue<Conversations[K]>) => string; notEqual: <K extends QueryableKeys<Conversations>>(field: K, value: ExtractQueryValue<Conversations[K]>) => string; lessThan: <K extends QueryableKeys<Conversations>>(field: K, value: ExtractQueryValue<Conversations[K]>) => string; lessThanEqual: <K extends QueryableKeys<Conversations>>(field: K, value: ExtractQueryValue<Conversations[K]>) => string; greaterThan: <K extends QueryableKeys<Conversations>>(field: K, value: ExtractQueryValue<Conversations[K]>) => string; greaterThanEqual: <K extends QueryableKeys<Conversations>>(field: K, value: ExtractQueryValue<Conversations[K]>) => string; contains: <K extends QueryableKeys<Conversations>>(field: K, value: ExtractQueryValue<Conversations[K]>) => string; search: <K extends QueryableKeys<Conversations>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Conversations>>(field: K) => string; isNotNull: <K extends QueryableKeys<Conversations>>(field: K) => string; startsWith: <K extends QueryableKeys<Conversations>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Conversations>>(field: K, value: string) => string; between: <K extends QueryableKeys<Conversations>>(field: K, start: ExtractQueryValue<Conversations[K]>, end: ExtractQueryValue<Conversations[K]>) => string; select: <K extends keyof Conversations>(fields: K[]) => string; orderAsc: <K extends keyof Conversations>(field: K) => string; orderDesc: <K extends keyof Conversations>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Conversations[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Contacts>>(field: K, value: ExtractQueryValue<Contacts[K]>) => string; notEqual: <K extends QueryableKeys<Contacts>>(field: K, value: ExtractQueryValue<Contacts[K]>) => string; lessThan: <K extends QueryableKeys<Contacts>>(field: K, value: ExtractQueryValue<Contacts[K]>) => string; lessThanEqual: <K extends QueryableKeys<Contacts>>(field: K, value: ExtractQueryValue<Contacts[K]>) => string; greaterThan: <K extends QueryableKeys<Contacts>>(field: K, value: ExtractQueryValue<Contacts[K]>) => string; greaterThanEqual: <K extends QueryableKeys<Contacts>>(field: K, value: ExtractQueryValue<Contacts[K]>) => string; contains: <K extends QueryableKeys<Contacts>>(field: K, value: ExtractQueryValue<Contacts[K]>) => string; search: <K extends QueryableKeys<Contacts>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Contacts>>(field: K) => string; isNotNull: <K extends QueryableKeys<Contacts>>(field: K) => string; startsWith: <K extends QueryableKeys<Contacts>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Contacts>>(field: K, value: string) => string; between: <K extends QueryableKeys<Contacts>>(field: K, start: ExtractQueryValue<Contacts[K]>, end: ExtractQueryValue<Contacts[K]>) => string; select: <K extends keyof Contacts>(fields: K[]) => string; orderAsc: <K extends keyof Contacts>(field: K) => string; orderDesc: <K extends keyof Contacts>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Contacts[] }>;
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
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Users>;
      get: (id: string) => Promise<Users>;
      update: (id: string, data: Partial<{
        "username": string;
        "displayName"?: string | null;
        "bio"?: string | null;
        "walletAddress"?: string | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
        "publicKey"?: string | null;
        "avatar"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Users>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Users>>(field: K, value: ExtractQueryValue<Users[K]>) => string; notEqual: <K extends QueryableKeys<Users>>(field: K, value: ExtractQueryValue<Users[K]>) => string; lessThan: <K extends QueryableKeys<Users>>(field: K, value: ExtractQueryValue<Users[K]>) => string; lessThanEqual: <K extends QueryableKeys<Users>>(field: K, value: ExtractQueryValue<Users[K]>) => string; greaterThan: <K extends QueryableKeys<Users>>(field: K, value: ExtractQueryValue<Users[K]>) => string; greaterThanEqual: <K extends QueryableKeys<Users>>(field: K, value: ExtractQueryValue<Users[K]>) => string; contains: <K extends QueryableKeys<Users>>(field: K, value: ExtractQueryValue<Users[K]>) => string; search: <K extends QueryableKeys<Users>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Users>>(field: K) => string; isNotNull: <K extends QueryableKeys<Users>>(field: K) => string; startsWith: <K extends QueryableKeys<Users>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Users>>(field: K, value: string) => string; between: <K extends QueryableKeys<Users>>(field: K, start: ExtractQueryValue<Users[K]>, end: ExtractQueryValue<Users[K]>) => string; select: <K extends keyof Users>(fields: K[]) => string; orderAsc: <K extends keyof Users>(field: K) => string; orderDesc: <K extends keyof Users>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Users[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Follows>>(field: K, value: ExtractQueryValue<Follows[K]>) => string; notEqual: <K extends QueryableKeys<Follows>>(field: K, value: ExtractQueryValue<Follows[K]>) => string; lessThan: <K extends QueryableKeys<Follows>>(field: K, value: ExtractQueryValue<Follows[K]>) => string; lessThanEqual: <K extends QueryableKeys<Follows>>(field: K, value: ExtractQueryValue<Follows[K]>) => string; greaterThan: <K extends QueryableKeys<Follows>>(field: K, value: ExtractQueryValue<Follows[K]>) => string; greaterThanEqual: <K extends QueryableKeys<Follows>>(field: K, value: ExtractQueryValue<Follows[K]>) => string; contains: <K extends QueryableKeys<Follows>>(field: K, value: ExtractQueryValue<Follows[K]>) => string; search: <K extends QueryableKeys<Follows>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Follows>>(field: K) => string; isNotNull: <K extends QueryableKeys<Follows>>(field: K) => string; startsWith: <K extends QueryableKeys<Follows>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Follows>>(field: K, value: string) => string; between: <K extends QueryableKeys<Follows>>(field: K, start: ExtractQueryValue<Follows[K]>, end: ExtractQueryValue<Follows[K]>) => string; select: <K extends keyof Follows>(fields: K[]) => string; orderAsc: <K extends keyof Follows>(field: K) => string; orderDesc: <K extends keyof Follows>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Follows[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<AppActivity>>(field: K, value: ExtractQueryValue<AppActivity[K]>) => string; notEqual: <K extends QueryableKeys<AppActivity>>(field: K, value: ExtractQueryValue<AppActivity[K]>) => string; lessThan: <K extends QueryableKeys<AppActivity>>(field: K, value: ExtractQueryValue<AppActivity[K]>) => string; lessThanEqual: <K extends QueryableKeys<AppActivity>>(field: K, value: ExtractQueryValue<AppActivity[K]>) => string; greaterThan: <K extends QueryableKeys<AppActivity>>(field: K, value: ExtractQueryValue<AppActivity[K]>) => string; greaterThanEqual: <K extends QueryableKeys<AppActivity>>(field: K, value: ExtractQueryValue<AppActivity[K]>) => string; contains: <K extends QueryableKeys<AppActivity>>(field: K, value: ExtractQueryValue<AppActivity[K]>) => string; search: <K extends QueryableKeys<AppActivity>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<AppActivity>>(field: K) => string; isNotNull: <K extends QueryableKeys<AppActivity>>(field: K) => string; startsWith: <K extends QueryableKeys<AppActivity>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<AppActivity>>(field: K, value: string) => string; between: <K extends QueryableKeys<AppActivity>>(field: K, start: ExtractQueryValue<AppActivity[K]>, end: ExtractQueryValue<AppActivity[K]>) => string; select: <K extends keyof AppActivity>(fields: K[]) => string; orderAsc: <K extends keyof AppActivity>(field: K) => string; orderDesc: <K extends keyof AppActivity>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: AppActivity[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<CallLinks>>(field: K, value: ExtractQueryValue<CallLinks[K]>) => string; notEqual: <K extends QueryableKeys<CallLinks>>(field: K, value: ExtractQueryValue<CallLinks[K]>) => string; lessThan: <K extends QueryableKeys<CallLinks>>(field: K, value: ExtractQueryValue<CallLinks[K]>) => string; lessThanEqual: <K extends QueryableKeys<CallLinks>>(field: K, value: ExtractQueryValue<CallLinks[K]>) => string; greaterThan: <K extends QueryableKeys<CallLinks>>(field: K, value: ExtractQueryValue<CallLinks[K]>) => string; greaterThanEqual: <K extends QueryableKeys<CallLinks>>(field: K, value: ExtractQueryValue<CallLinks[K]>) => string; contains: <K extends QueryableKeys<CallLinks>>(field: K, value: ExtractQueryValue<CallLinks[K]>) => string; search: <K extends QueryableKeys<CallLinks>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<CallLinks>>(field: K) => string; isNotNull: <K extends QueryableKeys<CallLinks>>(field: K) => string; startsWith: <K extends QueryableKeys<CallLinks>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<CallLinks>>(field: K, value: string) => string; between: <K extends QueryableKeys<CallLinks>>(field: K, start: ExtractQueryValue<CallLinks[K]>, end: ExtractQueryValue<CallLinks[K]>) => string; select: <K extends keyof CallLinks>(fields: K[]) => string; orderAsc: <K extends keyof CallLinks>(field: K) => string; orderDesc: <K extends keyof CallLinks>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: CallLinks[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Interactions>>(field: K, value: ExtractQueryValue<Interactions[K]>) => string; notEqual: <K extends QueryableKeys<Interactions>>(field: K, value: ExtractQueryValue<Interactions[K]>) => string; lessThan: <K extends QueryableKeys<Interactions>>(field: K, value: ExtractQueryValue<Interactions[K]>) => string; lessThanEqual: <K extends QueryableKeys<Interactions>>(field: K, value: ExtractQueryValue<Interactions[K]>) => string; greaterThan: <K extends QueryableKeys<Interactions>>(field: K, value: ExtractQueryValue<Interactions[K]>) => string; greaterThanEqual: <K extends QueryableKeys<Interactions>>(field: K, value: ExtractQueryValue<Interactions[K]>) => string; contains: <K extends QueryableKeys<Interactions>>(field: K, value: ExtractQueryValue<Interactions[K]>) => string; search: <K extends QueryableKeys<Interactions>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Interactions>>(field: K) => string; isNotNull: <K extends QueryableKeys<Interactions>>(field: K) => string; startsWith: <K extends QueryableKeys<Interactions>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Interactions>>(field: K, value: string) => string; between: <K extends QueryableKeys<Interactions>>(field: K, start: ExtractQueryValue<Interactions[K]>, end: ExtractQueryValue<Interactions[K]>) => string; select: <K extends keyof Interactions>(fields: K[]) => string; orderAsc: <K extends keyof Interactions>(field: K) => string; orderDesc: <K extends keyof Interactions>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Interactions[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<CallLogs>>(field: K, value: ExtractQueryValue<CallLogs[K]>) => string; notEqual: <K extends QueryableKeys<CallLogs>>(field: K, value: ExtractQueryValue<CallLogs[K]>) => string; lessThan: <K extends QueryableKeys<CallLogs>>(field: K, value: ExtractQueryValue<CallLogs[K]>) => string; lessThanEqual: <K extends QueryableKeys<CallLogs>>(field: K, value: ExtractQueryValue<CallLogs[K]>) => string; greaterThan: <K extends QueryableKeys<CallLogs>>(field: K, value: ExtractQueryValue<CallLogs[K]>) => string; greaterThanEqual: <K extends QueryableKeys<CallLogs>>(field: K, value: ExtractQueryValue<CallLogs[K]>) => string; contains: <K extends QueryableKeys<CallLogs>>(field: K, value: ExtractQueryValue<CallLogs[K]>) => string; search: <K extends QueryableKeys<CallLogs>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<CallLogs>>(field: K) => string; isNotNull: <K extends QueryableKeys<CallLogs>>(field: K) => string; startsWith: <K extends QueryableKeys<CallLogs>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<CallLogs>>(field: K, value: string) => string; between: <K extends QueryableKeys<CallLogs>>(field: K, start: ExtractQueryValue<CallLogs[K]>, end: ExtractQueryValue<CallLogs[K]>) => string; select: <K extends keyof CallLogs>(fields: K[]) => string; orderAsc: <K extends keyof CallLogs>(field: K) => string; orderDesc: <K extends keyof CallLogs>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: CallLogs[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Moments>>(field: K, value: ExtractQueryValue<Moments[K]>) => string; notEqual: <K extends QueryableKeys<Moments>>(field: K, value: ExtractQueryValue<Moments[K]>) => string; lessThan: <K extends QueryableKeys<Moments>>(field: K, value: ExtractQueryValue<Moments[K]>) => string; lessThanEqual: <K extends QueryableKeys<Moments>>(field: K, value: ExtractQueryValue<Moments[K]>) => string; greaterThan: <K extends QueryableKeys<Moments>>(field: K, value: ExtractQueryValue<Moments[K]>) => string; greaterThanEqual: <K extends QueryableKeys<Moments>>(field: K, value: ExtractQueryValue<Moments[K]>) => string; contains: <K extends QueryableKeys<Moments>>(field: K, value: ExtractQueryValue<Moments[K]>) => string; search: <K extends QueryableKeys<Moments>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Moments>>(field: K) => string; isNotNull: <K extends QueryableKeys<Moments>>(field: K) => string; startsWith: <K extends QueryableKeys<Moments>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Moments>>(field: K, value: string) => string; between: <K extends QueryableKeys<Moments>>(field: K, start: ExtractQueryValue<Moments[K]>, end: ExtractQueryValue<Moments[K]>) => string; select: <K extends keyof Moments>(fields: K[]) => string; orderAsc: <K extends keyof Moments>(field: K) => string; orderDesc: <K extends keyof Moments>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Moments[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<FocusSessions>>(field: K, value: ExtractQueryValue<FocusSessions[K]>) => string; notEqual: <K extends QueryableKeys<FocusSessions>>(field: K, value: ExtractQueryValue<FocusSessions[K]>) => string; lessThan: <K extends QueryableKeys<FocusSessions>>(field: K, value: ExtractQueryValue<FocusSessions[K]>) => string; lessThanEqual: <K extends QueryableKeys<FocusSessions>>(field: K, value: ExtractQueryValue<FocusSessions[K]>) => string; greaterThan: <K extends QueryableKeys<FocusSessions>>(field: K, value: ExtractQueryValue<FocusSessions[K]>) => string; greaterThanEqual: <K extends QueryableKeys<FocusSessions>>(field: K, value: ExtractQueryValue<FocusSessions[K]>) => string; contains: <K extends QueryableKeys<FocusSessions>>(field: K, value: ExtractQueryValue<FocusSessions[K]>) => string; search: <K extends QueryableKeys<FocusSessions>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<FocusSessions>>(field: K) => string; isNotNull: <K extends QueryableKeys<FocusSessions>>(field: K) => string; startsWith: <K extends QueryableKeys<FocusSessions>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<FocusSessions>>(field: K, value: string) => string; between: <K extends QueryableKeys<FocusSessions>>(field: K, start: ExtractQueryValue<FocusSessions[K]>, end: ExtractQueryValue<FocusSessions[K]>) => string; select: <K extends keyof FocusSessions>(fields: K[]) => string; orderAsc: <K extends keyof FocusSessions>(field: K) => string; orderDesc: <K extends keyof FocusSessions>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: FocusSessions[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<EventGuests>>(field: K, value: ExtractQueryValue<EventGuests[K]>) => string; notEqual: <K extends QueryableKeys<EventGuests>>(field: K, value: ExtractQueryValue<EventGuests[K]>) => string; lessThan: <K extends QueryableKeys<EventGuests>>(field: K, value: ExtractQueryValue<EventGuests[K]>) => string; lessThanEqual: <K extends QueryableKeys<EventGuests>>(field: K, value: ExtractQueryValue<EventGuests[K]>) => string; greaterThan: <K extends QueryableKeys<EventGuests>>(field: K, value: ExtractQueryValue<EventGuests[K]>) => string; greaterThanEqual: <K extends QueryableKeys<EventGuests>>(field: K, value: ExtractQueryValue<EventGuests[K]>) => string; contains: <K extends QueryableKeys<EventGuests>>(field: K, value: ExtractQueryValue<EventGuests[K]>) => string; search: <K extends QueryableKeys<EventGuests>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<EventGuests>>(field: K) => string; isNotNull: <K extends QueryableKeys<EventGuests>>(field: K) => string; startsWith: <K extends QueryableKeys<EventGuests>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<EventGuests>>(field: K, value: string) => string; between: <K extends QueryableKeys<EventGuests>>(field: K, start: ExtractQueryValue<EventGuests[K]>, end: ExtractQueryValue<EventGuests[K]>) => string; select: <K extends keyof EventGuests>(fields: K[]) => string; orderAsc: <K extends keyof EventGuests>(field: K) => string; orderDesc: <K extends keyof EventGuests>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: EventGuests[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Events>>(field: K, value: ExtractQueryValue<Events[K]>) => string; notEqual: <K extends QueryableKeys<Events>>(field: K, value: ExtractQueryValue<Events[K]>) => string; lessThan: <K extends QueryableKeys<Events>>(field: K, value: ExtractQueryValue<Events[K]>) => string; lessThanEqual: <K extends QueryableKeys<Events>>(field: K, value: ExtractQueryValue<Events[K]>) => string; greaterThan: <K extends QueryableKeys<Events>>(field: K, value: ExtractQueryValue<Events[K]>) => string; greaterThanEqual: <K extends QueryableKeys<Events>>(field: K, value: ExtractQueryValue<Events[K]>) => string; contains: <K extends QueryableKeys<Events>>(field: K, value: ExtractQueryValue<Events[K]>) => string; search: <K extends QueryableKeys<Events>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Events>>(field: K) => string; isNotNull: <K extends QueryableKeys<Events>>(field: K) => string; startsWith: <K extends QueryableKeys<Events>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Events>>(field: K, value: string) => string; between: <K extends QueryableKeys<Events>>(field: K, start: ExtractQueryValue<Events[K]>, end: ExtractQueryValue<Events[K]>) => string; select: <K extends keyof Events>(fields: K[]) => string; orderAsc: <K extends keyof Events>(field: K) => string; orderDesc: <K extends keyof Events>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Events[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Calendars>>(field: K, value: ExtractQueryValue<Calendars[K]>) => string; notEqual: <K extends QueryableKeys<Calendars>>(field: K, value: ExtractQueryValue<Calendars[K]>) => string; lessThan: <K extends QueryableKeys<Calendars>>(field: K, value: ExtractQueryValue<Calendars[K]>) => string; lessThanEqual: <K extends QueryableKeys<Calendars>>(field: K, value: ExtractQueryValue<Calendars[K]>) => string; greaterThan: <K extends QueryableKeys<Calendars>>(field: K, value: ExtractQueryValue<Calendars[K]>) => string; greaterThanEqual: <K extends QueryableKeys<Calendars>>(field: K, value: ExtractQueryValue<Calendars[K]>) => string; contains: <K extends QueryableKeys<Calendars>>(field: K, value: ExtractQueryValue<Calendars[K]>) => string; search: <K extends QueryableKeys<Calendars>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Calendars>>(field: K) => string; isNotNull: <K extends QueryableKeys<Calendars>>(field: K) => string; startsWith: <K extends QueryableKeys<Calendars>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Calendars>>(field: K, value: string) => string; between: <K extends QueryableKeys<Calendars>>(field: K, start: ExtractQueryValue<Calendars[K]>, end: ExtractQueryValue<Calendars[K]>) => string; select: <K extends keyof Calendars>(fields: K[]) => string; orderAsc: <K extends keyof Calendars>(field: K) => string; orderDesc: <K extends keyof Calendars>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Calendars[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Tasks>>(field: K, value: ExtractQueryValue<Tasks[K]>) => string; notEqual: <K extends QueryableKeys<Tasks>>(field: K, value: ExtractQueryValue<Tasks[K]>) => string; lessThan: <K extends QueryableKeys<Tasks>>(field: K, value: ExtractQueryValue<Tasks[K]>) => string; lessThanEqual: <K extends QueryableKeys<Tasks>>(field: K, value: ExtractQueryValue<Tasks[K]>) => string; greaterThan: <K extends QueryableKeys<Tasks>>(field: K, value: ExtractQueryValue<Tasks[K]>) => string; greaterThanEqual: <K extends QueryableKeys<Tasks>>(field: K, value: ExtractQueryValue<Tasks[K]>) => string; contains: <K extends QueryableKeys<Tasks>>(field: K, value: ExtractQueryValue<Tasks[K]>) => string; search: <K extends QueryableKeys<Tasks>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Tasks>>(field: K) => string; isNotNull: <K extends QueryableKeys<Tasks>>(field: K) => string; startsWith: <K extends QueryableKeys<Tasks>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Tasks>>(field: K, value: string) => string; between: <K extends QueryableKeys<Tasks>>(field: K, start: ExtractQueryValue<Tasks[K]>, end: ExtractQueryValue<Tasks[K]>) => string; select: <K extends keyof Tasks>(fields: K[]) => string; orderAsc: <K extends keyof Tasks>(field: K) => string; orderDesc: <K extends keyof Tasks>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Tasks[] }>;
    }
  }
};

export type DatabaseHandle<D extends DatabaseId> = {
  use: <T extends keyof DatabaseTableMap[D] & string>(tableId: T) => DatabaseTableMap[D][T];

};

export type DatabaseTables = {
  use: <D extends DatabaseId>(databaseId: D) => DatabaseHandle<D>;

};
