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

export enum BillingTransactionsStatus {
    PENDING = "pending",
    PROCESSING = "processing",
    COMPLETED = "completed",
    FAILED = "failed",
    REFUNDED = "refunded"
}

export enum BillingTransactionsProvider {
    BLOCKBEE = "blockbee",
    STRIPE = "stripe",
    MANUAL = "manual"
}

export enum BillingWebhookLogsProvider {
    BLOCKBEE = "blockbee",
    STRIPE = "stripe"
}

export enum BillingWebhookLogsStatus {
    SUCCESS = "success",
    SIGNATURE_FAILED = "signature_failed",
    FAILED = "failed"
}

export enum CouponsStatus {
    ACTIVE = "active",
    REVOKED = "revoked",
    DEPLETED = "depleted",
    EXPIRED = "expired"
}

export enum UserResourcePinsResourceType {
    NOTE = "note",
    CREDENTIAL = "credential",
    TOTP = "totp",
    TASK = "task",
    CALENDAR = "calendar",
    EVENT = "event",
    FORM = "form",
    PROJECT = "project",
    CONVERSATION = "conversation",
    MESSAGE = "message"
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

export enum MomentsType {
    IMAGE = "image",
    VIDEO = "video"
}

export enum CallsType {
    AUDIO = "audio",
    VIDEO = "video"
}

export enum JoinRequestsStatus {
    PENDING = "pending",
    ACCEPTED = "accepted",
    REJECTED = "rejected"
}

export enum UnorganicEmailsStatus {
    QUEUED = "queued",
    SENDING = "sending",
    SENT = "sent",
    SUPPRESSED = "suppressed",
    FAILED = "failed"
}

export enum ProjectsVisibility {
    PRIVATE = "private",
    SHARED = "shared",
    PUBLIC = "public"
}

export enum ProjectsStatus {
    ACTIVE = "active",
    PAUSED = "paused",
    ARCHIVED = "archived"
}

export enum CallSignalsType {
    OFFER = "offer",
    ANSWER = "answer",
    CANDIDATE = "candidate"
}

export enum AccountEventsStatus {
    ACTIVE = "active",
    USED = "used",
    REVOKED = "revoked",
    APPLIED = "applied",
    REDEEMED = "redeemed",
    PENDING = "pending"
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

export enum CollaboratorsPermission {
    READ = "read",
    WRITE = "write",
    ADMIN = "admin"
}

export enum CollaboratorsStatus {
    PENDING = "pending",
    ACCEPTED = "accepted",
    DECLINED = "declined",
    REVOKED = "revoked"
}

export enum ActionThreadsStatus {
    RUNNING = "running",
    COMPLETED = "completed",
    FAILED = "failed"
}

export enum NotificationsType {
    DIRECT = "direct",
    SUGGESTED = "suggested"
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
    "sharedFrom"?: string | null;
    "attachments"?: string | null;
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
    "isShared"?: boolean | null;
    "isPinned"?: boolean | null;
    "source"?: string | null;
    "dek"?: string | null;
    "keepPermission"?: boolean | null;
    "isTrash"?: boolean;
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
    "sharedFrom"?: string | null;
    "attachments"?: string | null;
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
    "isShared"?: boolean | null;
    "isPinned"?: boolean | null;
    "source"?: string | null;
    "dek"?: string | null;
    "keepPermission"?: boolean | null;
    "isTrash"?: boolean;
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
    "passkey_reminder_at"?: string | null;
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
    "passkey_reminder_at"?: string | null;
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
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
    "isShared"?: boolean | null;
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
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
    "isShared"?: boolean | null;
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
    "sharedFrom"?: string | null;
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
    "isShared"?: boolean | null;
    "isPinned"?: boolean | null;
    "source"?: string | null;
    "dek"?: string | null;
    "keepPermission"?: boolean | null;
    "isTrash"?: boolean;
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
    "sharedFrom"?: string | null;
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
    "isShared"?: boolean | null;
    "isPinned"?: boolean | null;
    "source"?: string | null;
    "dek"?: string | null;
    "keepPermission"?: boolean | null;
    "isTrash"?: boolean;
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
    "isArgon"?: boolean;
    "isPending"?: boolean;
    "totpId"?: string;
    "authPass"?: boolean;
    "publicKey"?: string | null;
    "authPasskey"?: boolean;
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
    "isArgon"?: boolean;
    "isPending"?: boolean;
    "totpId"?: string;
    "authPass"?: boolean;
    "publicKey"?: string | null;
    "authPasskey"?: boolean;
}

export type KeyMappingCreate = {
    "resourceId": string;
    "resourceType": string;
    "grantee": string;
    "wrappedKey": string;
    "metadata"?: string | null;
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
    "isShared"?: boolean | null;
}

export type KeyMapping = Models.Row & {
    "resourceId": string;
    "resourceType": string;
    "grantee": string;
    "wrappedKey": string;
    "metadata"?: string | null;
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
    "isShared"?: boolean | null;
}

export type WalletsCreate = {
    "ownerId": string;
    "address": string;
    "chain": string;
    "encryptedSecret": string;
    "type": string;
    "metadata"?: string | null;
}

export type Wallets = Models.Row & {
    "ownerId": string;
    "address": string;
    "chain": string;
    "encryptedSecret": string;
    "type": string;
    "metadata"?: string | null;
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
    "isGhost"?: boolean;
    "isThread"?: boolean;
    "isPinned"?: boolean | null;
    "isChat"?: boolean;
    "creatorId"?: string | null;
    "resourceId"?: string | null;
    "resourceType"?: string | null;
    "isGuest"?: boolean;
    "isEncrypted"?: boolean;
    "isPass"?: boolean;
    "isTask"?: boolean;
    "isFile"?: boolean;
    "isTotp"?: boolean;
    "isDiscussion"?: boolean;
    "source"?: string | null;
    "keepPermission"?: boolean | null;
    "crdt"?: string | null;
    "isDeleted"?: boolean;
    "dek"?: string | null;
    "article"?: boolean | null;
    "isTrash"?: boolean;
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
    "isGhost"?: boolean;
    "isThread"?: boolean;
    "isPinned"?: boolean | null;
    "isChat"?: boolean;
    "creatorId"?: string | null;
    "resourceId"?: string | null;
    "resourceType"?: string | null;
    "isGuest"?: boolean;
    "isEncrypted"?: boolean;
    "isPass"?: boolean;
    "isTask"?: boolean;
    "isFile"?: boolean;
    "isTotp"?: boolean;
    "isDiscussion"?: boolean;
    "source"?: string | null;
    "keepPermission"?: boolean | null;
    "crdt"?: string | null;
    "isDeleted"?: boolean;
    "dek"?: string | null;
    "article"?: boolean | null;
    "isTrash"?: boolean;
}

export type CommentsCreate = {
    "noteId": string;
    "userId": string;
    "content": string;
    "createdAt": string;
    "parentCommentId"?: string | null;
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
    "isVoice"?: boolean;
    "metadata"?: string | null;
    "isEncrypted"?: boolean;
}

export type Comments = Models.Row & {
    "noteId": string;
    "userId": string;
    "content": string;
    "createdAt": string;
    "parentCommentId"?: string | null;
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
    "isVoice"?: boolean;
    "metadata"?: string | null;
    "isEncrypted"?: boolean;
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
    "isGuest"?: boolean | null;
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
    "isGuest"?: boolean | null;
}

export type ReactionsCreate = {
    "targetType": ReactionsTargetType;
    "emoji": string;
    "createdAt": string;
    "targetId": string;
    "userId": string;
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
}

export type Reactions = Models.Row & {
    "targetType": ReactionsTargetType;
    "emoji": string;
    "createdAt": string;
    "targetId": string;
    "userId": string;
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
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

export type SubscriptionsCreate = {
    "userId": string;
    "plan": SubscriptionsPlan;
    "status"?: SubscriptionsStatus | null;
    "currentPeriodStart"?: string | null;
    "currentPeriodEnd"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
    "seats"?: number;
}

export type Subscriptions = Models.Row & {
    "userId": string;
    "plan": SubscriptionsPlan;
    "status"?: SubscriptionsStatus | null;
    "currentPeriodStart"?: string | null;
    "currentPeriodEnd"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
    "seats"?: number;
}

export type BillingTransactionsCreate = {
    "paymentId": string;
    "userId": string;
    "plan": string;
    "amountUsd": string;
    "status"?: BillingTransactionsStatus;
    "provider"?: BillingTransactionsProvider;
    "couponId"?: string | null;
    "metadata"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
}

export type BillingTransactions = Models.Row & {
    "paymentId": string;
    "userId": string;
    "plan": string;
    "amountUsd": string;
    "status"?: BillingTransactionsStatus;
    "provider"?: BillingTransactionsProvider;
    "couponId"?: string | null;
    "metadata"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
}

export type BillingWebhookLogsCreate = {
    "paymentId"?: string | null;
    "provider"?: BillingWebhookLogsProvider;
    "payload": string;
    "headers"?: string | null;
    "status"?: BillingWebhookLogsStatus;
    "errorMessage"?: string | null;
    "metadata"?: string | null;
    "createdAt"?: string | null;
}

export type BillingWebhookLogs = Models.Row & {
    "paymentId"?: string | null;
    "provider"?: BillingWebhookLogsProvider;
    "payload": string;
    "headers"?: string | null;
    "status"?: BillingWebhookLogsStatus;
    "errorMessage"?: string | null;
    "metadata"?: string | null;
    "createdAt"?: string | null;
}

export type TagsCreate = {
    "name": string;
    "nameLower": string;
    "userId"?: string | null;
    "metadata"?: string | null;
    "isPublic"?: boolean;
    "isGuest"?: boolean;
    "usageCount"?: number;
    "isTrash"?: boolean;
}

export type Tags = Models.Row & {
    "name": string;
    "nameLower": string;
    "userId"?: string | null;
    "metadata"?: string | null;
    "isPublic"?: boolean;
    "isGuest"?: boolean;
    "usageCount"?: number;
    "isTrash"?: boolean;
}

export type ResourceTagsCreate = {
    "tagId": string;
    "tag": string;
    "resourceId": string;
    "resourceType": string;
    "userId"?: string | null;
    "metadata"?: string | null;
    "isPublic"?: boolean;
    "isGuest"?: boolean;
    "isPinned"?: boolean | null;
    "isDeleted"?: boolean;
}

export type ResourceTags = Models.Row & {
    "tagId": string;
    "tag": string;
    "resourceId": string;
    "resourceType": string;
    "userId"?: string | null;
    "metadata"?: string | null;
    "isPublic"?: boolean;
    "isGuest"?: boolean;
    "isPinned"?: boolean | null;
    "isDeleted"?: boolean;
}

export type CouponsCreate = {
    "status"?: CouponsStatus;
    "expiresAt"?: string | null;
    "targetUserId"?: string | null;
    "createdBy": string;
    "metadata"?: string | null;
    "note"?: string | null;
    "title"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
    "discountPercent"?: number | null;
    "discountPercentage"?: number | null;
    "redemptionLimit"?: number;
    "redemptionCount"?: number;
    "seats"?: number;
}

export type Coupons = Models.Row & {
    "status"?: CouponsStatus;
    "expiresAt"?: string | null;
    "targetUserId"?: string | null;
    "createdBy": string;
    "metadata"?: string | null;
    "note"?: string | null;
    "title"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
    "discountPercent"?: number | null;
    "discountPercentage"?: number | null;
    "redemptionLimit"?: number;
    "redemptionCount"?: number;
    "seats"?: number;
}

export type UserResourcePinsCreate = {
    "userId": string;
    "resourceType": UserResourcePinsResourceType;
    "resourceId": string;
    "pinnedAt"?: string | null;
}

export type UserResourcePins = Models.Row & {
    "userId": string;
    "resourceType": UserResourcePinsResourceType;
    "resourceId": string;
    "pinnedAt"?: string | null;
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
    "isPinned"?: boolean | null;
    "isVoice"?: boolean;
    "metadata"?: string | null;
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
    "isPinned"?: boolean | null;
    "isVoice"?: boolean;
    "metadata"?: string | null;
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
    "inviteMeta"?: string | null;
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
    "inviteMeta"?: string | null;
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

export type MomentsCreate = {
    "userId": string;
    "fileId": string;
    "type"?: MomentsType;
    "caption"?: string | null;
    "createdAt": string;
    "expiresAt": string;
    "momentKind"?: string | null;
    "sourceId"?: string | null;
    "searchTitle"?: string | null;
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
}

export type Moments = Models.Row & {
    "userId": string;
    "fileId": string;
    "type"?: MomentsType;
    "caption"?: string | null;
    "createdAt": string;
    "expiresAt": string;
    "momentKind"?: string | null;
    "sourceId"?: string | null;
    "searchTitle"?: string | null;
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
}

export type CallsCreate = {
    "userId": string;
    "type"?: CallsType;
    "title"?: string | null;
    "startsAt"?: string | null;
    "expiresAt"?: string | null;
    "metadata"?: string | null;
    "receiverId"?: string | null;
    "conversationId"?: string | null;
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
}

export type Calls = Models.Row & {
    "userId": string;
    "type"?: CallsType;
    "title"?: string | null;
    "startsAt"?: string | null;
    "expiresAt"?: string | null;
    "metadata"?: string | null;
    "receiverId"?: string | null;
    "conversationId"?: string | null;
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
}

export type EpochsCreate = {
    "resourceId": string;
    "epochNumber": number;
    "createdBy": string;
}

export type Epochs = Models.Row & {
    "resourceId": string;
    "epochNumber": number;
    "createdBy": string;
}

export type ConversationMembersCreate = {
    "conversationId": string;
    "userId": string;
}

export type ConversationMembers = Models.Row & {
    "conversationId": string;
    "userId": string;
}

export type ProfilesCreate = {
    "username": string;
    "displayName"?: string | null;
    "bio"?: string | null;
    "avatar"?: string | null;
    "walletAddress"?: string | null;
    "publicKey"?: string | null;
    "status"?: string;
    "preferences"?: string | null;
    "userId": string;
    "isPublic"?: boolean;
    "isGuest"?: boolean;
    "isAvatar"?: boolean;
    "isContact"?: boolean;
    "isOnlineVisible"?: boolean;
}

export type Profiles = Models.Row & {
    "username": string;
    "displayName"?: string | null;
    "bio"?: string | null;
    "avatar"?: string | null;
    "walletAddress"?: string | null;
    "publicKey"?: string | null;
    "status"?: string;
    "preferences"?: string | null;
    "userId": string;
    "isPublic"?: boolean;
    "isGuest"?: boolean;
    "isAvatar"?: boolean;
    "isContact"?: boolean;
    "isOnlineVisible"?: boolean;
}

export type MessageReactionsCreate = {
    "conversationId": string;
    "messageId": string;
    "userId": string;
    "emoji": string;
    "createdAt": string;
}

export type MessageReactions = Models.Row & {
    "conversationId": string;
    "messageId": string;
    "userId": string;
    "emoji": string;
    "createdAt": string;
}

export type JoinRequestsCreate = {
    "resourceType": string;
    "resourceId": string;
    "requesterId": string;
    "status"?: JoinRequestsStatus | null;
    "createdAt"?: string | null;
    "resolvedAt"?: string | null;
    "resolvedBy"?: string | null;
}

export type JoinRequests = Models.Row & {
    "resourceType": string;
    "resourceId": string;
    "requesterId": string;
    "status"?: JoinRequestsStatus | null;
    "createdAt"?: string | null;
    "resolvedAt"?: string | null;
    "resolvedBy"?: string | null;
}

export type UnorganicEmailsCreate = {
    "eventType": string;
    "sourceApp": string;
    "actorId"?: string | null;
    "recipientId"?: string | null;
    "recipientEmail"?: string | null;
    "resourceType"?: string | null;
    "resourceId"?: string | null;
    "templateKey": string;
    "priority"?: number;
    "status": UnorganicEmailsStatus;
    "dedupeKey": string;
    "attempts"?: number;
    "sentAt"?: string | null;
    "expiresAt"?: string | null;
    "processedAt"?: string | null;
    "blockedReason"?: string | null;
    "metadata"?: string | null;
}

export type UnorganicEmails = Models.Row & {
    "eventType": string;
    "sourceApp": string;
    "actorId"?: string | null;
    "recipientId"?: string | null;
    "recipientEmail"?: string | null;
    "resourceType"?: string | null;
    "resourceId"?: string | null;
    "templateKey": string;
    "priority"?: number;
    "status": UnorganicEmailsStatus;
    "dedupeKey": string;
    "attempts"?: number;
    "sentAt"?: string | null;
    "expiresAt"?: string | null;
    "processedAt"?: string | null;
    "blockedReason"?: string | null;
    "metadata"?: string | null;
}

export type KylrixTokenLedgerCreate = {
    "rowType": string;
    "txId": string;
    "idempotencyKey": string;
    "eventType"?: string | null;
    "userId"?: string | null;
    "counterpartyUserId"?: string | null;
    "amountMicro"?: string | null;
    "deltaMicro"?: string | null;
    "balanceAfterMicro"?: string | null;
    "status"?: string;
    "sourceType"?: string | null;
    "sourceId"?: string | null;
    "metadata"?: string | null;
    "createdAt": string;
    "genesisAt"?: string | null;
    "contractVersion"?: string | null;
    "maxSupplyMicro"?: string | null;
    "totalMintedMicro"?: string | null;
    "totalBurnedMicro"?: string | null;
    "circulatingMicro"?: string | null;
    "rootBalanceMicro"?: string | null;
    "riskLevel"?: string | null;
    "lastActivityAt"?: string | null;
    "lastSpikeAt"?: string | null;
    "updatedAt"?: string | null;
}

export type KylrixTokenLedger = Models.Row & {
    "rowType": string;
    "txId": string;
    "idempotencyKey": string;
    "eventType"?: string | null;
    "userId"?: string | null;
    "counterpartyUserId"?: string | null;
    "amountMicro"?: string | null;
    "deltaMicro"?: string | null;
    "balanceAfterMicro"?: string | null;
    "status"?: string;
    "sourceType"?: string | null;
    "sourceId"?: string | null;
    "metadata"?: string | null;
    "createdAt": string;
    "genesisAt"?: string | null;
    "contractVersion"?: string | null;
    "maxSupplyMicro"?: string | null;
    "totalMintedMicro"?: string | null;
    "totalBurnedMicro"?: string | null;
    "circulatingMicro"?: string | null;
    "rootBalanceMicro"?: string | null;
    "riskLevel"?: string | null;
    "lastActivityAt"?: string | null;
    "lastSpikeAt"?: string | null;
    "updatedAt"?: string | null;
}

export type EngagementViewsCreate = {
    "rowType": string;
    "eventId": string;
    "idempotencyKey": string;
    "appId": string;
    "contentType": string;
    "contentId": string;
    "ownerUserId"?: string | null;
    "viewerKind": string;
    "viewerUserId"?: string | null;
    "viewerTokenHash"?: string | null;
    "fingerprintHash"?: string | null;
    "ipHash"?: string | null;
    "uaHash"?: string | null;
    "conversationId"?: string | null;
    "messageId"?: string | null;
    "receiptType"?: string | null;
    "isCounted"?: boolean;
    "bucketDay": string;
    "bucketMonth": string;
    "occurredAt": string;
    "metadata"?: string | null;
}

export type EngagementViews = Models.Row & {
    "rowType": string;
    "eventId": string;
    "idempotencyKey": string;
    "appId": string;
    "contentType": string;
    "contentId": string;
    "ownerUserId"?: string | null;
    "viewerKind": string;
    "viewerUserId"?: string | null;
    "viewerTokenHash"?: string | null;
    "fingerprintHash"?: string | null;
    "ipHash"?: string | null;
    "uaHash"?: string | null;
    "conversationId"?: string | null;
    "messageId"?: string | null;
    "receiptType"?: string | null;
    "isCounted"?: boolean;
    "bucketDay": string;
    "bucketMonth": string;
    "occurredAt": string;
    "metadata"?: string | null;
}

export type EngagementViewRollupsCreate = {
    "rowType": string;
    "rollupKey": string;
    "metricType": string;
    "appId": string;
    "scopeType": string;
    "scopeId": string;
    "contentType"?: string | null;
    "contentId"?: string | null;
    "ownerUserId"?: string | null;
    "bucketDay": string;
    "bucketMonth": string;
    "uniqueViewCount"?: number;
    "totalViewCount"?: number;
    "receiptCount"?: number;
    "weightedScore"?: number;
    "trustScore"?: number;
    "lastEventAt"?: string | null;
    "updatedAt": string;
    "metadata"?: string | null;
}

export type EngagementViewRollups = Models.Row & {
    "rowType": string;
    "rollupKey": string;
    "metricType": string;
    "appId": string;
    "scopeType": string;
    "scopeId": string;
    "contentType"?: string | null;
    "contentId"?: string | null;
    "ownerUserId"?: string | null;
    "bucketDay": string;
    "bucketMonth": string;
    "uniqueViewCount"?: number;
    "totalViewCount"?: number;
    "receiptCount"?: number;
    "weightedScore"?: number;
    "trustScore"?: number;
    "lastEventAt"?: string | null;
    "updatedAt": string;
    "metadata"?: string | null;
}

export type AccountLedgerCreate = {
    "userId": string;
    "attentionBalance"?: number | null;
    "successTaxRate"?: number | null;
    "reputationScore"?: number | null;
    "lastPeakVelocity"?: number | null;
    "thermalCacheScore"?: number | null;
    "updatedAt"?: string | null;
}

export type AccountLedger = Models.Row & {
    "userId": string;
    "attentionBalance"?: number | null;
    "successTaxRate"?: number | null;
    "reputationScore"?: number | null;
    "lastPeakVelocity"?: number | null;
    "thermalCacheScore"?: number | null;
    "updatedAt"?: string | null;
}

export type SystemPulseCreate = {
    "metricKey": string;
    "metricValue": number;
}

export type SystemPulse = Models.Row & {
    "metricKey": string;
    "metricValue": number;
}

export type ProjectsCreate = {
    "title": string;
    "summary"?: string | null;
    "ownerId": string;
    "visibility"?: ProjectsVisibility;
    "status"?: ProjectsStatus;
    "metadata"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
    "isPinned"?: boolean | null;
    "isTrash"?: boolean;
}

export type Projects = Models.Row & {
    "title": string;
    "summary"?: string | null;
    "ownerId": string;
    "visibility"?: ProjectsVisibility;
    "status"?: ProjectsStatus;
    "metadata"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
    "isPinned"?: boolean | null;
    "isTrash"?: boolean;
}

export type ProjectObjectsCreate = {
    "projectId": string;
    "entityKind": string;
    "entityId": string;
    "role"?: string | null;
    "metadata"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
    "isGeneral"?: boolean | null;
}

export type ProjectObjects = Models.Row & {
    "projectId": string;
    "entityKind": string;
    "entityId": string;
    "role"?: string | null;
    "metadata"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
    "isGeneral"?: boolean | null;
}

export type TelegramConnectionsCreate = {
    "pair_code"?: string | null;
    "tg_chat_id"?: string | null;
    "tg_username"?: string | null;
    "is_verified": boolean;
}

export type TelegramConnections = Models.Row & {
    "pair_code"?: string | null;
    "tg_chat_id"?: string | null;
    "tg_username"?: string | null;
    "is_verified": boolean;
}

export type SourceControlCreate = {
    "projectId": string;
    "provider": string;
    "repoName"?: string | null;
    "ownerName"?: string | null;
    "accessToken"?: string | null;
    "enabled"?: boolean;
    "metadata"?: string | null;
}

export type SourceControl = Models.Row & {
    "projectId": string;
    "provider": string;
    "repoName"?: string | null;
    "ownerName"?: string | null;
    "accessToken"?: string | null;
    "enabled"?: boolean;
    "metadata"?: string | null;
}

export type CallSignalsCreate = {
    "callId": string;
    "senderId": string;
    "type": CallSignalsType;
    "payload": string;
}

export type CallSignals = Models.Row & {
    "callId": string;
    "senderId": string;
    "type": CallSignalsType;
    "payload": string;
}

export type AccountEventsCreate = {
    "type": string;
    "userId": string;
    "actorId": string;
    "relatedUserId"?: string | null;
    "status": AccountEventsStatus;
    "delta"?: string | null;
    "expiresAt"?: string | null;
    "metadata"?: string | null;
}

export type AccountEvents = Models.Row & {
    "type": string;
    "userId": string;
    "actorId": string;
    "relatedUserId"?: string | null;
    "status": AccountEventsStatus;
    "delta"?: string | null;
    "expiresAt"?: string | null;
    "metadata"?: string | null;
}

export type FocusSessionsCreate = {
    "userId": string;
    "taskId"?: string | null;
    "startTime": string;
    "endTime"?: string | null;
    "status"?: string;
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
}

export type FocusSessions = Models.Row & {
    "userId": string;
    "taskId"?: string | null;
    "startTime": string;
    "endTime"?: string | null;
    "status"?: string;
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
}

export type EventGuestsCreate = {
    "eventId": string;
    "userId"?: string | null;
    "email"?: string | null;
    "status"?: string;
    "role"?: string;
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
}

export type EventGuests = Models.Row & {
    "eventId": string;
    "userId"?: string | null;
    "email"?: string | null;
    "status"?: string;
    "role"?: string;
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
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
    "recurrenceRule"?: string | null;
    "calendarId": string;
    "userId": string;
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
    "isPinned"?: boolean | null;
    "source"?: string | null;
    "keepPermission"?: boolean | null;
    "isDeleted"?: boolean;
    "isTrash"?: boolean;
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
    "recurrenceRule"?: string | null;
    "calendarId": string;
    "userId": string;
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
    "isPinned"?: boolean | null;
    "source"?: string | null;
    "keepPermission"?: boolean | null;
    "isDeleted"?: boolean;
    "isTrash"?: boolean;
}

export type CalendarsCreate = {
    "name": string;
    "color"?: string;
    "isDefault"?: boolean;
    "userId": string;
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
    "isPinned"?: boolean | null;
}

export type Calendars = Models.Row & {
    "name": string;
    "color"?: string;
    "isDefault"?: boolean;
    "userId": string;
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
    "isPinned"?: boolean | null;
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
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
    "isPinned"?: boolean | null;
    "source"?: string | null;
    "keepPermission"?: boolean | null;
    "isArchived"?: boolean | null;
    "comments"?: string[] | null;
    "discussionId"?: string | null;
    "isDeleted"?: boolean;
    "scheduled"?: boolean;
    "isTrash"?: boolean;
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
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
    "isPinned"?: boolean | null;
    "source"?: string | null;
    "keepPermission"?: boolean | null;
    "isArchived"?: boolean | null;
    "comments"?: string[] | null;
    "discussionId"?: string | null;
    "isDeleted"?: boolean;
    "scheduled"?: boolean;
    "isTrash"?: boolean;
}

export type FormsCreate = {
    "userId": string;
    "title": string;
    "description"?: string | null;
    "schema": string;
    "settings"?: string | null;
    "status"?: FormsStatus;
    "visibility"?: FormsVisibility;
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
    "isPinned"?: boolean | null;
    "source"?: string | null;
    "keepPermission"?: boolean | null;
    "isTrash"?: boolean;
}

export type Forms = Models.Row & {
    "userId": string;
    "title": string;
    "description"?: string | null;
    "schema": string;
    "settings"?: string | null;
    "status"?: FormsStatus;
    "visibility"?: FormsVisibility;
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
    "isPinned"?: boolean | null;
    "source"?: string | null;
    "keepPermission"?: boolean | null;
    "isTrash"?: boolean;
}

export type FormSubmissionsCreate = {
    "formId": string;
    "submitterId"?: string | null;
    "payload": string;
    "status"?: FormSubmissionsStatus;
    "metadata"?: string | null;
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
    "source"?: string | null;
    "isTrash"?: boolean;
}

export type FormSubmissions = Models.Row & {
    "formId": string;
    "submitterId"?: string | null;
    "payload": string;
    "status"?: FormSubmissionsStatus;
    "metadata"?: string | null;
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
    "source"?: string | null;
    "isTrash"?: boolean;
}

export type AgentsCreate = {
    "ownerId": string;
    "parentId"?: string | null;
    "publicKey": string;
    "config": string;
    "status"?: string;
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
}

export type Agents = Models.Row & {
    "ownerId": string;
    "parentId"?: string | null;
    "publicKey": string;
    "config": string;
    "status"?: string;
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
}

export type CollaboratorsCreate = {
    "resourceId": string;
    "resourceType": string;
    "userId": string;
    "permission": CollaboratorsPermission;
    "inviterId"?: string | null;
    "status"?: CollaboratorsStatus;
    "invitedAt"?: string | null;
    "accepted"?: boolean | null;
    "expiresAt"?: string | null;
    "role"?: string | null;
    "metadata"?: string | null;
}

export type Collaborators = Models.Row & {
    "resourceId": string;
    "resourceType": string;
    "userId": string;
    "permission": CollaboratorsPermission;
    "inviterId"?: string | null;
    "status"?: CollaboratorsStatus;
    "invitedAt"?: string | null;
    "accepted"?: boolean | null;
    "expiresAt"?: string | null;
    "role"?: string | null;
    "metadata"?: string | null;
}

export type UserKeysCreate = {
    "userId": string;
    "provider": string;
    "encrypted_key": string;
    "iv": string;
    "config"?: string | null;
}

export type UserKeys = Models.Row & {
    "userId": string;
    "provider": string;
    "encrypted_key": string;
    "iv": string;
    "config"?: string | null;
}

export type ComputeBalancesCreate = {
    "userId": string;
    "tier": string;
    "lastResetAt"?: string | null;
    "balance"?: number;
}

export type ComputeBalances = Models.Row & {
    "userId": string;
    "tier": string;
    "lastResetAt"?: string | null;
    "balance"?: number;
}

export type ComputeLedgerCreate = {
    "userId": string;
    "timestamp": string;
    "tokensConsumed"?: number;
}

export type ComputeLedger = Models.Row & {
    "userId": string;
    "timestamp": string;
    "tokensConsumed"?: number;
}

export type ActionThreadsCreate = {
    "threadId": string;
    "parentThreadId"?: string | null;
    "niche": string;
    "app": string;
    "status"?: ActionThreadsStatus;
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
}

export type ActionThreads = Models.Row & {
    "threadId": string;
    "parentThreadId"?: string | null;
    "niche": string;
    "app": string;
    "status"?: ActionThreadsStatus;
    "isPublic"?: boolean | null;
    "isGuest"?: boolean | null;
}

export type AppActivityLogsCreate = {
    "userId": string;
    "niche": string;
    "app": string;
    "action": string;
    "threadId"?: string | null;
    "metadata"?: string | null;
}

export type AppActivityLogs = Models.Row & {
    "userId": string;
    "niche": string;
    "app": string;
    "action": string;
    "threadId"?: string | null;
    "metadata"?: string | null;
}

export type AnonymizedTelemetryCreate = {
    "niche": string;
    "app": string;
    "action": string;
    "intent"?: string | null;
    "threadId"?: string | null;
    "metadata"?: string | null;
}

export type AnonymizedTelemetry = Models.Row & {
    "niche": string;
    "app": string;
    "action": string;
    "intent"?: string | null;
    "threadId"?: string | null;
    "metadata"?: string | null;
}

export type NotificationsCreate = {
    "originatorId": string;
    "targets": string[];
    "targetPointer"?: string | null;
    "type"?: NotificationsType;
    "metadata"?: string | null;
}

export type Notifications = Models.Row & {
    "originatorId": string;
    "targets": string[];
    "targetPointer"?: string | null;
    "type"?: NotificationsType;
    "metadata"?: string | null;
}

export type WorkflowsCreate = {
    "workflowId": string;
    "name": string;
    "description"?: string | null;
    "niche": string;
    "isPublic"?: boolean;
    "isAnonymized"?: boolean;
    "steps": string;
    "metadata"?: string | null;
    "isGuest"?: boolean | null;
}

export type Workflows = Models.Row & {
    "workflowId": string;
    "name": string;
    "description"?: string | null;
    "niche": string;
    "isPublic"?: boolean;
    "isAnonymized"?: boolean;
    "steps": string;
    "metadata"?: string | null;
    "isGuest"?: boolean | null;
}

export type ObjectsCreate = {
    "parentId": string;
    "parentKind": string;
    "childId": string;
    "childKind": string;
    "metadata"?: string | null;
    "userId": string;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
    "isPublic"?: boolean;
    "isGuest"?: boolean;
    "isGeneral"?: boolean;
}

export type Objects = Models.Row & {
    "parentId": string;
    "parentKind": string;
    "childId": string;
    "childKind": string;
    "metadata"?: string | null;
    "userId": string;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
    "isPublic"?: boolean;
    "isGuest"?: boolean;
    "isGeneral"?: boolean;
}

export type TokenRegistryCreate = {
    "chain": string;
    "address": string;
    "symbol": string;
    "decimals": number;
    "iconUrl"?: string | null;
}

export type TokenRegistry = Models.Row & {
    "chain": string;
    "address": string;
    "symbol": string;
    "decimals": number;
    "iconUrl"?: string | null;
}

export type Web3TransactionsCreate = {
    "userId": string;
    "chain": string;
    "hash": string;
    "from": string;
    "to": string;
    "value": string;
    "symbol": string;
    "timestamp": number;
}

export type Web3Transactions = Models.Row & {
    "userId": string;
    "chain": string;
    "hash": string;
    "from": string;
    "to": string;
    "value": string;
    "symbol": string;
    "timestamp": number;
}

export type NostrIdentitiesCreate = {
    "userId": string;
    "npub": string;
    "encryptedNsec": string;
    "iv": string;
    "salt": string;
}

export type NostrIdentities = Models.Row & {
    "userId": string;
    "npub": string;
    "encryptedNsec": string;
    "iv": string;
    "salt": string;
}

export type AgentPaymentIntentsCreate = {
    "userId": string;
    "agentId": string;
    "status": string;
    "txHash"?: string | null;
    "payload"?: string | null;
    "chainId": number;
    "amount": number;
}

export type AgentPaymentIntents = Models.Row & {
    "userId": string;
    "agentId": string;
    "status": string;
    "txHash"?: string | null;
    "payload"?: string | null;
    "chainId": number;
    "amount": number;
}

export type AgenticTelemetryCreate = {
    "userId"?: string | null;
    "action": string;
    "zone"?: string | null;
    "pointers"?: string | null;
    "metadata"?: string | null;
    "timestamp": string;
}

export type AgenticTelemetry = Models.Row & {
    "userId"?: string | null;
    "action": string;
    "zone"?: string | null;
    "pointers"?: string | null;
    "metadata"?: string | null;
    "timestamp": string;
}

export type AgenticSessionsCreate = {
    "userId": string;
    "context"?: string | null;
    "seen"?: boolean;
    "chatHistory"?: string | null;
    "isMemory"?: boolean;
}

export type AgenticSessions = Models.Row & {
    "userId": string;
    "context"?: string | null;
    "seen"?: boolean;
    "chatHistory"?: string | null;
    "isMemory"?: boolean;
}

export type SweptCreate = {
    "userId": string;
    "projectId": string;
    "enabled"?: boolean;
    "scopeType"?: string;
    "anchorKind"?: string;
    "anchors"?: string | null;
    "policy"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
}

export type Swept = Models.Row & {
    "userId": string;
    "projectId": string;
    "enabled"?: boolean;
    "scopeType"?: string;
    "anchorKind"?: string;
    "anchors"?: string | null;
    "policy"?: string | null;
    "createdAt"?: string | null;
    "updatedAt"?: string | null;
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

export type QueryableFieldValue<T, K> = K extends keyof T
  ? ExtractQueryValue<T[K]>
  : never;

export type QueryBuilder<T> = {
  equal: <K extends QueryableKeys<T>>(field: K, value: QueryableFieldValue<T, K>) => string;
  notEqual: <K extends QueryableKeys<T>>(field: K, value: QueryableFieldValue<T, K>) => string;
  lessThan: <K extends QueryableKeys<T>>(field: K, value: QueryableFieldValue<T, K>) => string;
  lessThanEqual: <K extends QueryableKeys<T>>(field: K, value: QueryableFieldValue<T, K>) => string;
  greaterThan: <K extends QueryableKeys<T>>(field: K, value: QueryableFieldValue<T, K>) => string;
  greaterThanEqual: <K extends QueryableKeys<T>>(field: K, value: QueryableFieldValue<T, K>) => string;
  contains: <K extends QueryableKeys<T>>(field: K, value: QueryableFieldValue<T, K>) => string;
  search: <K extends QueryableKeys<T>>(field: K, value: string) => string;
  isNull: <K extends QueryableKeys<T>>(field: K) => string;
  isNotNull: <K extends QueryableKeys<T>>(field: K) => string;
  startsWith: <K extends QueryableKeys<T>>(field: K, value: string) => string;
  endsWith: <K extends QueryableKeys<T>>(field: K, value: string) => string;
  between: <K extends QueryableKeys<T>>(field: K, start: QueryableFieldValue<T, K>, end: QueryableFieldValue<T, K>) => string;
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

export type DatabaseId = "passwordManagerDb";

export type DatabaseTableMap = {
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<SecurityLogs>>(field: K, value: QueryableFieldValue<SecurityLogs, K>) => string; notEqual: <K extends QueryableKeys<SecurityLogs>>(field: K, value: QueryableFieldValue<SecurityLogs, K>) => string; lessThan: <K extends QueryableKeys<SecurityLogs>>(field: K, value: QueryableFieldValue<SecurityLogs, K>) => string; lessThanEqual: <K extends QueryableKeys<SecurityLogs>>(field: K, value: QueryableFieldValue<SecurityLogs, K>) => string; greaterThan: <K extends QueryableKeys<SecurityLogs>>(field: K, value: QueryableFieldValue<SecurityLogs, K>) => string; greaterThanEqual: <K extends QueryableKeys<SecurityLogs>>(field: K, value: QueryableFieldValue<SecurityLogs, K>) => string; contains: <K extends QueryableKeys<SecurityLogs>>(field: K, value: QueryableFieldValue<SecurityLogs, K>) => string; search: <K extends QueryableKeys<SecurityLogs>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<SecurityLogs>>(field: K) => string; isNotNull: <K extends QueryableKeys<SecurityLogs>>(field: K) => string; startsWith: <K extends QueryableKeys<SecurityLogs>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<SecurityLogs>>(field: K, value: string) => string; between: <K extends QueryableKeys<SecurityLogs>>(field: K, start: QueryableFieldValue<SecurityLogs, K>, end: QueryableFieldValue<SecurityLogs, K>) => string; select: <K extends keyof SecurityLogs>(fields: K[]) => string; orderAsc: <K extends keyof SecurityLogs>(field: K) => string; orderDesc: <K extends keyof SecurityLogs>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: SecurityLogs[] }>;
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
        "sharedFrom"?: string | null;
        "attachments"?: string | null;
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
        "isShared"?: boolean | null;
        "isPinned"?: boolean | null;
        "source"?: string | null;
        "dek"?: string | null;
        "keepPermission"?: boolean | null;
        "isTrash"?: boolean;
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
        "sharedFrom"?: string | null;
        "attachments"?: string | null;
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
        "isShared"?: boolean | null;
        "isPinned"?: boolean | null;
        "source"?: string | null;
        "dek"?: string | null;
        "keepPermission"?: boolean | null;
        "isTrash"?: boolean;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Credentials>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Credentials>>(field: K, value: QueryableFieldValue<Credentials, K>) => string; notEqual: <K extends QueryableKeys<Credentials>>(field: K, value: QueryableFieldValue<Credentials, K>) => string; lessThan: <K extends QueryableKeys<Credentials>>(field: K, value: QueryableFieldValue<Credentials, K>) => string; lessThanEqual: <K extends QueryableKeys<Credentials>>(field: K, value: QueryableFieldValue<Credentials, K>) => string; greaterThan: <K extends QueryableKeys<Credentials>>(field: K, value: QueryableFieldValue<Credentials, K>) => string; greaterThanEqual: <K extends QueryableKeys<Credentials>>(field: K, value: QueryableFieldValue<Credentials, K>) => string; contains: <K extends QueryableKeys<Credentials>>(field: K, value: QueryableFieldValue<Credentials, K>) => string; search: <K extends QueryableKeys<Credentials>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Credentials>>(field: K) => string; isNotNull: <K extends QueryableKeys<Credentials>>(field: K) => string; startsWith: <K extends QueryableKeys<Credentials>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Credentials>>(field: K, value: string) => string; between: <K extends QueryableKeys<Credentials>>(field: K, start: QueryableFieldValue<Credentials, K>, end: QueryableFieldValue<Credentials, K>) => string; select: <K extends keyof Credentials>(fields: K[]) => string; orderAsc: <K extends keyof Credentials>(field: K) => string; orderDesc: <K extends keyof Credentials>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Credentials[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Identities>>(field: K, value: QueryableFieldValue<Identities, K>) => string; notEqual: <K extends QueryableKeys<Identities>>(field: K, value: QueryableFieldValue<Identities, K>) => string; lessThan: <K extends QueryableKeys<Identities>>(field: K, value: QueryableFieldValue<Identities, K>) => string; lessThanEqual: <K extends QueryableKeys<Identities>>(field: K, value: QueryableFieldValue<Identities, K>) => string; greaterThan: <K extends QueryableKeys<Identities>>(field: K, value: QueryableFieldValue<Identities, K>) => string; greaterThanEqual: <K extends QueryableKeys<Identities>>(field: K, value: QueryableFieldValue<Identities, K>) => string; contains: <K extends QueryableKeys<Identities>>(field: K, value: QueryableFieldValue<Identities, K>) => string; search: <K extends QueryableKeys<Identities>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Identities>>(field: K) => string; isNotNull: <K extends QueryableKeys<Identities>>(field: K) => string; startsWith: <K extends QueryableKeys<Identities>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Identities>>(field: K, value: string) => string; between: <K extends QueryableKeys<Identities>>(field: K, start: QueryableFieldValue<Identities, K>, end: QueryableFieldValue<Identities, K>) => string; select: <K extends keyof Identities>(fields: K[]) => string; orderAsc: <K extends keyof Identities>(field: K) => string; orderDesc: <K extends keyof Identities>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Identities[] }>;
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
        "passkey_reminder_at"?: string | null;
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
        "passkey_reminder_at"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<User>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<User>>(field: K, value: QueryableFieldValue<User, K>) => string; notEqual: <K extends QueryableKeys<User>>(field: K, value: QueryableFieldValue<User, K>) => string; lessThan: <K extends QueryableKeys<User>>(field: K, value: QueryableFieldValue<User, K>) => string; lessThanEqual: <K extends QueryableKeys<User>>(field: K, value: QueryableFieldValue<User, K>) => string; greaterThan: <K extends QueryableKeys<User>>(field: K, value: QueryableFieldValue<User, K>) => string; greaterThanEqual: <K extends QueryableKeys<User>>(field: K, value: QueryableFieldValue<User, K>) => string; contains: <K extends QueryableKeys<User>>(field: K, value: QueryableFieldValue<User, K>) => string; search: <K extends QueryableKeys<User>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<User>>(field: K) => string; isNotNull: <K extends QueryableKeys<User>>(field: K) => string; startsWith: <K extends QueryableKeys<User>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<User>>(field: K, value: string) => string; between: <K extends QueryableKeys<User>>(field: K, start: QueryableFieldValue<User, K>, end: QueryableFieldValue<User, K>) => string; select: <K extends keyof User>(fields: K[]) => string; orderAsc: <K extends keyof User>(field: K) => string; orderDesc: <K extends keyof User>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: User[] }>;
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
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
        "isShared"?: boolean | null;
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
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
        "isShared"?: boolean | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Folders>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Folders>>(field: K, value: QueryableFieldValue<Folders, K>) => string; notEqual: <K extends QueryableKeys<Folders>>(field: K, value: QueryableFieldValue<Folders, K>) => string; lessThan: <K extends QueryableKeys<Folders>>(field: K, value: QueryableFieldValue<Folders, K>) => string; lessThanEqual: <K extends QueryableKeys<Folders>>(field: K, value: QueryableFieldValue<Folders, K>) => string; greaterThan: <K extends QueryableKeys<Folders>>(field: K, value: QueryableFieldValue<Folders, K>) => string; greaterThanEqual: <K extends QueryableKeys<Folders>>(field: K, value: QueryableFieldValue<Folders, K>) => string; contains: <K extends QueryableKeys<Folders>>(field: K, value: QueryableFieldValue<Folders, K>) => string; search: <K extends QueryableKeys<Folders>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Folders>>(field: K) => string; isNotNull: <K extends QueryableKeys<Folders>>(field: K) => string; startsWith: <K extends QueryableKeys<Folders>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Folders>>(field: K, value: string) => string; between: <K extends QueryableKeys<Folders>>(field: K, start: QueryableFieldValue<Folders, K>, end: QueryableFieldValue<Folders, K>) => string; select: <K extends keyof Folders>(fields: K[]) => string; orderAsc: <K extends keyof Folders>(field: K) => string; orderDesc: <K extends keyof Folders>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Folders[] }>;
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
        "sharedFrom"?: string | null;
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
        "isShared"?: boolean | null;
        "isPinned"?: boolean | null;
        "source"?: string | null;
        "dek"?: string | null;
        "keepPermission"?: boolean | null;
        "isTrash"?: boolean;
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
        "sharedFrom"?: string | null;
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
        "isShared"?: boolean | null;
        "isPinned"?: boolean | null;
        "source"?: string | null;
        "dek"?: string | null;
        "keepPermission"?: boolean | null;
        "isTrash"?: boolean;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<TotpSecrets>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<TotpSecrets>>(field: K, value: QueryableFieldValue<TotpSecrets, K>) => string; notEqual: <K extends QueryableKeys<TotpSecrets>>(field: K, value: QueryableFieldValue<TotpSecrets, K>) => string; lessThan: <K extends QueryableKeys<TotpSecrets>>(field: K, value: QueryableFieldValue<TotpSecrets, K>) => string; lessThanEqual: <K extends QueryableKeys<TotpSecrets>>(field: K, value: QueryableFieldValue<TotpSecrets, K>) => string; greaterThan: <K extends QueryableKeys<TotpSecrets>>(field: K, value: QueryableFieldValue<TotpSecrets, K>) => string; greaterThanEqual: <K extends QueryableKeys<TotpSecrets>>(field: K, value: QueryableFieldValue<TotpSecrets, K>) => string; contains: <K extends QueryableKeys<TotpSecrets>>(field: K, value: QueryableFieldValue<TotpSecrets, K>) => string; search: <K extends QueryableKeys<TotpSecrets>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<TotpSecrets>>(field: K) => string; isNotNull: <K extends QueryableKeys<TotpSecrets>>(field: K) => string; startsWith: <K extends QueryableKeys<TotpSecrets>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<TotpSecrets>>(field: K, value: string) => string; between: <K extends QueryableKeys<TotpSecrets>>(field: K, start: QueryableFieldValue<TotpSecrets, K>, end: QueryableFieldValue<TotpSecrets, K>) => string; select: <K extends keyof TotpSecrets>(fields: K[]) => string; orderAsc: <K extends keyof TotpSecrets>(field: K) => string; orderDesc: <K extends keyof TotpSecrets>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: TotpSecrets[] }>;
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
        "isArgon"?: boolean;
        "isPending"?: boolean;
        "totpId"?: string;
        "authPass"?: boolean;
        "publicKey"?: string | null;
        "authPasskey"?: boolean;
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
        "isArgon"?: boolean;
        "isPending"?: boolean;
        "totpId"?: string;
        "authPass"?: boolean;
        "publicKey"?: string | null;
        "authPasskey"?: boolean;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Keychain>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Keychain>>(field: K, value: QueryableFieldValue<Keychain, K>) => string; notEqual: <K extends QueryableKeys<Keychain>>(field: K, value: QueryableFieldValue<Keychain, K>) => string; lessThan: <K extends QueryableKeys<Keychain>>(field: K, value: QueryableFieldValue<Keychain, K>) => string; lessThanEqual: <K extends QueryableKeys<Keychain>>(field: K, value: QueryableFieldValue<Keychain, K>) => string; greaterThan: <K extends QueryableKeys<Keychain>>(field: K, value: QueryableFieldValue<Keychain, K>) => string; greaterThanEqual: <K extends QueryableKeys<Keychain>>(field: K, value: QueryableFieldValue<Keychain, K>) => string; contains: <K extends QueryableKeys<Keychain>>(field: K, value: QueryableFieldValue<Keychain, K>) => string; search: <K extends QueryableKeys<Keychain>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Keychain>>(field: K) => string; isNotNull: <K extends QueryableKeys<Keychain>>(field: K) => string; startsWith: <K extends QueryableKeys<Keychain>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Keychain>>(field: K, value: string) => string; between: <K extends QueryableKeys<Keychain>>(field: K, start: QueryableFieldValue<Keychain, K>, end: QueryableFieldValue<Keychain, K>) => string; select: <K extends keyof Keychain>(fields: K[]) => string; orderAsc: <K extends keyof Keychain>(field: K) => string; orderDesc: <K extends keyof Keychain>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Keychain[] }>;
    };
    "key_mapping": {
      create: (data: {
        "resourceId": string;
        "resourceType": string;
        "grantee": string;
        "wrappedKey": string;
        "metadata"?: string | null;
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
        "isShared"?: boolean | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<KeyMapping>;
      get: (id: string) => Promise<KeyMapping>;
      update: (id: string, data: Partial<{
        "resourceId": string;
        "resourceType": string;
        "grantee": string;
        "wrappedKey": string;
        "metadata"?: string | null;
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
        "isShared"?: boolean | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<KeyMapping>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<KeyMapping>>(field: K, value: QueryableFieldValue<KeyMapping, K>) => string; notEqual: <K extends QueryableKeys<KeyMapping>>(field: K, value: QueryableFieldValue<KeyMapping, K>) => string; lessThan: <K extends QueryableKeys<KeyMapping>>(field: K, value: QueryableFieldValue<KeyMapping, K>) => string; lessThanEqual: <K extends QueryableKeys<KeyMapping>>(field: K, value: QueryableFieldValue<KeyMapping, K>) => string; greaterThan: <K extends QueryableKeys<KeyMapping>>(field: K, value: QueryableFieldValue<KeyMapping, K>) => string; greaterThanEqual: <K extends QueryableKeys<KeyMapping>>(field: K, value: QueryableFieldValue<KeyMapping, K>) => string; contains: <K extends QueryableKeys<KeyMapping>>(field: K, value: QueryableFieldValue<KeyMapping, K>) => string; search: <K extends QueryableKeys<KeyMapping>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<KeyMapping>>(field: K) => string; isNotNull: <K extends QueryableKeys<KeyMapping>>(field: K) => string; startsWith: <K extends QueryableKeys<KeyMapping>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<KeyMapping>>(field: K, value: string) => string; between: <K extends QueryableKeys<KeyMapping>>(field: K, start: QueryableFieldValue<KeyMapping, K>, end: QueryableFieldValue<KeyMapping, K>) => string; select: <K extends keyof KeyMapping>(fields: K[]) => string; orderAsc: <K extends keyof KeyMapping>(field: K) => string; orderDesc: <K extends keyof KeyMapping>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: KeyMapping[] }>;
    };
    "wallets": {
      create: (data: {
        "ownerId": string;
        "address": string;
        "chain": string;
        "encryptedSecret": string;
        "type": string;
        "metadata"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Wallets>;
      get: (id: string) => Promise<Wallets>;
      update: (id: string, data: Partial<{
        "ownerId": string;
        "address": string;
        "chain": string;
        "encryptedSecret": string;
        "type": string;
        "metadata"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Wallets>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Wallets>>(field: K, value: QueryableFieldValue<Wallets, K>) => string; notEqual: <K extends QueryableKeys<Wallets>>(field: K, value: QueryableFieldValue<Wallets, K>) => string; lessThan: <K extends QueryableKeys<Wallets>>(field: K, value: QueryableFieldValue<Wallets, K>) => string; lessThanEqual: <K extends QueryableKeys<Wallets>>(field: K, value: QueryableFieldValue<Wallets, K>) => string; greaterThan: <K extends QueryableKeys<Wallets>>(field: K, value: QueryableFieldValue<Wallets, K>) => string; greaterThanEqual: <K extends QueryableKeys<Wallets>>(field: K, value: QueryableFieldValue<Wallets, K>) => string; contains: <K extends QueryableKeys<Wallets>>(field: K, value: QueryableFieldValue<Wallets, K>) => string; search: <K extends QueryableKeys<Wallets>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Wallets>>(field: K) => string; isNotNull: <K extends QueryableKeys<Wallets>>(field: K) => string; startsWith: <K extends QueryableKeys<Wallets>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Wallets>>(field: K, value: string) => string; between: <K extends QueryableKeys<Wallets>>(field: K, start: QueryableFieldValue<Wallets, K>, end: QueryableFieldValue<Wallets, K>) => string; select: <K extends keyof Wallets>(fields: K[]) => string; orderAsc: <K extends keyof Wallets>(field: K) => string; orderDesc: <K extends keyof Wallets>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Wallets[] }>;
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
        "isGhost"?: boolean;
        "isThread"?: boolean;
        "isPinned"?: boolean | null;
        "isChat"?: boolean;
        "creatorId"?: string | null;
        "resourceId"?: string | null;
        "resourceType"?: string | null;
        "isGuest"?: boolean;
        "isEncrypted"?: boolean;
        "isPass"?: boolean;
        "isTask"?: boolean;
        "isFile"?: boolean;
        "isTotp"?: boolean;
        "isDiscussion"?: boolean;
        "source"?: string | null;
        "keepPermission"?: boolean | null;
        "crdt"?: string | null;
        "isDeleted"?: boolean;
        "dek"?: string | null;
        "article"?: boolean | null;
        "isTrash"?: boolean;
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
        "isGhost"?: boolean;
        "isThread"?: boolean;
        "isPinned"?: boolean | null;
        "isChat"?: boolean;
        "creatorId"?: string | null;
        "resourceId"?: string | null;
        "resourceType"?: string | null;
        "isGuest"?: boolean;
        "isEncrypted"?: boolean;
        "isPass"?: boolean;
        "isTask"?: boolean;
        "isFile"?: boolean;
        "isTotp"?: boolean;
        "isDiscussion"?: boolean;
        "source"?: string | null;
        "keepPermission"?: boolean | null;
        "crdt"?: string | null;
        "isDeleted"?: boolean;
        "dek"?: string | null;
        "article"?: boolean | null;
        "isTrash"?: boolean;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Notes>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Notes>>(field: K, value: QueryableFieldValue<Notes, K>) => string; notEqual: <K extends QueryableKeys<Notes>>(field: K, value: QueryableFieldValue<Notes, K>) => string; lessThan: <K extends QueryableKeys<Notes>>(field: K, value: QueryableFieldValue<Notes, K>) => string; lessThanEqual: <K extends QueryableKeys<Notes>>(field: K, value: QueryableFieldValue<Notes, K>) => string; greaterThan: <K extends QueryableKeys<Notes>>(field: K, value: QueryableFieldValue<Notes, K>) => string; greaterThanEqual: <K extends QueryableKeys<Notes>>(field: K, value: QueryableFieldValue<Notes, K>) => string; contains: <K extends QueryableKeys<Notes>>(field: K, value: QueryableFieldValue<Notes, K>) => string; search: <K extends QueryableKeys<Notes>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Notes>>(field: K) => string; isNotNull: <K extends QueryableKeys<Notes>>(field: K) => string; startsWith: <K extends QueryableKeys<Notes>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Notes>>(field: K, value: string) => string; between: <K extends QueryableKeys<Notes>>(field: K, start: QueryableFieldValue<Notes, K>, end: QueryableFieldValue<Notes, K>) => string; select: <K extends keyof Notes>(fields: K[]) => string; orderAsc: <K extends keyof Notes>(field: K) => string; orderDesc: <K extends keyof Notes>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Notes[] }>;
    };
    "Comments": {
      create: (data: {
        "noteId": string;
        "userId": string;
        "content": string;
        "createdAt": string;
        "parentCommentId"?: string | null;
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
        "isVoice"?: boolean;
        "metadata"?: string | null;
        "isEncrypted"?: boolean;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Comments>;
      get: (id: string) => Promise<Comments>;
      update: (id: string, data: Partial<{
        "noteId": string;
        "userId": string;
        "content": string;
        "createdAt": string;
        "parentCommentId"?: string | null;
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
        "isVoice"?: boolean;
        "metadata"?: string | null;
        "isEncrypted"?: boolean;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Comments>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Comments>>(field: K, value: QueryableFieldValue<Comments, K>) => string; notEqual: <K extends QueryableKeys<Comments>>(field: K, value: QueryableFieldValue<Comments, K>) => string; lessThan: <K extends QueryableKeys<Comments>>(field: K, value: QueryableFieldValue<Comments, K>) => string; lessThanEqual: <K extends QueryableKeys<Comments>>(field: K, value: QueryableFieldValue<Comments, K>) => string; greaterThan: <K extends QueryableKeys<Comments>>(field: K, value: QueryableFieldValue<Comments, K>) => string; greaterThanEqual: <K extends QueryableKeys<Comments>>(field: K, value: QueryableFieldValue<Comments, K>) => string; contains: <K extends QueryableKeys<Comments>>(field: K, value: QueryableFieldValue<Comments, K>) => string; search: <K extends QueryableKeys<Comments>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Comments>>(field: K) => string; isNotNull: <K extends QueryableKeys<Comments>>(field: K) => string; startsWith: <K extends QueryableKeys<Comments>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Comments>>(field: K, value: string) => string; between: <K extends QueryableKeys<Comments>>(field: K, start: QueryableFieldValue<Comments, K>, end: QueryableFieldValue<Comments, K>) => string; select: <K extends keyof Comments>(fields: K[]) => string; orderAsc: <K extends keyof Comments>(field: K) => string; orderDesc: <K extends keyof Comments>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Comments[] }>;
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
        "isGuest"?: boolean | null;
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
        "isGuest"?: boolean | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Extensions>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Extensions>>(field: K, value: QueryableFieldValue<Extensions, K>) => string; notEqual: <K extends QueryableKeys<Extensions>>(field: K, value: QueryableFieldValue<Extensions, K>) => string; lessThan: <K extends QueryableKeys<Extensions>>(field: K, value: QueryableFieldValue<Extensions, K>) => string; lessThanEqual: <K extends QueryableKeys<Extensions>>(field: K, value: QueryableFieldValue<Extensions, K>) => string; greaterThan: <K extends QueryableKeys<Extensions>>(field: K, value: QueryableFieldValue<Extensions, K>) => string; greaterThanEqual: <K extends QueryableKeys<Extensions>>(field: K, value: QueryableFieldValue<Extensions, K>) => string; contains: <K extends QueryableKeys<Extensions>>(field: K, value: QueryableFieldValue<Extensions, K>) => string; search: <K extends QueryableKeys<Extensions>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Extensions>>(field: K) => string; isNotNull: <K extends QueryableKeys<Extensions>>(field: K) => string; startsWith: <K extends QueryableKeys<Extensions>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Extensions>>(field: K, value: string) => string; between: <K extends QueryableKeys<Extensions>>(field: K, start: QueryableFieldValue<Extensions, K>, end: QueryableFieldValue<Extensions, K>) => string; select: <K extends keyof Extensions>(fields: K[]) => string; orderAsc: <K extends keyof Extensions>(field: K) => string; orderDesc: <K extends keyof Extensions>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Extensions[] }>;
    };
    "Reactions": {
      create: (data: {
        "targetType": ReactionsTargetType;
        "emoji": string;
        "createdAt": string;
        "targetId": string;
        "userId": string;
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Reactions>;
      get: (id: string) => Promise<Reactions>;
      update: (id: string, data: Partial<{
        "targetType": ReactionsTargetType;
        "emoji": string;
        "createdAt": string;
        "targetId": string;
        "userId": string;
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Reactions>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Reactions>>(field: K, value: QueryableFieldValue<Reactions, K>) => string; notEqual: <K extends QueryableKeys<Reactions>>(field: K, value: QueryableFieldValue<Reactions, K>) => string; lessThan: <K extends QueryableKeys<Reactions>>(field: K, value: QueryableFieldValue<Reactions, K>) => string; lessThanEqual: <K extends QueryableKeys<Reactions>>(field: K, value: QueryableFieldValue<Reactions, K>) => string; greaterThan: <K extends QueryableKeys<Reactions>>(field: K, value: QueryableFieldValue<Reactions, K>) => string; greaterThanEqual: <K extends QueryableKeys<Reactions>>(field: K, value: QueryableFieldValue<Reactions, K>) => string; contains: <K extends QueryableKeys<Reactions>>(field: K, value: QueryableFieldValue<Reactions, K>) => string; search: <K extends QueryableKeys<Reactions>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Reactions>>(field: K) => string; isNotNull: <K extends QueryableKeys<Reactions>>(field: K) => string; startsWith: <K extends QueryableKeys<Reactions>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Reactions>>(field: K, value: string) => string; between: <K extends QueryableKeys<Reactions>>(field: K, start: QueryableFieldValue<Reactions, K>, end: QueryableFieldValue<Reactions, K>) => string; select: <K extends keyof Reactions>(fields: K[]) => string; orderAsc: <K extends keyof Reactions>(field: K) => string; orderDesc: <K extends keyof Reactions>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Reactions[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<ActivityLog>>(field: K, value: QueryableFieldValue<ActivityLog, K>) => string; notEqual: <K extends QueryableKeys<ActivityLog>>(field: K, value: QueryableFieldValue<ActivityLog, K>) => string; lessThan: <K extends QueryableKeys<ActivityLog>>(field: K, value: QueryableFieldValue<ActivityLog, K>) => string; lessThanEqual: <K extends QueryableKeys<ActivityLog>>(field: K, value: QueryableFieldValue<ActivityLog, K>) => string; greaterThan: <K extends QueryableKeys<ActivityLog>>(field: K, value: QueryableFieldValue<ActivityLog, K>) => string; greaterThanEqual: <K extends QueryableKeys<ActivityLog>>(field: K, value: QueryableFieldValue<ActivityLog, K>) => string; contains: <K extends QueryableKeys<ActivityLog>>(field: K, value: QueryableFieldValue<ActivityLog, K>) => string; search: <K extends QueryableKeys<ActivityLog>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<ActivityLog>>(field: K) => string; isNotNull: <K extends QueryableKeys<ActivityLog>>(field: K) => string; startsWith: <K extends QueryableKeys<ActivityLog>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<ActivityLog>>(field: K, value: string) => string; between: <K extends QueryableKeys<ActivityLog>>(field: K, start: QueryableFieldValue<ActivityLog, K>, end: QueryableFieldValue<ActivityLog, K>) => string; select: <K extends keyof ActivityLog>(fields: K[]) => string; orderAsc: <K extends keyof ActivityLog>(field: K) => string; orderDesc: <K extends keyof ActivityLog>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: ActivityLog[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Settings>>(field: K, value: QueryableFieldValue<Settings, K>) => string; notEqual: <K extends QueryableKeys<Settings>>(field: K, value: QueryableFieldValue<Settings, K>) => string; lessThan: <K extends QueryableKeys<Settings>>(field: K, value: QueryableFieldValue<Settings, K>) => string; lessThanEqual: <K extends QueryableKeys<Settings>>(field: K, value: QueryableFieldValue<Settings, K>) => string; greaterThan: <K extends QueryableKeys<Settings>>(field: K, value: QueryableFieldValue<Settings, K>) => string; greaterThanEqual: <K extends QueryableKeys<Settings>>(field: K, value: QueryableFieldValue<Settings, K>) => string; contains: <K extends QueryableKeys<Settings>>(field: K, value: QueryableFieldValue<Settings, K>) => string; search: <K extends QueryableKeys<Settings>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Settings>>(field: K) => string; isNotNull: <K extends QueryableKeys<Settings>>(field: K) => string; startsWith: <K extends QueryableKeys<Settings>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Settings>>(field: K, value: string) => string; between: <K extends QueryableKeys<Settings>>(field: K, start: QueryableFieldValue<Settings, K>, end: QueryableFieldValue<Settings, K>) => string; select: <K extends keyof Settings>(fields: K[]) => string; orderAsc: <K extends keyof Settings>(field: K) => string; orderDesc: <K extends keyof Settings>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Settings[] }>;
    };
    "subscriptions": {
      create: (data: {
        "userId": string;
        "plan": SubscriptionsPlan;
        "status"?: SubscriptionsStatus | null;
        "currentPeriodStart"?: string | null;
        "currentPeriodEnd"?: string | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
        "seats"?: number;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Subscriptions>;
      get: (id: string) => Promise<Subscriptions>;
      update: (id: string, data: Partial<{
        "userId": string;
        "plan": SubscriptionsPlan;
        "status"?: SubscriptionsStatus | null;
        "currentPeriodStart"?: string | null;
        "currentPeriodEnd"?: string | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
        "seats"?: number;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Subscriptions>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Subscriptions>>(field: K, value: QueryableFieldValue<Subscriptions, K>) => string; notEqual: <K extends QueryableKeys<Subscriptions>>(field: K, value: QueryableFieldValue<Subscriptions, K>) => string; lessThan: <K extends QueryableKeys<Subscriptions>>(field: K, value: QueryableFieldValue<Subscriptions, K>) => string; lessThanEqual: <K extends QueryableKeys<Subscriptions>>(field: K, value: QueryableFieldValue<Subscriptions, K>) => string; greaterThan: <K extends QueryableKeys<Subscriptions>>(field: K, value: QueryableFieldValue<Subscriptions, K>) => string; greaterThanEqual: <K extends QueryableKeys<Subscriptions>>(field: K, value: QueryableFieldValue<Subscriptions, K>) => string; contains: <K extends QueryableKeys<Subscriptions>>(field: K, value: QueryableFieldValue<Subscriptions, K>) => string; search: <K extends QueryableKeys<Subscriptions>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Subscriptions>>(field: K) => string; isNotNull: <K extends QueryableKeys<Subscriptions>>(field: K) => string; startsWith: <K extends QueryableKeys<Subscriptions>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Subscriptions>>(field: K, value: string) => string; between: <K extends QueryableKeys<Subscriptions>>(field: K, start: QueryableFieldValue<Subscriptions, K>, end: QueryableFieldValue<Subscriptions, K>) => string; select: <K extends keyof Subscriptions>(fields: K[]) => string; orderAsc: <K extends keyof Subscriptions>(field: K) => string; orderDesc: <K extends keyof Subscriptions>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Subscriptions[] }>;
    };
    "billing_transactions": {
      create: (data: {
        "paymentId": string;
        "userId": string;
        "plan": string;
        "amountUsd": string;
        "status"?: BillingTransactionsStatus;
        "provider"?: BillingTransactionsProvider;
        "couponId"?: string | null;
        "metadata"?: string | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<BillingTransactions>;
      get: (id: string) => Promise<BillingTransactions>;
      update: (id: string, data: Partial<{
        "paymentId": string;
        "userId": string;
        "plan": string;
        "amountUsd": string;
        "status"?: BillingTransactionsStatus;
        "provider"?: BillingTransactionsProvider;
        "couponId"?: string | null;
        "metadata"?: string | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<BillingTransactions>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<BillingTransactions>>(field: K, value: QueryableFieldValue<BillingTransactions, K>) => string; notEqual: <K extends QueryableKeys<BillingTransactions>>(field: K, value: QueryableFieldValue<BillingTransactions, K>) => string; lessThan: <K extends QueryableKeys<BillingTransactions>>(field: K, value: QueryableFieldValue<BillingTransactions, K>) => string; lessThanEqual: <K extends QueryableKeys<BillingTransactions>>(field: K, value: QueryableFieldValue<BillingTransactions, K>) => string; greaterThan: <K extends QueryableKeys<BillingTransactions>>(field: K, value: QueryableFieldValue<BillingTransactions, K>) => string; greaterThanEqual: <K extends QueryableKeys<BillingTransactions>>(field: K, value: QueryableFieldValue<BillingTransactions, K>) => string; contains: <K extends QueryableKeys<BillingTransactions>>(field: K, value: QueryableFieldValue<BillingTransactions, K>) => string; search: <K extends QueryableKeys<BillingTransactions>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<BillingTransactions>>(field: K) => string; isNotNull: <K extends QueryableKeys<BillingTransactions>>(field: K) => string; startsWith: <K extends QueryableKeys<BillingTransactions>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<BillingTransactions>>(field: K, value: string) => string; between: <K extends QueryableKeys<BillingTransactions>>(field: K, start: QueryableFieldValue<BillingTransactions, K>, end: QueryableFieldValue<BillingTransactions, K>) => string; select: <K extends keyof BillingTransactions>(fields: K[]) => string; orderAsc: <K extends keyof BillingTransactions>(field: K) => string; orderDesc: <K extends keyof BillingTransactions>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: BillingTransactions[] }>;
    };
    "billing_webhook_logs": {
      create: (data: {
        "paymentId"?: string | null;
        "provider"?: BillingWebhookLogsProvider;
        "payload": string;
        "headers"?: string | null;
        "status"?: BillingWebhookLogsStatus;
        "errorMessage"?: string | null;
        "metadata"?: string | null;
        "createdAt"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<BillingWebhookLogs>;
      get: (id: string) => Promise<BillingWebhookLogs>;
      update: (id: string, data: Partial<{
        "paymentId"?: string | null;
        "provider"?: BillingWebhookLogsProvider;
        "payload": string;
        "headers"?: string | null;
        "status"?: BillingWebhookLogsStatus;
        "errorMessage"?: string | null;
        "metadata"?: string | null;
        "createdAt"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<BillingWebhookLogs>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<BillingWebhookLogs>>(field: K, value: QueryableFieldValue<BillingWebhookLogs, K>) => string; notEqual: <K extends QueryableKeys<BillingWebhookLogs>>(field: K, value: QueryableFieldValue<BillingWebhookLogs, K>) => string; lessThan: <K extends QueryableKeys<BillingWebhookLogs>>(field: K, value: QueryableFieldValue<BillingWebhookLogs, K>) => string; lessThanEqual: <K extends QueryableKeys<BillingWebhookLogs>>(field: K, value: QueryableFieldValue<BillingWebhookLogs, K>) => string; greaterThan: <K extends QueryableKeys<BillingWebhookLogs>>(field: K, value: QueryableFieldValue<BillingWebhookLogs, K>) => string; greaterThanEqual: <K extends QueryableKeys<BillingWebhookLogs>>(field: K, value: QueryableFieldValue<BillingWebhookLogs, K>) => string; contains: <K extends QueryableKeys<BillingWebhookLogs>>(field: K, value: QueryableFieldValue<BillingWebhookLogs, K>) => string; search: <K extends QueryableKeys<BillingWebhookLogs>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<BillingWebhookLogs>>(field: K) => string; isNotNull: <K extends QueryableKeys<BillingWebhookLogs>>(field: K) => string; startsWith: <K extends QueryableKeys<BillingWebhookLogs>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<BillingWebhookLogs>>(field: K, value: string) => string; between: <K extends QueryableKeys<BillingWebhookLogs>>(field: K, start: QueryableFieldValue<BillingWebhookLogs, K>, end: QueryableFieldValue<BillingWebhookLogs, K>) => string; select: <K extends keyof BillingWebhookLogs>(fields: K[]) => string; orderAsc: <K extends keyof BillingWebhookLogs>(field: K) => string; orderDesc: <K extends keyof BillingWebhookLogs>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: BillingWebhookLogs[] }>;
    };
    "tags": {
      create: (data: {
        "name": string;
        "nameLower": string;
        "userId"?: string | null;
        "metadata"?: string | null;
        "isPublic"?: boolean;
        "isGuest"?: boolean;
        "usageCount"?: number;
        "isTrash"?: boolean;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Tags>;
      get: (id: string) => Promise<Tags>;
      update: (id: string, data: Partial<{
        "name": string;
        "nameLower": string;
        "userId"?: string | null;
        "metadata"?: string | null;
        "isPublic"?: boolean;
        "isGuest"?: boolean;
        "usageCount"?: number;
        "isTrash"?: boolean;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Tags>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Tags>>(field: K, value: QueryableFieldValue<Tags, K>) => string; notEqual: <K extends QueryableKeys<Tags>>(field: K, value: QueryableFieldValue<Tags, K>) => string; lessThan: <K extends QueryableKeys<Tags>>(field: K, value: QueryableFieldValue<Tags, K>) => string; lessThanEqual: <K extends QueryableKeys<Tags>>(field: K, value: QueryableFieldValue<Tags, K>) => string; greaterThan: <K extends QueryableKeys<Tags>>(field: K, value: QueryableFieldValue<Tags, K>) => string; greaterThanEqual: <K extends QueryableKeys<Tags>>(field: K, value: QueryableFieldValue<Tags, K>) => string; contains: <K extends QueryableKeys<Tags>>(field: K, value: QueryableFieldValue<Tags, K>) => string; search: <K extends QueryableKeys<Tags>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Tags>>(field: K) => string; isNotNull: <K extends QueryableKeys<Tags>>(field: K) => string; startsWith: <K extends QueryableKeys<Tags>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Tags>>(field: K, value: string) => string; between: <K extends QueryableKeys<Tags>>(field: K, start: QueryableFieldValue<Tags, K>, end: QueryableFieldValue<Tags, K>) => string; select: <K extends keyof Tags>(fields: K[]) => string; orderAsc: <K extends keyof Tags>(field: K) => string; orderDesc: <K extends keyof Tags>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Tags[] }>;
    };
    "resource_tags": {
      create: (data: {
        "tagId": string;
        "tag": string;
        "resourceId": string;
        "resourceType": string;
        "userId"?: string | null;
        "metadata"?: string | null;
        "isPublic"?: boolean;
        "isGuest"?: boolean;
        "isPinned"?: boolean | null;
        "isDeleted"?: boolean;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<ResourceTags>;
      get: (id: string) => Promise<ResourceTags>;
      update: (id: string, data: Partial<{
        "tagId": string;
        "tag": string;
        "resourceId": string;
        "resourceType": string;
        "userId"?: string | null;
        "metadata"?: string | null;
        "isPublic"?: boolean;
        "isGuest"?: boolean;
        "isPinned"?: boolean | null;
        "isDeleted"?: boolean;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<ResourceTags>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<ResourceTags>>(field: K, value: QueryableFieldValue<ResourceTags, K>) => string; notEqual: <K extends QueryableKeys<ResourceTags>>(field: K, value: QueryableFieldValue<ResourceTags, K>) => string; lessThan: <K extends QueryableKeys<ResourceTags>>(field: K, value: QueryableFieldValue<ResourceTags, K>) => string; lessThanEqual: <K extends QueryableKeys<ResourceTags>>(field: K, value: QueryableFieldValue<ResourceTags, K>) => string; greaterThan: <K extends QueryableKeys<ResourceTags>>(field: K, value: QueryableFieldValue<ResourceTags, K>) => string; greaterThanEqual: <K extends QueryableKeys<ResourceTags>>(field: K, value: QueryableFieldValue<ResourceTags, K>) => string; contains: <K extends QueryableKeys<ResourceTags>>(field: K, value: QueryableFieldValue<ResourceTags, K>) => string; search: <K extends QueryableKeys<ResourceTags>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<ResourceTags>>(field: K) => string; isNotNull: <K extends QueryableKeys<ResourceTags>>(field: K) => string; startsWith: <K extends QueryableKeys<ResourceTags>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<ResourceTags>>(field: K, value: string) => string; between: <K extends QueryableKeys<ResourceTags>>(field: K, start: QueryableFieldValue<ResourceTags, K>, end: QueryableFieldValue<ResourceTags, K>) => string; select: <K extends keyof ResourceTags>(fields: K[]) => string; orderAsc: <K extends keyof ResourceTags>(field: K) => string; orderDesc: <K extends keyof ResourceTags>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: ResourceTags[] }>;
    };
    "coupons": {
      create: (data: {
        "status"?: CouponsStatus;
        "expiresAt"?: string | null;
        "targetUserId"?: string | null;
        "createdBy": string;
        "metadata"?: string | null;
        "note"?: string | null;
        "title"?: string | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
        "discountPercent"?: number | null;
        "discountPercentage"?: number | null;
        "redemptionLimit"?: number;
        "redemptionCount"?: number;
        "seats"?: number;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Coupons>;
      get: (id: string) => Promise<Coupons>;
      update: (id: string, data: Partial<{
        "status"?: CouponsStatus;
        "expiresAt"?: string | null;
        "targetUserId"?: string | null;
        "createdBy": string;
        "metadata"?: string | null;
        "note"?: string | null;
        "title"?: string | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
        "discountPercent"?: number | null;
        "discountPercentage"?: number | null;
        "redemptionLimit"?: number;
        "redemptionCount"?: number;
        "seats"?: number;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Coupons>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Coupons>>(field: K, value: QueryableFieldValue<Coupons, K>) => string; notEqual: <K extends QueryableKeys<Coupons>>(field: K, value: QueryableFieldValue<Coupons, K>) => string; lessThan: <K extends QueryableKeys<Coupons>>(field: K, value: QueryableFieldValue<Coupons, K>) => string; lessThanEqual: <K extends QueryableKeys<Coupons>>(field: K, value: QueryableFieldValue<Coupons, K>) => string; greaterThan: <K extends QueryableKeys<Coupons>>(field: K, value: QueryableFieldValue<Coupons, K>) => string; greaterThanEqual: <K extends QueryableKeys<Coupons>>(field: K, value: QueryableFieldValue<Coupons, K>) => string; contains: <K extends QueryableKeys<Coupons>>(field: K, value: QueryableFieldValue<Coupons, K>) => string; search: <K extends QueryableKeys<Coupons>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Coupons>>(field: K) => string; isNotNull: <K extends QueryableKeys<Coupons>>(field: K) => string; startsWith: <K extends QueryableKeys<Coupons>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Coupons>>(field: K, value: string) => string; between: <K extends QueryableKeys<Coupons>>(field: K, start: QueryableFieldValue<Coupons, K>, end: QueryableFieldValue<Coupons, K>) => string; select: <K extends keyof Coupons>(fields: K[]) => string; orderAsc: <K extends keyof Coupons>(field: K) => string; orderDesc: <K extends keyof Coupons>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Coupons[] }>;
    };
    "User Resource Pins": {
      create: (data: {
        "userId": string;
        "resourceType": UserResourcePinsResourceType;
        "resourceId": string;
        "pinnedAt"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<UserResourcePins>;
      get: (id: string) => Promise<UserResourcePins>;
      update: (id: string, data: Partial<{
        "userId": string;
        "resourceType": UserResourcePinsResourceType;
        "resourceId": string;
        "pinnedAt"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<UserResourcePins>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<UserResourcePins>>(field: K, value: QueryableFieldValue<UserResourcePins, K>) => string; notEqual: <K extends QueryableKeys<UserResourcePins>>(field: K, value: QueryableFieldValue<UserResourcePins, K>) => string; lessThan: <K extends QueryableKeys<UserResourcePins>>(field: K, value: QueryableFieldValue<UserResourcePins, K>) => string; lessThanEqual: <K extends QueryableKeys<UserResourcePins>>(field: K, value: QueryableFieldValue<UserResourcePins, K>) => string; greaterThan: <K extends QueryableKeys<UserResourcePins>>(field: K, value: QueryableFieldValue<UserResourcePins, K>) => string; greaterThanEqual: <K extends QueryableKeys<UserResourcePins>>(field: K, value: QueryableFieldValue<UserResourcePins, K>) => string; contains: <K extends QueryableKeys<UserResourcePins>>(field: K, value: QueryableFieldValue<UserResourcePins, K>) => string; search: <K extends QueryableKeys<UserResourcePins>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<UserResourcePins>>(field: K) => string; isNotNull: <K extends QueryableKeys<UserResourcePins>>(field: K) => string; startsWith: <K extends QueryableKeys<UserResourcePins>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<UserResourcePins>>(field: K, value: string) => string; between: <K extends QueryableKeys<UserResourcePins>>(field: K, start: QueryableFieldValue<UserResourcePins, K>, end: QueryableFieldValue<UserResourcePins, K>) => string; select: <K extends keyof UserResourcePins>(fields: K[]) => string; orderAsc: <K extends keyof UserResourcePins>(field: K) => string; orderDesc: <K extends keyof UserResourcePins>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: UserResourcePins[] }>;
    };
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
        "isPinned"?: boolean | null;
        "isVoice"?: boolean;
        "metadata"?: string | null;
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
        "isPinned"?: boolean | null;
        "isVoice"?: boolean;
        "metadata"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Messages>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Messages>>(field: K, value: QueryableFieldValue<Messages, K>) => string; notEqual: <K extends QueryableKeys<Messages>>(field: K, value: QueryableFieldValue<Messages, K>) => string; lessThan: <K extends QueryableKeys<Messages>>(field: K, value: QueryableFieldValue<Messages, K>) => string; lessThanEqual: <K extends QueryableKeys<Messages>>(field: K, value: QueryableFieldValue<Messages, K>) => string; greaterThan: <K extends QueryableKeys<Messages>>(field: K, value: QueryableFieldValue<Messages, K>) => string; greaterThanEqual: <K extends QueryableKeys<Messages>>(field: K, value: QueryableFieldValue<Messages, K>) => string; contains: <K extends QueryableKeys<Messages>>(field: K, value: QueryableFieldValue<Messages, K>) => string; search: <K extends QueryableKeys<Messages>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Messages>>(field: K) => string; isNotNull: <K extends QueryableKeys<Messages>>(field: K) => string; startsWith: <K extends QueryableKeys<Messages>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Messages>>(field: K, value: string) => string; between: <K extends QueryableKeys<Messages>>(field: K, start: QueryableFieldValue<Messages, K>, end: QueryableFieldValue<Messages, K>) => string; select: <K extends keyof Messages>(fields: K[]) => string; orderAsc: <K extends keyof Messages>(field: K) => string; orderDesc: <K extends keyof Messages>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Messages[] }>;
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
        "inviteMeta"?: string | null;
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
        "inviteMeta"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Conversations>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Conversations>>(field: K, value: QueryableFieldValue<Conversations, K>) => string; notEqual: <K extends QueryableKeys<Conversations>>(field: K, value: QueryableFieldValue<Conversations, K>) => string; lessThan: <K extends QueryableKeys<Conversations>>(field: K, value: QueryableFieldValue<Conversations, K>) => string; lessThanEqual: <K extends QueryableKeys<Conversations>>(field: K, value: QueryableFieldValue<Conversations, K>) => string; greaterThan: <K extends QueryableKeys<Conversations>>(field: K, value: QueryableFieldValue<Conversations, K>) => string; greaterThanEqual: <K extends QueryableKeys<Conversations>>(field: K, value: QueryableFieldValue<Conversations, K>) => string; contains: <K extends QueryableKeys<Conversations>>(field: K, value: QueryableFieldValue<Conversations, K>) => string; search: <K extends QueryableKeys<Conversations>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Conversations>>(field: K) => string; isNotNull: <K extends QueryableKeys<Conversations>>(field: K) => string; startsWith: <K extends QueryableKeys<Conversations>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Conversations>>(field: K, value: string) => string; between: <K extends QueryableKeys<Conversations>>(field: K, start: QueryableFieldValue<Conversations, K>, end: QueryableFieldValue<Conversations, K>) => string; select: <K extends keyof Conversations>(fields: K[]) => string; orderAsc: <K extends keyof Conversations>(field: K) => string; orderDesc: <K extends keyof Conversations>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Conversations[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Contacts>>(field: K, value: QueryableFieldValue<Contacts, K>) => string; notEqual: <K extends QueryableKeys<Contacts>>(field: K, value: QueryableFieldValue<Contacts, K>) => string; lessThan: <K extends QueryableKeys<Contacts>>(field: K, value: QueryableFieldValue<Contacts, K>) => string; lessThanEqual: <K extends QueryableKeys<Contacts>>(field: K, value: QueryableFieldValue<Contacts, K>) => string; greaterThan: <K extends QueryableKeys<Contacts>>(field: K, value: QueryableFieldValue<Contacts, K>) => string; greaterThanEqual: <K extends QueryableKeys<Contacts>>(field: K, value: QueryableFieldValue<Contacts, K>) => string; contains: <K extends QueryableKeys<Contacts>>(field: K, value: QueryableFieldValue<Contacts, K>) => string; search: <K extends QueryableKeys<Contacts>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Contacts>>(field: K) => string; isNotNull: <K extends QueryableKeys<Contacts>>(field: K) => string; startsWith: <K extends QueryableKeys<Contacts>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Contacts>>(field: K, value: string) => string; between: <K extends QueryableKeys<Contacts>>(field: K, start: QueryableFieldValue<Contacts, K>, end: QueryableFieldValue<Contacts, K>) => string; select: <K extends keyof Contacts>(fields: K[]) => string; orderAsc: <K extends keyof Contacts>(field: K) => string; orderDesc: <K extends keyof Contacts>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Contacts[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Follows>>(field: K, value: QueryableFieldValue<Follows, K>) => string; notEqual: <K extends QueryableKeys<Follows>>(field: K, value: QueryableFieldValue<Follows, K>) => string; lessThan: <K extends QueryableKeys<Follows>>(field: K, value: QueryableFieldValue<Follows, K>) => string; lessThanEqual: <K extends QueryableKeys<Follows>>(field: K, value: QueryableFieldValue<Follows, K>) => string; greaterThan: <K extends QueryableKeys<Follows>>(field: K, value: QueryableFieldValue<Follows, K>) => string; greaterThanEqual: <K extends QueryableKeys<Follows>>(field: K, value: QueryableFieldValue<Follows, K>) => string; contains: <K extends QueryableKeys<Follows>>(field: K, value: QueryableFieldValue<Follows, K>) => string; search: <K extends QueryableKeys<Follows>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Follows>>(field: K) => string; isNotNull: <K extends QueryableKeys<Follows>>(field: K) => string; startsWith: <K extends QueryableKeys<Follows>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Follows>>(field: K, value: string) => string; between: <K extends QueryableKeys<Follows>>(field: K, start: QueryableFieldValue<Follows, K>, end: QueryableFieldValue<Follows, K>) => string; select: <K extends keyof Follows>(fields: K[]) => string; orderAsc: <K extends keyof Follows>(field: K) => string; orderDesc: <K extends keyof Follows>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Follows[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<AppActivity>>(field: K, value: QueryableFieldValue<AppActivity, K>) => string; notEqual: <K extends QueryableKeys<AppActivity>>(field: K, value: QueryableFieldValue<AppActivity, K>) => string; lessThan: <K extends QueryableKeys<AppActivity>>(field: K, value: QueryableFieldValue<AppActivity, K>) => string; lessThanEqual: <K extends QueryableKeys<AppActivity>>(field: K, value: QueryableFieldValue<AppActivity, K>) => string; greaterThan: <K extends QueryableKeys<AppActivity>>(field: K, value: QueryableFieldValue<AppActivity, K>) => string; greaterThanEqual: <K extends QueryableKeys<AppActivity>>(field: K, value: QueryableFieldValue<AppActivity, K>) => string; contains: <K extends QueryableKeys<AppActivity>>(field: K, value: QueryableFieldValue<AppActivity, K>) => string; search: <K extends QueryableKeys<AppActivity>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<AppActivity>>(field: K) => string; isNotNull: <K extends QueryableKeys<AppActivity>>(field: K) => string; startsWith: <K extends QueryableKeys<AppActivity>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<AppActivity>>(field: K, value: string) => string; between: <K extends QueryableKeys<AppActivity>>(field: K, start: QueryableFieldValue<AppActivity, K>, end: QueryableFieldValue<AppActivity, K>) => string; select: <K extends keyof AppActivity>(fields: K[]) => string; orderAsc: <K extends keyof AppActivity>(field: K) => string; orderDesc: <K extends keyof AppActivity>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: AppActivity[] }>;
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
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Interactions>>(field: K, value: QueryableFieldValue<Interactions, K>) => string; notEqual: <K extends QueryableKeys<Interactions>>(field: K, value: QueryableFieldValue<Interactions, K>) => string; lessThan: <K extends QueryableKeys<Interactions>>(field: K, value: QueryableFieldValue<Interactions, K>) => string; lessThanEqual: <K extends QueryableKeys<Interactions>>(field: K, value: QueryableFieldValue<Interactions, K>) => string; greaterThan: <K extends QueryableKeys<Interactions>>(field: K, value: QueryableFieldValue<Interactions, K>) => string; greaterThanEqual: <K extends QueryableKeys<Interactions>>(field: K, value: QueryableFieldValue<Interactions, K>) => string; contains: <K extends QueryableKeys<Interactions>>(field: K, value: QueryableFieldValue<Interactions, K>) => string; search: <K extends QueryableKeys<Interactions>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Interactions>>(field: K) => string; isNotNull: <K extends QueryableKeys<Interactions>>(field: K) => string; startsWith: <K extends QueryableKeys<Interactions>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Interactions>>(field: K, value: string) => string; between: <K extends QueryableKeys<Interactions>>(field: K, start: QueryableFieldValue<Interactions, K>, end: QueryableFieldValue<Interactions, K>) => string; select: <K extends keyof Interactions>(fields: K[]) => string; orderAsc: <K extends keyof Interactions>(field: K) => string; orderDesc: <K extends keyof Interactions>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Interactions[] }>;
    };
    "Moments": {
      create: (data: {
        "userId": string;
        "fileId": string;
        "type"?: MomentsType;
        "caption"?: string | null;
        "createdAt": string;
        "expiresAt": string;
        "momentKind"?: string | null;
        "sourceId"?: string | null;
        "searchTitle"?: string | null;
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Moments>;
      get: (id: string) => Promise<Moments>;
      update: (id: string, data: Partial<{
        "userId": string;
        "fileId": string;
        "type"?: MomentsType;
        "caption"?: string | null;
        "createdAt": string;
        "expiresAt": string;
        "momentKind"?: string | null;
        "sourceId"?: string | null;
        "searchTitle"?: string | null;
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Moments>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Moments>>(field: K, value: QueryableFieldValue<Moments, K>) => string; notEqual: <K extends QueryableKeys<Moments>>(field: K, value: QueryableFieldValue<Moments, K>) => string; lessThan: <K extends QueryableKeys<Moments>>(field: K, value: QueryableFieldValue<Moments, K>) => string; lessThanEqual: <K extends QueryableKeys<Moments>>(field: K, value: QueryableFieldValue<Moments, K>) => string; greaterThan: <K extends QueryableKeys<Moments>>(field: K, value: QueryableFieldValue<Moments, K>) => string; greaterThanEqual: <K extends QueryableKeys<Moments>>(field: K, value: QueryableFieldValue<Moments, K>) => string; contains: <K extends QueryableKeys<Moments>>(field: K, value: QueryableFieldValue<Moments, K>) => string; search: <K extends QueryableKeys<Moments>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Moments>>(field: K) => string; isNotNull: <K extends QueryableKeys<Moments>>(field: K) => string; startsWith: <K extends QueryableKeys<Moments>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Moments>>(field: K, value: string) => string; between: <K extends QueryableKeys<Moments>>(field: K, start: QueryableFieldValue<Moments, K>, end: QueryableFieldValue<Moments, K>) => string; select: <K extends keyof Moments>(fields: K[]) => string; orderAsc: <K extends keyof Moments>(field: K) => string; orderDesc: <K extends keyof Moments>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Moments[] }>;
    };
    "Calls": {
      create: (data: {
        "userId": string;
        "type"?: CallsType;
        "title"?: string | null;
        "startsAt"?: string | null;
        "expiresAt"?: string | null;
        "metadata"?: string | null;
        "receiverId"?: string | null;
        "conversationId"?: string | null;
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Calls>;
      get: (id: string) => Promise<Calls>;
      update: (id: string, data: Partial<{
        "userId": string;
        "type"?: CallsType;
        "title"?: string | null;
        "startsAt"?: string | null;
        "expiresAt"?: string | null;
        "metadata"?: string | null;
        "receiverId"?: string | null;
        "conversationId"?: string | null;
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Calls>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Calls>>(field: K, value: QueryableFieldValue<Calls, K>) => string; notEqual: <K extends QueryableKeys<Calls>>(field: K, value: QueryableFieldValue<Calls, K>) => string; lessThan: <K extends QueryableKeys<Calls>>(field: K, value: QueryableFieldValue<Calls, K>) => string; lessThanEqual: <K extends QueryableKeys<Calls>>(field: K, value: QueryableFieldValue<Calls, K>) => string; greaterThan: <K extends QueryableKeys<Calls>>(field: K, value: QueryableFieldValue<Calls, K>) => string; greaterThanEqual: <K extends QueryableKeys<Calls>>(field: K, value: QueryableFieldValue<Calls, K>) => string; contains: <K extends QueryableKeys<Calls>>(field: K, value: QueryableFieldValue<Calls, K>) => string; search: <K extends QueryableKeys<Calls>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Calls>>(field: K) => string; isNotNull: <K extends QueryableKeys<Calls>>(field: K) => string; startsWith: <K extends QueryableKeys<Calls>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Calls>>(field: K, value: string) => string; between: <K extends QueryableKeys<Calls>>(field: K, start: QueryableFieldValue<Calls, K>, end: QueryableFieldValue<Calls, K>) => string; select: <K extends keyof Calls>(fields: K[]) => string; orderAsc: <K extends keyof Calls>(field: K) => string; orderDesc: <K extends keyof Calls>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Calls[] }>;
    };
    "epochs": {
      create: (data: {
        "resourceId": string;
        "epochNumber": number;
        "createdBy": string;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Epochs>;
      get: (id: string) => Promise<Epochs>;
      update: (id: string, data: Partial<{
        "resourceId": string;
        "epochNumber": number;
        "createdBy": string;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Epochs>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Epochs>>(field: K, value: QueryableFieldValue<Epochs, K>) => string; notEqual: <K extends QueryableKeys<Epochs>>(field: K, value: QueryableFieldValue<Epochs, K>) => string; lessThan: <K extends QueryableKeys<Epochs>>(field: K, value: QueryableFieldValue<Epochs, K>) => string; lessThanEqual: <K extends QueryableKeys<Epochs>>(field: K, value: QueryableFieldValue<Epochs, K>) => string; greaterThan: <K extends QueryableKeys<Epochs>>(field: K, value: QueryableFieldValue<Epochs, K>) => string; greaterThanEqual: <K extends QueryableKeys<Epochs>>(field: K, value: QueryableFieldValue<Epochs, K>) => string; contains: <K extends QueryableKeys<Epochs>>(field: K, value: QueryableFieldValue<Epochs, K>) => string; search: <K extends QueryableKeys<Epochs>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Epochs>>(field: K) => string; isNotNull: <K extends QueryableKeys<Epochs>>(field: K) => string; startsWith: <K extends QueryableKeys<Epochs>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Epochs>>(field: K, value: string) => string; between: <K extends QueryableKeys<Epochs>>(field: K, start: QueryableFieldValue<Epochs, K>, end: QueryableFieldValue<Epochs, K>) => string; select: <K extends keyof Epochs>(fields: K[]) => string; orderAsc: <K extends keyof Epochs>(field: K) => string; orderDesc: <K extends keyof Epochs>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Epochs[] }>;
    };
    "Conversation Members": {
      create: (data: {
        "conversationId": string;
        "userId": string;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<ConversationMembers>;
      get: (id: string) => Promise<ConversationMembers>;
      update: (id: string, data: Partial<{
        "conversationId": string;
        "userId": string;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<ConversationMembers>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<ConversationMembers>>(field: K, value: QueryableFieldValue<ConversationMembers, K>) => string; notEqual: <K extends QueryableKeys<ConversationMembers>>(field: K, value: QueryableFieldValue<ConversationMembers, K>) => string; lessThan: <K extends QueryableKeys<ConversationMembers>>(field: K, value: QueryableFieldValue<ConversationMembers, K>) => string; lessThanEqual: <K extends QueryableKeys<ConversationMembers>>(field: K, value: QueryableFieldValue<ConversationMembers, K>) => string; greaterThan: <K extends QueryableKeys<ConversationMembers>>(field: K, value: QueryableFieldValue<ConversationMembers, K>) => string; greaterThanEqual: <K extends QueryableKeys<ConversationMembers>>(field: K, value: QueryableFieldValue<ConversationMembers, K>) => string; contains: <K extends QueryableKeys<ConversationMembers>>(field: K, value: QueryableFieldValue<ConversationMembers, K>) => string; search: <K extends QueryableKeys<ConversationMembers>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<ConversationMembers>>(field: K) => string; isNotNull: <K extends QueryableKeys<ConversationMembers>>(field: K) => string; startsWith: <K extends QueryableKeys<ConversationMembers>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<ConversationMembers>>(field: K, value: string) => string; between: <K extends QueryableKeys<ConversationMembers>>(field: K, start: QueryableFieldValue<ConversationMembers, K>, end: QueryableFieldValue<ConversationMembers, K>) => string; select: <K extends keyof ConversationMembers>(fields: K[]) => string; orderAsc: <K extends keyof ConversationMembers>(field: K) => string; orderDesc: <K extends keyof ConversationMembers>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: ConversationMembers[] }>;
    };
    "profiles": {
      create: (data: {
        "username": string;
        "displayName"?: string | null;
        "bio"?: string | null;
        "avatar"?: string | null;
        "walletAddress"?: string | null;
        "publicKey"?: string | null;
        "status"?: string;
        "preferences"?: string | null;
        "userId": string;
        "isPublic"?: boolean;
        "isGuest"?: boolean;
        "isAvatar"?: boolean;
        "isContact"?: boolean;
        "isOnlineVisible"?: boolean;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Profiles>;
      get: (id: string) => Promise<Profiles>;
      update: (id: string, data: Partial<{
        "username": string;
        "displayName"?: string | null;
        "bio"?: string | null;
        "avatar"?: string | null;
        "walletAddress"?: string | null;
        "publicKey"?: string | null;
        "status"?: string;
        "preferences"?: string | null;
        "userId": string;
        "isPublic"?: boolean;
        "isGuest"?: boolean;
        "isAvatar"?: boolean;
        "isContact"?: boolean;
        "isOnlineVisible"?: boolean;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Profiles>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Profiles>>(field: K, value: QueryableFieldValue<Profiles, K>) => string; notEqual: <K extends QueryableKeys<Profiles>>(field: K, value: QueryableFieldValue<Profiles, K>) => string; lessThan: <K extends QueryableKeys<Profiles>>(field: K, value: QueryableFieldValue<Profiles, K>) => string; lessThanEqual: <K extends QueryableKeys<Profiles>>(field: K, value: QueryableFieldValue<Profiles, K>) => string; greaterThan: <K extends QueryableKeys<Profiles>>(field: K, value: QueryableFieldValue<Profiles, K>) => string; greaterThanEqual: <K extends QueryableKeys<Profiles>>(field: K, value: QueryableFieldValue<Profiles, K>) => string; contains: <K extends QueryableKeys<Profiles>>(field: K, value: QueryableFieldValue<Profiles, K>) => string; search: <K extends QueryableKeys<Profiles>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Profiles>>(field: K) => string; isNotNull: <K extends QueryableKeys<Profiles>>(field: K) => string; startsWith: <K extends QueryableKeys<Profiles>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Profiles>>(field: K, value: string) => string; between: <K extends QueryableKeys<Profiles>>(field: K, start: QueryableFieldValue<Profiles, K>, end: QueryableFieldValue<Profiles, K>) => string; select: <K extends keyof Profiles>(fields: K[]) => string; orderAsc: <K extends keyof Profiles>(field: K) => string; orderDesc: <K extends keyof Profiles>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Profiles[] }>;
    };
    "Message Reactions": {
      create: (data: {
        "conversationId": string;
        "messageId": string;
        "userId": string;
        "emoji": string;
        "createdAt": string;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<MessageReactions>;
      get: (id: string) => Promise<MessageReactions>;
      update: (id: string, data: Partial<{
        "conversationId": string;
        "messageId": string;
        "userId": string;
        "emoji": string;
        "createdAt": string;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<MessageReactions>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<MessageReactions>>(field: K, value: QueryableFieldValue<MessageReactions, K>) => string; notEqual: <K extends QueryableKeys<MessageReactions>>(field: K, value: QueryableFieldValue<MessageReactions, K>) => string; lessThan: <K extends QueryableKeys<MessageReactions>>(field: K, value: QueryableFieldValue<MessageReactions, K>) => string; lessThanEqual: <K extends QueryableKeys<MessageReactions>>(field: K, value: QueryableFieldValue<MessageReactions, K>) => string; greaterThan: <K extends QueryableKeys<MessageReactions>>(field: K, value: QueryableFieldValue<MessageReactions, K>) => string; greaterThanEqual: <K extends QueryableKeys<MessageReactions>>(field: K, value: QueryableFieldValue<MessageReactions, K>) => string; contains: <K extends QueryableKeys<MessageReactions>>(field: K, value: QueryableFieldValue<MessageReactions, K>) => string; search: <K extends QueryableKeys<MessageReactions>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<MessageReactions>>(field: K) => string; isNotNull: <K extends QueryableKeys<MessageReactions>>(field: K) => string; startsWith: <K extends QueryableKeys<MessageReactions>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<MessageReactions>>(field: K, value: string) => string; between: <K extends QueryableKeys<MessageReactions>>(field: K, start: QueryableFieldValue<MessageReactions, K>, end: QueryableFieldValue<MessageReactions, K>) => string; select: <K extends keyof MessageReactions>(fields: K[]) => string; orderAsc: <K extends keyof MessageReactions>(field: K) => string; orderDesc: <K extends keyof MessageReactions>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: MessageReactions[] }>;
    };
    "Join Requests": {
      create: (data: {
        "resourceType": string;
        "resourceId": string;
        "requesterId": string;
        "status"?: JoinRequestsStatus | null;
        "createdAt"?: string | null;
        "resolvedAt"?: string | null;
        "resolvedBy"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<JoinRequests>;
      get: (id: string) => Promise<JoinRequests>;
      update: (id: string, data: Partial<{
        "resourceType": string;
        "resourceId": string;
        "requesterId": string;
        "status"?: JoinRequestsStatus | null;
        "createdAt"?: string | null;
        "resolvedAt"?: string | null;
        "resolvedBy"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<JoinRequests>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<JoinRequests>>(field: K, value: QueryableFieldValue<JoinRequests, K>) => string; notEqual: <K extends QueryableKeys<JoinRequests>>(field: K, value: QueryableFieldValue<JoinRequests, K>) => string; lessThan: <K extends QueryableKeys<JoinRequests>>(field: K, value: QueryableFieldValue<JoinRequests, K>) => string; lessThanEqual: <K extends QueryableKeys<JoinRequests>>(field: K, value: QueryableFieldValue<JoinRequests, K>) => string; greaterThan: <K extends QueryableKeys<JoinRequests>>(field: K, value: QueryableFieldValue<JoinRequests, K>) => string; greaterThanEqual: <K extends QueryableKeys<JoinRequests>>(field: K, value: QueryableFieldValue<JoinRequests, K>) => string; contains: <K extends QueryableKeys<JoinRequests>>(field: K, value: QueryableFieldValue<JoinRequests, K>) => string; search: <K extends QueryableKeys<JoinRequests>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<JoinRequests>>(field: K) => string; isNotNull: <K extends QueryableKeys<JoinRequests>>(field: K) => string; startsWith: <K extends QueryableKeys<JoinRequests>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<JoinRequests>>(field: K, value: string) => string; between: <K extends QueryableKeys<JoinRequests>>(field: K, start: QueryableFieldValue<JoinRequests, K>, end: QueryableFieldValue<JoinRequests, K>) => string; select: <K extends keyof JoinRequests>(fields: K[]) => string; orderAsc: <K extends keyof JoinRequests>(field: K) => string; orderDesc: <K extends keyof JoinRequests>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: JoinRequests[] }>;
    };
    "Unorganic Emails": {
      create: (data: {
        "eventType": string;
        "sourceApp": string;
        "actorId"?: string | null;
        "recipientId"?: string | null;
        "recipientEmail"?: string | null;
        "resourceType"?: string | null;
        "resourceId"?: string | null;
        "templateKey": string;
        "priority"?: number;
        "status": UnorganicEmailsStatus;
        "dedupeKey": string;
        "attempts"?: number;
        "sentAt"?: string | null;
        "expiresAt"?: string | null;
        "processedAt"?: string | null;
        "blockedReason"?: string | null;
        "metadata"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<UnorganicEmails>;
      get: (id: string) => Promise<UnorganicEmails>;
      update: (id: string, data: Partial<{
        "eventType": string;
        "sourceApp": string;
        "actorId"?: string | null;
        "recipientId"?: string | null;
        "recipientEmail"?: string | null;
        "resourceType"?: string | null;
        "resourceId"?: string | null;
        "templateKey": string;
        "priority"?: number;
        "status": UnorganicEmailsStatus;
        "dedupeKey": string;
        "attempts"?: number;
        "sentAt"?: string | null;
        "expiresAt"?: string | null;
        "processedAt"?: string | null;
        "blockedReason"?: string | null;
        "metadata"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<UnorganicEmails>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<UnorganicEmails>>(field: K, value: QueryableFieldValue<UnorganicEmails, K>) => string; notEqual: <K extends QueryableKeys<UnorganicEmails>>(field: K, value: QueryableFieldValue<UnorganicEmails, K>) => string; lessThan: <K extends QueryableKeys<UnorganicEmails>>(field: K, value: QueryableFieldValue<UnorganicEmails, K>) => string; lessThanEqual: <K extends QueryableKeys<UnorganicEmails>>(field: K, value: QueryableFieldValue<UnorganicEmails, K>) => string; greaterThan: <K extends QueryableKeys<UnorganicEmails>>(field: K, value: QueryableFieldValue<UnorganicEmails, K>) => string; greaterThanEqual: <K extends QueryableKeys<UnorganicEmails>>(field: K, value: QueryableFieldValue<UnorganicEmails, K>) => string; contains: <K extends QueryableKeys<UnorganicEmails>>(field: K, value: QueryableFieldValue<UnorganicEmails, K>) => string; search: <K extends QueryableKeys<UnorganicEmails>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<UnorganicEmails>>(field: K) => string; isNotNull: <K extends QueryableKeys<UnorganicEmails>>(field: K) => string; startsWith: <K extends QueryableKeys<UnorganicEmails>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<UnorganicEmails>>(field: K, value: string) => string; between: <K extends QueryableKeys<UnorganicEmails>>(field: K, start: QueryableFieldValue<UnorganicEmails, K>, end: QueryableFieldValue<UnorganicEmails, K>) => string; select: <K extends keyof UnorganicEmails>(fields: K[]) => string; orderAsc: <K extends keyof UnorganicEmails>(field: K) => string; orderDesc: <K extends keyof UnorganicEmails>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: UnorganicEmails[] }>;
    };
    "kylrix_token_ledger": {
      create: (data: {
        "rowType": string;
        "txId": string;
        "idempotencyKey": string;
        "eventType"?: string | null;
        "userId"?: string | null;
        "counterpartyUserId"?: string | null;
        "amountMicro"?: string | null;
        "deltaMicro"?: string | null;
        "balanceAfterMicro"?: string | null;
        "status"?: string;
        "sourceType"?: string | null;
        "sourceId"?: string | null;
        "metadata"?: string | null;
        "createdAt": string;
        "genesisAt"?: string | null;
        "contractVersion"?: string | null;
        "maxSupplyMicro"?: string | null;
        "totalMintedMicro"?: string | null;
        "totalBurnedMicro"?: string | null;
        "circulatingMicro"?: string | null;
        "rootBalanceMicro"?: string | null;
        "riskLevel"?: string | null;
        "lastActivityAt"?: string | null;
        "lastSpikeAt"?: string | null;
        "updatedAt"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<KylrixTokenLedger>;
      get: (id: string) => Promise<KylrixTokenLedger>;
      update: (id: string, data: Partial<{
        "rowType": string;
        "txId": string;
        "idempotencyKey": string;
        "eventType"?: string | null;
        "userId"?: string | null;
        "counterpartyUserId"?: string | null;
        "amountMicro"?: string | null;
        "deltaMicro"?: string | null;
        "balanceAfterMicro"?: string | null;
        "status"?: string;
        "sourceType"?: string | null;
        "sourceId"?: string | null;
        "metadata"?: string | null;
        "createdAt": string;
        "genesisAt"?: string | null;
        "contractVersion"?: string | null;
        "maxSupplyMicro"?: string | null;
        "totalMintedMicro"?: string | null;
        "totalBurnedMicro"?: string | null;
        "circulatingMicro"?: string | null;
        "rootBalanceMicro"?: string | null;
        "riskLevel"?: string | null;
        "lastActivityAt"?: string | null;
        "lastSpikeAt"?: string | null;
        "updatedAt"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<KylrixTokenLedger>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<KylrixTokenLedger>>(field: K, value: QueryableFieldValue<KylrixTokenLedger, K>) => string; notEqual: <K extends QueryableKeys<KylrixTokenLedger>>(field: K, value: QueryableFieldValue<KylrixTokenLedger, K>) => string; lessThan: <K extends QueryableKeys<KylrixTokenLedger>>(field: K, value: QueryableFieldValue<KylrixTokenLedger, K>) => string; lessThanEqual: <K extends QueryableKeys<KylrixTokenLedger>>(field: K, value: QueryableFieldValue<KylrixTokenLedger, K>) => string; greaterThan: <K extends QueryableKeys<KylrixTokenLedger>>(field: K, value: QueryableFieldValue<KylrixTokenLedger, K>) => string; greaterThanEqual: <K extends QueryableKeys<KylrixTokenLedger>>(field: K, value: QueryableFieldValue<KylrixTokenLedger, K>) => string; contains: <K extends QueryableKeys<KylrixTokenLedger>>(field: K, value: QueryableFieldValue<KylrixTokenLedger, K>) => string; search: <K extends QueryableKeys<KylrixTokenLedger>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<KylrixTokenLedger>>(field: K) => string; isNotNull: <K extends QueryableKeys<KylrixTokenLedger>>(field: K) => string; startsWith: <K extends QueryableKeys<KylrixTokenLedger>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<KylrixTokenLedger>>(field: K, value: string) => string; between: <K extends QueryableKeys<KylrixTokenLedger>>(field: K, start: QueryableFieldValue<KylrixTokenLedger, K>, end: QueryableFieldValue<KylrixTokenLedger, K>) => string; select: <K extends keyof KylrixTokenLedger>(fields: K[]) => string; orderAsc: <K extends keyof KylrixTokenLedger>(field: K) => string; orderDesc: <K extends keyof KylrixTokenLedger>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: KylrixTokenLedger[] }>;
    };
    "engagement_views": {
      create: (data: {
        "rowType": string;
        "eventId": string;
        "idempotencyKey": string;
        "appId": string;
        "contentType": string;
        "contentId": string;
        "ownerUserId"?: string | null;
        "viewerKind": string;
        "viewerUserId"?: string | null;
        "viewerTokenHash"?: string | null;
        "fingerprintHash"?: string | null;
        "ipHash"?: string | null;
        "uaHash"?: string | null;
        "conversationId"?: string | null;
        "messageId"?: string | null;
        "receiptType"?: string | null;
        "isCounted"?: boolean;
        "bucketDay": string;
        "bucketMonth": string;
        "occurredAt": string;
        "metadata"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<EngagementViews>;
      get: (id: string) => Promise<EngagementViews>;
      update: (id: string, data: Partial<{
        "rowType": string;
        "eventId": string;
        "idempotencyKey": string;
        "appId": string;
        "contentType": string;
        "contentId": string;
        "ownerUserId"?: string | null;
        "viewerKind": string;
        "viewerUserId"?: string | null;
        "viewerTokenHash"?: string | null;
        "fingerprintHash"?: string | null;
        "ipHash"?: string | null;
        "uaHash"?: string | null;
        "conversationId"?: string | null;
        "messageId"?: string | null;
        "receiptType"?: string | null;
        "isCounted"?: boolean;
        "bucketDay": string;
        "bucketMonth": string;
        "occurredAt": string;
        "metadata"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<EngagementViews>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<EngagementViews>>(field: K, value: QueryableFieldValue<EngagementViews, K>) => string; notEqual: <K extends QueryableKeys<EngagementViews>>(field: K, value: QueryableFieldValue<EngagementViews, K>) => string; lessThan: <K extends QueryableKeys<EngagementViews>>(field: K, value: QueryableFieldValue<EngagementViews, K>) => string; lessThanEqual: <K extends QueryableKeys<EngagementViews>>(field: K, value: QueryableFieldValue<EngagementViews, K>) => string; greaterThan: <K extends QueryableKeys<EngagementViews>>(field: K, value: QueryableFieldValue<EngagementViews, K>) => string; greaterThanEqual: <K extends QueryableKeys<EngagementViews>>(field: K, value: QueryableFieldValue<EngagementViews, K>) => string; contains: <K extends QueryableKeys<EngagementViews>>(field: K, value: QueryableFieldValue<EngagementViews, K>) => string; search: <K extends QueryableKeys<EngagementViews>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<EngagementViews>>(field: K) => string; isNotNull: <K extends QueryableKeys<EngagementViews>>(field: K) => string; startsWith: <K extends QueryableKeys<EngagementViews>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<EngagementViews>>(field: K, value: string) => string; between: <K extends QueryableKeys<EngagementViews>>(field: K, start: QueryableFieldValue<EngagementViews, K>, end: QueryableFieldValue<EngagementViews, K>) => string; select: <K extends keyof EngagementViews>(fields: K[]) => string; orderAsc: <K extends keyof EngagementViews>(field: K) => string; orderDesc: <K extends keyof EngagementViews>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: EngagementViews[] }>;
    };
    "engagement_view_rollups": {
      create: (data: {
        "rowType": string;
        "rollupKey": string;
        "metricType": string;
        "appId": string;
        "scopeType": string;
        "scopeId": string;
        "contentType"?: string | null;
        "contentId"?: string | null;
        "ownerUserId"?: string | null;
        "bucketDay": string;
        "bucketMonth": string;
        "uniqueViewCount"?: number;
        "totalViewCount"?: number;
        "receiptCount"?: number;
        "weightedScore"?: number;
        "trustScore"?: number;
        "lastEventAt"?: string | null;
        "updatedAt": string;
        "metadata"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<EngagementViewRollups>;
      get: (id: string) => Promise<EngagementViewRollups>;
      update: (id: string, data: Partial<{
        "rowType": string;
        "rollupKey": string;
        "metricType": string;
        "appId": string;
        "scopeType": string;
        "scopeId": string;
        "contentType"?: string | null;
        "contentId"?: string | null;
        "ownerUserId"?: string | null;
        "bucketDay": string;
        "bucketMonth": string;
        "uniqueViewCount"?: number;
        "totalViewCount"?: number;
        "receiptCount"?: number;
        "weightedScore"?: number;
        "trustScore"?: number;
        "lastEventAt"?: string | null;
        "updatedAt": string;
        "metadata"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<EngagementViewRollups>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<EngagementViewRollups>>(field: K, value: QueryableFieldValue<EngagementViewRollups, K>) => string; notEqual: <K extends QueryableKeys<EngagementViewRollups>>(field: K, value: QueryableFieldValue<EngagementViewRollups, K>) => string; lessThan: <K extends QueryableKeys<EngagementViewRollups>>(field: K, value: QueryableFieldValue<EngagementViewRollups, K>) => string; lessThanEqual: <K extends QueryableKeys<EngagementViewRollups>>(field: K, value: QueryableFieldValue<EngagementViewRollups, K>) => string; greaterThan: <K extends QueryableKeys<EngagementViewRollups>>(field: K, value: QueryableFieldValue<EngagementViewRollups, K>) => string; greaterThanEqual: <K extends QueryableKeys<EngagementViewRollups>>(field: K, value: QueryableFieldValue<EngagementViewRollups, K>) => string; contains: <K extends QueryableKeys<EngagementViewRollups>>(field: K, value: QueryableFieldValue<EngagementViewRollups, K>) => string; search: <K extends QueryableKeys<EngagementViewRollups>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<EngagementViewRollups>>(field: K) => string; isNotNull: <K extends QueryableKeys<EngagementViewRollups>>(field: K) => string; startsWith: <K extends QueryableKeys<EngagementViewRollups>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<EngagementViewRollups>>(field: K, value: string) => string; between: <K extends QueryableKeys<EngagementViewRollups>>(field: K, start: QueryableFieldValue<EngagementViewRollups, K>, end: QueryableFieldValue<EngagementViewRollups, K>) => string; select: <K extends keyof EngagementViewRollups>(fields: K[]) => string; orderAsc: <K extends keyof EngagementViewRollups>(field: K) => string; orderDesc: <K extends keyof EngagementViewRollups>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: EngagementViewRollups[] }>;
    };
    "account_ledger": {
      create: (data: {
        "userId": string;
        "attentionBalance"?: number | null;
        "successTaxRate"?: number | null;
        "reputationScore"?: number | null;
        "lastPeakVelocity"?: number | null;
        "thermalCacheScore"?: number | null;
        "updatedAt"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<AccountLedger>;
      get: (id: string) => Promise<AccountLedger>;
      update: (id: string, data: Partial<{
        "userId": string;
        "attentionBalance"?: number | null;
        "successTaxRate"?: number | null;
        "reputationScore"?: number | null;
        "lastPeakVelocity"?: number | null;
        "thermalCacheScore"?: number | null;
        "updatedAt"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<AccountLedger>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<AccountLedger>>(field: K, value: QueryableFieldValue<AccountLedger, K>) => string; notEqual: <K extends QueryableKeys<AccountLedger>>(field: K, value: QueryableFieldValue<AccountLedger, K>) => string; lessThan: <K extends QueryableKeys<AccountLedger>>(field: K, value: QueryableFieldValue<AccountLedger, K>) => string; lessThanEqual: <K extends QueryableKeys<AccountLedger>>(field: K, value: QueryableFieldValue<AccountLedger, K>) => string; greaterThan: <K extends QueryableKeys<AccountLedger>>(field: K, value: QueryableFieldValue<AccountLedger, K>) => string; greaterThanEqual: <K extends QueryableKeys<AccountLedger>>(field: K, value: QueryableFieldValue<AccountLedger, K>) => string; contains: <K extends QueryableKeys<AccountLedger>>(field: K, value: QueryableFieldValue<AccountLedger, K>) => string; search: <K extends QueryableKeys<AccountLedger>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<AccountLedger>>(field: K) => string; isNotNull: <K extends QueryableKeys<AccountLedger>>(field: K) => string; startsWith: <K extends QueryableKeys<AccountLedger>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<AccountLedger>>(field: K, value: string) => string; between: <K extends QueryableKeys<AccountLedger>>(field: K, start: QueryableFieldValue<AccountLedger, K>, end: QueryableFieldValue<AccountLedger, K>) => string; select: <K extends keyof AccountLedger>(fields: K[]) => string; orderAsc: <K extends keyof AccountLedger>(field: K) => string; orderDesc: <K extends keyof AccountLedger>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: AccountLedger[] }>;
    };
    "system_pulse": {
      create: (data: {
        "metricKey": string;
        "metricValue": number;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<SystemPulse>;
      get: (id: string) => Promise<SystemPulse>;
      update: (id: string, data: Partial<{
        "metricKey": string;
        "metricValue": number;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<SystemPulse>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<SystemPulse>>(field: K, value: QueryableFieldValue<SystemPulse, K>) => string; notEqual: <K extends QueryableKeys<SystemPulse>>(field: K, value: QueryableFieldValue<SystemPulse, K>) => string; lessThan: <K extends QueryableKeys<SystemPulse>>(field: K, value: QueryableFieldValue<SystemPulse, K>) => string; lessThanEqual: <K extends QueryableKeys<SystemPulse>>(field: K, value: QueryableFieldValue<SystemPulse, K>) => string; greaterThan: <K extends QueryableKeys<SystemPulse>>(field: K, value: QueryableFieldValue<SystemPulse, K>) => string; greaterThanEqual: <K extends QueryableKeys<SystemPulse>>(field: K, value: QueryableFieldValue<SystemPulse, K>) => string; contains: <K extends QueryableKeys<SystemPulse>>(field: K, value: QueryableFieldValue<SystemPulse, K>) => string; search: <K extends QueryableKeys<SystemPulse>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<SystemPulse>>(field: K) => string; isNotNull: <K extends QueryableKeys<SystemPulse>>(field: K) => string; startsWith: <K extends QueryableKeys<SystemPulse>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<SystemPulse>>(field: K, value: string) => string; between: <K extends QueryableKeys<SystemPulse>>(field: K, start: QueryableFieldValue<SystemPulse, K>, end: QueryableFieldValue<SystemPulse, K>) => string; select: <K extends keyof SystemPulse>(fields: K[]) => string; orderAsc: <K extends keyof SystemPulse>(field: K) => string; orderDesc: <K extends keyof SystemPulse>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: SystemPulse[] }>;
    };
    "projects": {
      create: (data: {
        "title": string;
        "summary"?: string | null;
        "ownerId": string;
        "visibility"?: ProjectsVisibility;
        "status"?: ProjectsStatus;
        "metadata"?: string | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
        "isPinned"?: boolean | null;
        "isTrash"?: boolean;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Projects>;
      get: (id: string) => Promise<Projects>;
      update: (id: string, data: Partial<{
        "title": string;
        "summary"?: string | null;
        "ownerId": string;
        "visibility"?: ProjectsVisibility;
        "status"?: ProjectsStatus;
        "metadata"?: string | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
        "isPinned"?: boolean | null;
        "isTrash"?: boolean;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Projects>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Projects>>(field: K, value: QueryableFieldValue<Projects, K>) => string; notEqual: <K extends QueryableKeys<Projects>>(field: K, value: QueryableFieldValue<Projects, K>) => string; lessThan: <K extends QueryableKeys<Projects>>(field: K, value: QueryableFieldValue<Projects, K>) => string; lessThanEqual: <K extends QueryableKeys<Projects>>(field: K, value: QueryableFieldValue<Projects, K>) => string; greaterThan: <K extends QueryableKeys<Projects>>(field: K, value: QueryableFieldValue<Projects, K>) => string; greaterThanEqual: <K extends QueryableKeys<Projects>>(field: K, value: QueryableFieldValue<Projects, K>) => string; contains: <K extends QueryableKeys<Projects>>(field: K, value: QueryableFieldValue<Projects, K>) => string; search: <K extends QueryableKeys<Projects>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Projects>>(field: K) => string; isNotNull: <K extends QueryableKeys<Projects>>(field: K) => string; startsWith: <K extends QueryableKeys<Projects>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Projects>>(field: K, value: string) => string; between: <K extends QueryableKeys<Projects>>(field: K, start: QueryableFieldValue<Projects, K>, end: QueryableFieldValue<Projects, K>) => string; select: <K extends keyof Projects>(fields: K[]) => string; orderAsc: <K extends keyof Projects>(field: K) => string; orderDesc: <K extends keyof Projects>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Projects[] }>;
    };
    "project_objects": {
      create: (data: {
        "projectId": string;
        "entityKind": string;
        "entityId": string;
        "role"?: string | null;
        "metadata"?: string | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
        "isGeneral"?: boolean | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<ProjectObjects>;
      get: (id: string) => Promise<ProjectObjects>;
      update: (id: string, data: Partial<{
        "projectId": string;
        "entityKind": string;
        "entityId": string;
        "role"?: string | null;
        "metadata"?: string | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
        "isGeneral"?: boolean | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<ProjectObjects>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<ProjectObjects>>(field: K, value: QueryableFieldValue<ProjectObjects, K>) => string; notEqual: <K extends QueryableKeys<ProjectObjects>>(field: K, value: QueryableFieldValue<ProjectObjects, K>) => string; lessThan: <K extends QueryableKeys<ProjectObjects>>(field: K, value: QueryableFieldValue<ProjectObjects, K>) => string; lessThanEqual: <K extends QueryableKeys<ProjectObjects>>(field: K, value: QueryableFieldValue<ProjectObjects, K>) => string; greaterThan: <K extends QueryableKeys<ProjectObjects>>(field: K, value: QueryableFieldValue<ProjectObjects, K>) => string; greaterThanEqual: <K extends QueryableKeys<ProjectObjects>>(field: K, value: QueryableFieldValue<ProjectObjects, K>) => string; contains: <K extends QueryableKeys<ProjectObjects>>(field: K, value: QueryableFieldValue<ProjectObjects, K>) => string; search: <K extends QueryableKeys<ProjectObjects>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<ProjectObjects>>(field: K) => string; isNotNull: <K extends QueryableKeys<ProjectObjects>>(field: K) => string; startsWith: <K extends QueryableKeys<ProjectObjects>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<ProjectObjects>>(field: K, value: string) => string; between: <K extends QueryableKeys<ProjectObjects>>(field: K, start: QueryableFieldValue<ProjectObjects, K>, end: QueryableFieldValue<ProjectObjects, K>) => string; select: <K extends keyof ProjectObjects>(fields: K[]) => string; orderAsc: <K extends keyof ProjectObjects>(field: K) => string; orderDesc: <K extends keyof ProjectObjects>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: ProjectObjects[] }>;
    };
    "Telegram Connections": {
      create: (data: {
        "pair_code"?: string | null;
        "tg_chat_id"?: string | null;
        "tg_username"?: string | null;
        "is_verified": boolean;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<TelegramConnections>;
      get: (id: string) => Promise<TelegramConnections>;
      update: (id: string, data: Partial<{
        "pair_code"?: string | null;
        "tg_chat_id"?: string | null;
        "tg_username"?: string | null;
        "is_verified": boolean;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<TelegramConnections>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<TelegramConnections>>(field: K, value: QueryableFieldValue<TelegramConnections, K>) => string; notEqual: <K extends QueryableKeys<TelegramConnections>>(field: K, value: QueryableFieldValue<TelegramConnections, K>) => string; lessThan: <K extends QueryableKeys<TelegramConnections>>(field: K, value: QueryableFieldValue<TelegramConnections, K>) => string; lessThanEqual: <K extends QueryableKeys<TelegramConnections>>(field: K, value: QueryableFieldValue<TelegramConnections, K>) => string; greaterThan: <K extends QueryableKeys<TelegramConnections>>(field: K, value: QueryableFieldValue<TelegramConnections, K>) => string; greaterThanEqual: <K extends QueryableKeys<TelegramConnections>>(field: K, value: QueryableFieldValue<TelegramConnections, K>) => string; contains: <K extends QueryableKeys<TelegramConnections>>(field: K, value: QueryableFieldValue<TelegramConnections, K>) => string; search: <K extends QueryableKeys<TelegramConnections>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<TelegramConnections>>(field: K) => string; isNotNull: <K extends QueryableKeys<TelegramConnections>>(field: K) => string; startsWith: <K extends QueryableKeys<TelegramConnections>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<TelegramConnections>>(field: K, value: string) => string; between: <K extends QueryableKeys<TelegramConnections>>(field: K, start: QueryableFieldValue<TelegramConnections, K>, end: QueryableFieldValue<TelegramConnections, K>) => string; select: <K extends keyof TelegramConnections>(fields: K[]) => string; orderAsc: <K extends keyof TelegramConnections>(field: K) => string; orderDesc: <K extends keyof TelegramConnections>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: TelegramConnections[] }>;
    };
    "source_control": {
      create: (data: {
        "projectId": string;
        "provider": string;
        "repoName"?: string | null;
        "ownerName"?: string | null;
        "accessToken"?: string | null;
        "enabled"?: boolean;
        "metadata"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<SourceControl>;
      get: (id: string) => Promise<SourceControl>;
      update: (id: string, data: Partial<{
        "projectId": string;
        "provider": string;
        "repoName"?: string | null;
        "ownerName"?: string | null;
        "accessToken"?: string | null;
        "enabled"?: boolean;
        "metadata"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<SourceControl>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<SourceControl>>(field: K, value: QueryableFieldValue<SourceControl, K>) => string; notEqual: <K extends QueryableKeys<SourceControl>>(field: K, value: QueryableFieldValue<SourceControl, K>) => string; lessThan: <K extends QueryableKeys<SourceControl>>(field: K, value: QueryableFieldValue<SourceControl, K>) => string; lessThanEqual: <K extends QueryableKeys<SourceControl>>(field: K, value: QueryableFieldValue<SourceControl, K>) => string; greaterThan: <K extends QueryableKeys<SourceControl>>(field: K, value: QueryableFieldValue<SourceControl, K>) => string; greaterThanEqual: <K extends QueryableKeys<SourceControl>>(field: K, value: QueryableFieldValue<SourceControl, K>) => string; contains: <K extends QueryableKeys<SourceControl>>(field: K, value: QueryableFieldValue<SourceControl, K>) => string; search: <K extends QueryableKeys<SourceControl>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<SourceControl>>(field: K) => string; isNotNull: <K extends QueryableKeys<SourceControl>>(field: K) => string; startsWith: <K extends QueryableKeys<SourceControl>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<SourceControl>>(field: K, value: string) => string; between: <K extends QueryableKeys<SourceControl>>(field: K, start: QueryableFieldValue<SourceControl, K>, end: QueryableFieldValue<SourceControl, K>) => string; select: <K extends keyof SourceControl>(fields: K[]) => string; orderAsc: <K extends keyof SourceControl>(field: K) => string; orderDesc: <K extends keyof SourceControl>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: SourceControl[] }>;
    };
    "Call Signals": {
      create: (data: {
        "callId": string;
        "senderId": string;
        "type": CallSignalsType;
        "payload": string;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<CallSignals>;
      get: (id: string) => Promise<CallSignals>;
      update: (id: string, data: Partial<{
        "callId": string;
        "senderId": string;
        "type": CallSignalsType;
        "payload": string;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<CallSignals>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<CallSignals>>(field: K, value: QueryableFieldValue<CallSignals, K>) => string; notEqual: <K extends QueryableKeys<CallSignals>>(field: K, value: QueryableFieldValue<CallSignals, K>) => string; lessThan: <K extends QueryableKeys<CallSignals>>(field: K, value: QueryableFieldValue<CallSignals, K>) => string; lessThanEqual: <K extends QueryableKeys<CallSignals>>(field: K, value: QueryableFieldValue<CallSignals, K>) => string; greaterThan: <K extends QueryableKeys<CallSignals>>(field: K, value: QueryableFieldValue<CallSignals, K>) => string; greaterThanEqual: <K extends QueryableKeys<CallSignals>>(field: K, value: QueryableFieldValue<CallSignals, K>) => string; contains: <K extends QueryableKeys<CallSignals>>(field: K, value: QueryableFieldValue<CallSignals, K>) => string; search: <K extends QueryableKeys<CallSignals>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<CallSignals>>(field: K) => string; isNotNull: <K extends QueryableKeys<CallSignals>>(field: K) => string; startsWith: <K extends QueryableKeys<CallSignals>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<CallSignals>>(field: K, value: string) => string; between: <K extends QueryableKeys<CallSignals>>(field: K, start: QueryableFieldValue<CallSignals, K>, end: QueryableFieldValue<CallSignals, K>) => string; select: <K extends keyof CallSignals>(fields: K[]) => string; orderAsc: <K extends keyof CallSignals>(field: K) => string; orderDesc: <K extends keyof CallSignals>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: CallSignals[] }>;
    };
    "Account Events": {
      create: (data: {
        "type": string;
        "userId": string;
        "actorId": string;
        "relatedUserId"?: string | null;
        "status": AccountEventsStatus;
        "delta"?: string | null;
        "expiresAt"?: string | null;
        "metadata"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<AccountEvents>;
      get: (id: string) => Promise<AccountEvents>;
      update: (id: string, data: Partial<{
        "type": string;
        "userId": string;
        "actorId": string;
        "relatedUserId"?: string | null;
        "status": AccountEventsStatus;
        "delta"?: string | null;
        "expiresAt"?: string | null;
        "metadata"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<AccountEvents>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<AccountEvents>>(field: K, value: QueryableFieldValue<AccountEvents, K>) => string; notEqual: <K extends QueryableKeys<AccountEvents>>(field: K, value: QueryableFieldValue<AccountEvents, K>) => string; lessThan: <K extends QueryableKeys<AccountEvents>>(field: K, value: QueryableFieldValue<AccountEvents, K>) => string; lessThanEqual: <K extends QueryableKeys<AccountEvents>>(field: K, value: QueryableFieldValue<AccountEvents, K>) => string; greaterThan: <K extends QueryableKeys<AccountEvents>>(field: K, value: QueryableFieldValue<AccountEvents, K>) => string; greaterThanEqual: <K extends QueryableKeys<AccountEvents>>(field: K, value: QueryableFieldValue<AccountEvents, K>) => string; contains: <K extends QueryableKeys<AccountEvents>>(field: K, value: QueryableFieldValue<AccountEvents, K>) => string; search: <K extends QueryableKeys<AccountEvents>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<AccountEvents>>(field: K) => string; isNotNull: <K extends QueryableKeys<AccountEvents>>(field: K) => string; startsWith: <K extends QueryableKeys<AccountEvents>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<AccountEvents>>(field: K, value: string) => string; between: <K extends QueryableKeys<AccountEvents>>(field: K, start: QueryableFieldValue<AccountEvents, K>, end: QueryableFieldValue<AccountEvents, K>) => string; select: <K extends keyof AccountEvents>(fields: K[]) => string; orderAsc: <K extends keyof AccountEvents>(field: K) => string; orderDesc: <K extends keyof AccountEvents>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: AccountEvents[] }>;
    };
    "focusSessions": {
      create: (data: {
        "userId": string;
        "taskId"?: string | null;
        "startTime": string;
        "endTime"?: string | null;
        "status"?: string;
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<FocusSessions>;
      get: (id: string) => Promise<FocusSessions>;
      update: (id: string, data: Partial<{
        "userId": string;
        "taskId"?: string | null;
        "startTime": string;
        "endTime"?: string | null;
        "status"?: string;
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<FocusSessions>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<FocusSessions>>(field: K, value: QueryableFieldValue<FocusSessions, K>) => string; notEqual: <K extends QueryableKeys<FocusSessions>>(field: K, value: QueryableFieldValue<FocusSessions, K>) => string; lessThan: <K extends QueryableKeys<FocusSessions>>(field: K, value: QueryableFieldValue<FocusSessions, K>) => string; lessThanEqual: <K extends QueryableKeys<FocusSessions>>(field: K, value: QueryableFieldValue<FocusSessions, K>) => string; greaterThan: <K extends QueryableKeys<FocusSessions>>(field: K, value: QueryableFieldValue<FocusSessions, K>) => string; greaterThanEqual: <K extends QueryableKeys<FocusSessions>>(field: K, value: QueryableFieldValue<FocusSessions, K>) => string; contains: <K extends QueryableKeys<FocusSessions>>(field: K, value: QueryableFieldValue<FocusSessions, K>) => string; search: <K extends QueryableKeys<FocusSessions>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<FocusSessions>>(field: K) => string; isNotNull: <K extends QueryableKeys<FocusSessions>>(field: K) => string; startsWith: <K extends QueryableKeys<FocusSessions>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<FocusSessions>>(field: K, value: string) => string; between: <K extends QueryableKeys<FocusSessions>>(field: K, start: QueryableFieldValue<FocusSessions, K>, end: QueryableFieldValue<FocusSessions, K>) => string; select: <K extends keyof FocusSessions>(fields: K[]) => string; orderAsc: <K extends keyof FocusSessions>(field: K) => string; orderDesc: <K extends keyof FocusSessions>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: FocusSessions[] }>;
    };
    "eventGuests": {
      create: (data: {
        "eventId": string;
        "userId"?: string | null;
        "email"?: string | null;
        "status"?: string;
        "role"?: string;
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<EventGuests>;
      get: (id: string) => Promise<EventGuests>;
      update: (id: string, data: Partial<{
        "eventId": string;
        "userId"?: string | null;
        "email"?: string | null;
        "status"?: string;
        "role"?: string;
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<EventGuests>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<EventGuests>>(field: K, value: QueryableFieldValue<EventGuests, K>) => string; notEqual: <K extends QueryableKeys<EventGuests>>(field: K, value: QueryableFieldValue<EventGuests, K>) => string; lessThan: <K extends QueryableKeys<EventGuests>>(field: K, value: QueryableFieldValue<EventGuests, K>) => string; lessThanEqual: <K extends QueryableKeys<EventGuests>>(field: K, value: QueryableFieldValue<EventGuests, K>) => string; greaterThan: <K extends QueryableKeys<EventGuests>>(field: K, value: QueryableFieldValue<EventGuests, K>) => string; greaterThanEqual: <K extends QueryableKeys<EventGuests>>(field: K, value: QueryableFieldValue<EventGuests, K>) => string; contains: <K extends QueryableKeys<EventGuests>>(field: K, value: QueryableFieldValue<EventGuests, K>) => string; search: <K extends QueryableKeys<EventGuests>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<EventGuests>>(field: K) => string; isNotNull: <K extends QueryableKeys<EventGuests>>(field: K) => string; startsWith: <K extends QueryableKeys<EventGuests>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<EventGuests>>(field: K, value: string) => string; between: <K extends QueryableKeys<EventGuests>>(field: K, start: QueryableFieldValue<EventGuests, K>, end: QueryableFieldValue<EventGuests, K>) => string; select: <K extends keyof EventGuests>(fields: K[]) => string; orderAsc: <K extends keyof EventGuests>(field: K) => string; orderDesc: <K extends keyof EventGuests>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: EventGuests[] }>;
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
        "recurrenceRule"?: string | null;
        "calendarId": string;
        "userId": string;
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
        "isPinned"?: boolean | null;
        "source"?: string | null;
        "keepPermission"?: boolean | null;
        "isDeleted"?: boolean;
        "isTrash"?: boolean;
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
        "recurrenceRule"?: string | null;
        "calendarId": string;
        "userId": string;
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
        "isPinned"?: boolean | null;
        "source"?: string | null;
        "keepPermission"?: boolean | null;
        "isDeleted"?: boolean;
        "isTrash"?: boolean;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Events>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Events>>(field: K, value: QueryableFieldValue<Events, K>) => string; notEqual: <K extends QueryableKeys<Events>>(field: K, value: QueryableFieldValue<Events, K>) => string; lessThan: <K extends QueryableKeys<Events>>(field: K, value: QueryableFieldValue<Events, K>) => string; lessThanEqual: <K extends QueryableKeys<Events>>(field: K, value: QueryableFieldValue<Events, K>) => string; greaterThan: <K extends QueryableKeys<Events>>(field: K, value: QueryableFieldValue<Events, K>) => string; greaterThanEqual: <K extends QueryableKeys<Events>>(field: K, value: QueryableFieldValue<Events, K>) => string; contains: <K extends QueryableKeys<Events>>(field: K, value: QueryableFieldValue<Events, K>) => string; search: <K extends QueryableKeys<Events>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Events>>(field: K) => string; isNotNull: <K extends QueryableKeys<Events>>(field: K) => string; startsWith: <K extends QueryableKeys<Events>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Events>>(field: K, value: string) => string; between: <K extends QueryableKeys<Events>>(field: K, start: QueryableFieldValue<Events, K>, end: QueryableFieldValue<Events, K>) => string; select: <K extends keyof Events>(fields: K[]) => string; orderAsc: <K extends keyof Events>(field: K) => string; orderDesc: <K extends keyof Events>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Events[] }>;
    };
    "calendars": {
      create: (data: {
        "name": string;
        "color"?: string;
        "isDefault"?: boolean;
        "userId": string;
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
        "isPinned"?: boolean | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Calendars>;
      get: (id: string) => Promise<Calendars>;
      update: (id: string, data: Partial<{
        "name": string;
        "color"?: string;
        "isDefault"?: boolean;
        "userId": string;
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
        "isPinned"?: boolean | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Calendars>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Calendars>>(field: K, value: QueryableFieldValue<Calendars, K>) => string; notEqual: <K extends QueryableKeys<Calendars>>(field: K, value: QueryableFieldValue<Calendars, K>) => string; lessThan: <K extends QueryableKeys<Calendars>>(field: K, value: QueryableFieldValue<Calendars, K>) => string; lessThanEqual: <K extends QueryableKeys<Calendars>>(field: K, value: QueryableFieldValue<Calendars, K>) => string; greaterThan: <K extends QueryableKeys<Calendars>>(field: K, value: QueryableFieldValue<Calendars, K>) => string; greaterThanEqual: <K extends QueryableKeys<Calendars>>(field: K, value: QueryableFieldValue<Calendars, K>) => string; contains: <K extends QueryableKeys<Calendars>>(field: K, value: QueryableFieldValue<Calendars, K>) => string; search: <K extends QueryableKeys<Calendars>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Calendars>>(field: K) => string; isNotNull: <K extends QueryableKeys<Calendars>>(field: K) => string; startsWith: <K extends QueryableKeys<Calendars>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Calendars>>(field: K, value: string) => string; between: <K extends QueryableKeys<Calendars>>(field: K, start: QueryableFieldValue<Calendars, K>, end: QueryableFieldValue<Calendars, K>) => string; select: <K extends keyof Calendars>(fields: K[]) => string; orderAsc: <K extends keyof Calendars>(field: K) => string; orderDesc: <K extends keyof Calendars>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Calendars[] }>;
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
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
        "isPinned"?: boolean | null;
        "source"?: string | null;
        "keepPermission"?: boolean | null;
        "isArchived"?: boolean | null;
        "comments"?: string[] | null;
        "discussionId"?: string | null;
        "isDeleted"?: boolean;
        "scheduled"?: boolean;
        "isTrash"?: boolean;
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
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
        "isPinned"?: boolean | null;
        "source"?: string | null;
        "keepPermission"?: boolean | null;
        "isArchived"?: boolean | null;
        "comments"?: string[] | null;
        "discussionId"?: string | null;
        "isDeleted"?: boolean;
        "scheduled"?: boolean;
        "isTrash"?: boolean;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Tasks>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Tasks>>(field: K, value: QueryableFieldValue<Tasks, K>) => string; notEqual: <K extends QueryableKeys<Tasks>>(field: K, value: QueryableFieldValue<Tasks, K>) => string; lessThan: <K extends QueryableKeys<Tasks>>(field: K, value: QueryableFieldValue<Tasks, K>) => string; lessThanEqual: <K extends QueryableKeys<Tasks>>(field: K, value: QueryableFieldValue<Tasks, K>) => string; greaterThan: <K extends QueryableKeys<Tasks>>(field: K, value: QueryableFieldValue<Tasks, K>) => string; greaterThanEqual: <K extends QueryableKeys<Tasks>>(field: K, value: QueryableFieldValue<Tasks, K>) => string; contains: <K extends QueryableKeys<Tasks>>(field: K, value: QueryableFieldValue<Tasks, K>) => string; search: <K extends QueryableKeys<Tasks>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Tasks>>(field: K) => string; isNotNull: <K extends QueryableKeys<Tasks>>(field: K) => string; startsWith: <K extends QueryableKeys<Tasks>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Tasks>>(field: K, value: string) => string; between: <K extends QueryableKeys<Tasks>>(field: K, start: QueryableFieldValue<Tasks, K>, end: QueryableFieldValue<Tasks, K>) => string; select: <K extends keyof Tasks>(fields: K[]) => string; orderAsc: <K extends keyof Tasks>(field: K) => string; orderDesc: <K extends keyof Tasks>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Tasks[] }>;
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
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
        "isPinned"?: boolean | null;
        "source"?: string | null;
        "keepPermission"?: boolean | null;
        "isTrash"?: boolean;
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
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
        "isPinned"?: boolean | null;
        "source"?: string | null;
        "keepPermission"?: boolean | null;
        "isTrash"?: boolean;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Forms>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Forms>>(field: K, value: QueryableFieldValue<Forms, K>) => string; notEqual: <K extends QueryableKeys<Forms>>(field: K, value: QueryableFieldValue<Forms, K>) => string; lessThan: <K extends QueryableKeys<Forms>>(field: K, value: QueryableFieldValue<Forms, K>) => string; lessThanEqual: <K extends QueryableKeys<Forms>>(field: K, value: QueryableFieldValue<Forms, K>) => string; greaterThan: <K extends QueryableKeys<Forms>>(field: K, value: QueryableFieldValue<Forms, K>) => string; greaterThanEqual: <K extends QueryableKeys<Forms>>(field: K, value: QueryableFieldValue<Forms, K>) => string; contains: <K extends QueryableKeys<Forms>>(field: K, value: QueryableFieldValue<Forms, K>) => string; search: <K extends QueryableKeys<Forms>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Forms>>(field: K) => string; isNotNull: <K extends QueryableKeys<Forms>>(field: K) => string; startsWith: <K extends QueryableKeys<Forms>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Forms>>(field: K, value: string) => string; between: <K extends QueryableKeys<Forms>>(field: K, start: QueryableFieldValue<Forms, K>, end: QueryableFieldValue<Forms, K>) => string; select: <K extends keyof Forms>(fields: K[]) => string; orderAsc: <K extends keyof Forms>(field: K) => string; orderDesc: <K extends keyof Forms>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Forms[] }>;
    };
    "formSubmissions": {
      create: (data: {
        "formId": string;
        "submitterId"?: string | null;
        "payload": string;
        "status"?: FormSubmissionsStatus;
        "metadata"?: string | null;
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
        "source"?: string | null;
        "isTrash"?: boolean;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<FormSubmissions>;
      get: (id: string) => Promise<FormSubmissions>;
      update: (id: string, data: Partial<{
        "formId": string;
        "submitterId"?: string | null;
        "payload": string;
        "status"?: FormSubmissionsStatus;
        "metadata"?: string | null;
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
        "source"?: string | null;
        "isTrash"?: boolean;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<FormSubmissions>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<FormSubmissions>>(field: K, value: QueryableFieldValue<FormSubmissions, K>) => string; notEqual: <K extends QueryableKeys<FormSubmissions>>(field: K, value: QueryableFieldValue<FormSubmissions, K>) => string; lessThan: <K extends QueryableKeys<FormSubmissions>>(field: K, value: QueryableFieldValue<FormSubmissions, K>) => string; lessThanEqual: <K extends QueryableKeys<FormSubmissions>>(field: K, value: QueryableFieldValue<FormSubmissions, K>) => string; greaterThan: <K extends QueryableKeys<FormSubmissions>>(field: K, value: QueryableFieldValue<FormSubmissions, K>) => string; greaterThanEqual: <K extends QueryableKeys<FormSubmissions>>(field: K, value: QueryableFieldValue<FormSubmissions, K>) => string; contains: <K extends QueryableKeys<FormSubmissions>>(field: K, value: QueryableFieldValue<FormSubmissions, K>) => string; search: <K extends QueryableKeys<FormSubmissions>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<FormSubmissions>>(field: K) => string; isNotNull: <K extends QueryableKeys<FormSubmissions>>(field: K) => string; startsWith: <K extends QueryableKeys<FormSubmissions>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<FormSubmissions>>(field: K, value: string) => string; between: <K extends QueryableKeys<FormSubmissions>>(field: K, start: QueryableFieldValue<FormSubmissions, K>, end: QueryableFieldValue<FormSubmissions, K>) => string; select: <K extends keyof FormSubmissions>(fields: K[]) => string; orderAsc: <K extends keyof FormSubmissions>(field: K) => string; orderDesc: <K extends keyof FormSubmissions>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: FormSubmissions[] }>;
    };
    "agents": {
      create: (data: {
        "ownerId": string;
        "parentId"?: string | null;
        "publicKey": string;
        "config": string;
        "status"?: string;
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Agents>;
      get: (id: string) => Promise<Agents>;
      update: (id: string, data: Partial<{
        "ownerId": string;
        "parentId"?: string | null;
        "publicKey": string;
        "config": string;
        "status"?: string;
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Agents>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Agents>>(field: K, value: QueryableFieldValue<Agents, K>) => string; notEqual: <K extends QueryableKeys<Agents>>(field: K, value: QueryableFieldValue<Agents, K>) => string; lessThan: <K extends QueryableKeys<Agents>>(field: K, value: QueryableFieldValue<Agents, K>) => string; lessThanEqual: <K extends QueryableKeys<Agents>>(field: K, value: QueryableFieldValue<Agents, K>) => string; greaterThan: <K extends QueryableKeys<Agents>>(field: K, value: QueryableFieldValue<Agents, K>) => string; greaterThanEqual: <K extends QueryableKeys<Agents>>(field: K, value: QueryableFieldValue<Agents, K>) => string; contains: <K extends QueryableKeys<Agents>>(field: K, value: QueryableFieldValue<Agents, K>) => string; search: <K extends QueryableKeys<Agents>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Agents>>(field: K) => string; isNotNull: <K extends QueryableKeys<Agents>>(field: K) => string; startsWith: <K extends QueryableKeys<Agents>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Agents>>(field: K, value: string) => string; between: <K extends QueryableKeys<Agents>>(field: K, start: QueryableFieldValue<Agents, K>, end: QueryableFieldValue<Agents, K>) => string; select: <K extends keyof Agents>(fields: K[]) => string; orderAsc: <K extends keyof Agents>(field: K) => string; orderDesc: <K extends keyof Agents>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Agents[] }>;
    };
    "Collaborators": {
      create: (data: {
        "resourceId": string;
        "resourceType": string;
        "userId": string;
        "permission": CollaboratorsPermission;
        "inviterId"?: string | null;
        "status"?: CollaboratorsStatus;
        "invitedAt"?: string | null;
        "accepted"?: boolean | null;
        "expiresAt"?: string | null;
        "role"?: string | null;
        "metadata"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Collaborators>;
      get: (id: string) => Promise<Collaborators>;
      update: (id: string, data: Partial<{
        "resourceId": string;
        "resourceType": string;
        "userId": string;
        "permission": CollaboratorsPermission;
        "inviterId"?: string | null;
        "status"?: CollaboratorsStatus;
        "invitedAt"?: string | null;
        "accepted"?: boolean | null;
        "expiresAt"?: string | null;
        "role"?: string | null;
        "metadata"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Collaborators>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Collaborators>>(field: K, value: QueryableFieldValue<Collaborators, K>) => string; notEqual: <K extends QueryableKeys<Collaborators>>(field: K, value: QueryableFieldValue<Collaborators, K>) => string; lessThan: <K extends QueryableKeys<Collaborators>>(field: K, value: QueryableFieldValue<Collaborators, K>) => string; lessThanEqual: <K extends QueryableKeys<Collaborators>>(field: K, value: QueryableFieldValue<Collaborators, K>) => string; greaterThan: <K extends QueryableKeys<Collaborators>>(field: K, value: QueryableFieldValue<Collaborators, K>) => string; greaterThanEqual: <K extends QueryableKeys<Collaborators>>(field: K, value: QueryableFieldValue<Collaborators, K>) => string; contains: <K extends QueryableKeys<Collaborators>>(field: K, value: QueryableFieldValue<Collaborators, K>) => string; search: <K extends QueryableKeys<Collaborators>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Collaborators>>(field: K) => string; isNotNull: <K extends QueryableKeys<Collaborators>>(field: K) => string; startsWith: <K extends QueryableKeys<Collaborators>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Collaborators>>(field: K, value: string) => string; between: <K extends QueryableKeys<Collaborators>>(field: K, start: QueryableFieldValue<Collaborators, K>, end: QueryableFieldValue<Collaborators, K>) => string; select: <K extends keyof Collaborators>(fields: K[]) => string; orderAsc: <K extends keyof Collaborators>(field: K) => string; orderDesc: <K extends keyof Collaborators>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Collaborators[] }>;
    };
    "user_keys": {
      create: (data: {
        "userId": string;
        "provider": string;
        "encrypted_key": string;
        "iv": string;
        "config"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<UserKeys>;
      get: (id: string) => Promise<UserKeys>;
      update: (id: string, data: Partial<{
        "userId": string;
        "provider": string;
        "encrypted_key": string;
        "iv": string;
        "config"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<UserKeys>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<UserKeys>>(field: K, value: QueryableFieldValue<UserKeys, K>) => string; notEqual: <K extends QueryableKeys<UserKeys>>(field: K, value: QueryableFieldValue<UserKeys, K>) => string; lessThan: <K extends QueryableKeys<UserKeys>>(field: K, value: QueryableFieldValue<UserKeys, K>) => string; lessThanEqual: <K extends QueryableKeys<UserKeys>>(field: K, value: QueryableFieldValue<UserKeys, K>) => string; greaterThan: <K extends QueryableKeys<UserKeys>>(field: K, value: QueryableFieldValue<UserKeys, K>) => string; greaterThanEqual: <K extends QueryableKeys<UserKeys>>(field: K, value: QueryableFieldValue<UserKeys, K>) => string; contains: <K extends QueryableKeys<UserKeys>>(field: K, value: QueryableFieldValue<UserKeys, K>) => string; search: <K extends QueryableKeys<UserKeys>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<UserKeys>>(field: K) => string; isNotNull: <K extends QueryableKeys<UserKeys>>(field: K) => string; startsWith: <K extends QueryableKeys<UserKeys>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<UserKeys>>(field: K, value: string) => string; between: <K extends QueryableKeys<UserKeys>>(field: K, start: QueryableFieldValue<UserKeys, K>, end: QueryableFieldValue<UserKeys, K>) => string; select: <K extends keyof UserKeys>(fields: K[]) => string; orderAsc: <K extends keyof UserKeys>(field: K) => string; orderDesc: <K extends keyof UserKeys>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: UserKeys[] }>;
    };
    "compute_balances": {
      create: (data: {
        "userId": string;
        "tier": string;
        "lastResetAt"?: string | null;
        "balance"?: number;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<ComputeBalances>;
      get: (id: string) => Promise<ComputeBalances>;
      update: (id: string, data: Partial<{
        "userId": string;
        "tier": string;
        "lastResetAt"?: string | null;
        "balance"?: number;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<ComputeBalances>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<ComputeBalances>>(field: K, value: QueryableFieldValue<ComputeBalances, K>) => string; notEqual: <K extends QueryableKeys<ComputeBalances>>(field: K, value: QueryableFieldValue<ComputeBalances, K>) => string; lessThan: <K extends QueryableKeys<ComputeBalances>>(field: K, value: QueryableFieldValue<ComputeBalances, K>) => string; lessThanEqual: <K extends QueryableKeys<ComputeBalances>>(field: K, value: QueryableFieldValue<ComputeBalances, K>) => string; greaterThan: <K extends QueryableKeys<ComputeBalances>>(field: K, value: QueryableFieldValue<ComputeBalances, K>) => string; greaterThanEqual: <K extends QueryableKeys<ComputeBalances>>(field: K, value: QueryableFieldValue<ComputeBalances, K>) => string; contains: <K extends QueryableKeys<ComputeBalances>>(field: K, value: QueryableFieldValue<ComputeBalances, K>) => string; search: <K extends QueryableKeys<ComputeBalances>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<ComputeBalances>>(field: K) => string; isNotNull: <K extends QueryableKeys<ComputeBalances>>(field: K) => string; startsWith: <K extends QueryableKeys<ComputeBalances>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<ComputeBalances>>(field: K, value: string) => string; between: <K extends QueryableKeys<ComputeBalances>>(field: K, start: QueryableFieldValue<ComputeBalances, K>, end: QueryableFieldValue<ComputeBalances, K>) => string; select: <K extends keyof ComputeBalances>(fields: K[]) => string; orderAsc: <K extends keyof ComputeBalances>(field: K) => string; orderDesc: <K extends keyof ComputeBalances>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: ComputeBalances[] }>;
    };
    "compute_ledger": {
      create: (data: {
        "userId": string;
        "timestamp": string;
        "tokensConsumed"?: number;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<ComputeLedger>;
      get: (id: string) => Promise<ComputeLedger>;
      update: (id: string, data: Partial<{
        "userId": string;
        "timestamp": string;
        "tokensConsumed"?: number;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<ComputeLedger>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<ComputeLedger>>(field: K, value: QueryableFieldValue<ComputeLedger, K>) => string; notEqual: <K extends QueryableKeys<ComputeLedger>>(field: K, value: QueryableFieldValue<ComputeLedger, K>) => string; lessThan: <K extends QueryableKeys<ComputeLedger>>(field: K, value: QueryableFieldValue<ComputeLedger, K>) => string; lessThanEqual: <K extends QueryableKeys<ComputeLedger>>(field: K, value: QueryableFieldValue<ComputeLedger, K>) => string; greaterThan: <K extends QueryableKeys<ComputeLedger>>(field: K, value: QueryableFieldValue<ComputeLedger, K>) => string; greaterThanEqual: <K extends QueryableKeys<ComputeLedger>>(field: K, value: QueryableFieldValue<ComputeLedger, K>) => string; contains: <K extends QueryableKeys<ComputeLedger>>(field: K, value: QueryableFieldValue<ComputeLedger, K>) => string; search: <K extends QueryableKeys<ComputeLedger>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<ComputeLedger>>(field: K) => string; isNotNull: <K extends QueryableKeys<ComputeLedger>>(field: K) => string; startsWith: <K extends QueryableKeys<ComputeLedger>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<ComputeLedger>>(field: K, value: string) => string; between: <K extends QueryableKeys<ComputeLedger>>(field: K, start: QueryableFieldValue<ComputeLedger, K>, end: QueryableFieldValue<ComputeLedger, K>) => string; select: <K extends keyof ComputeLedger>(fields: K[]) => string; orderAsc: <K extends keyof ComputeLedger>(field: K) => string; orderDesc: <K extends keyof ComputeLedger>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: ComputeLedger[] }>;
    };
    "action_threads": {
      create: (data: {
        "threadId": string;
        "parentThreadId"?: string | null;
        "niche": string;
        "app": string;
        "status"?: ActionThreadsStatus;
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<ActionThreads>;
      get: (id: string) => Promise<ActionThreads>;
      update: (id: string, data: Partial<{
        "threadId": string;
        "parentThreadId"?: string | null;
        "niche": string;
        "app": string;
        "status"?: ActionThreadsStatus;
        "isPublic"?: boolean | null;
        "isGuest"?: boolean | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<ActionThreads>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<ActionThreads>>(field: K, value: QueryableFieldValue<ActionThreads, K>) => string; notEqual: <K extends QueryableKeys<ActionThreads>>(field: K, value: QueryableFieldValue<ActionThreads, K>) => string; lessThan: <K extends QueryableKeys<ActionThreads>>(field: K, value: QueryableFieldValue<ActionThreads, K>) => string; lessThanEqual: <K extends QueryableKeys<ActionThreads>>(field: K, value: QueryableFieldValue<ActionThreads, K>) => string; greaterThan: <K extends QueryableKeys<ActionThreads>>(field: K, value: QueryableFieldValue<ActionThreads, K>) => string; greaterThanEqual: <K extends QueryableKeys<ActionThreads>>(field: K, value: QueryableFieldValue<ActionThreads, K>) => string; contains: <K extends QueryableKeys<ActionThreads>>(field: K, value: QueryableFieldValue<ActionThreads, K>) => string; search: <K extends QueryableKeys<ActionThreads>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<ActionThreads>>(field: K) => string; isNotNull: <K extends QueryableKeys<ActionThreads>>(field: K) => string; startsWith: <K extends QueryableKeys<ActionThreads>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<ActionThreads>>(field: K, value: string) => string; between: <K extends QueryableKeys<ActionThreads>>(field: K, start: QueryableFieldValue<ActionThreads, K>, end: QueryableFieldValue<ActionThreads, K>) => string; select: <K extends keyof ActionThreads>(fields: K[]) => string; orderAsc: <K extends keyof ActionThreads>(field: K) => string; orderDesc: <K extends keyof ActionThreads>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: ActionThreads[] }>;
    };
    "app_activity_logs": {
      create: (data: {
        "userId": string;
        "niche": string;
        "app": string;
        "action": string;
        "threadId"?: string | null;
        "metadata"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<AppActivityLogs>;
      get: (id: string) => Promise<AppActivityLogs>;
      update: (id: string, data: Partial<{
        "userId": string;
        "niche": string;
        "app": string;
        "action": string;
        "threadId"?: string | null;
        "metadata"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<AppActivityLogs>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<AppActivityLogs>>(field: K, value: QueryableFieldValue<AppActivityLogs, K>) => string; notEqual: <K extends QueryableKeys<AppActivityLogs>>(field: K, value: QueryableFieldValue<AppActivityLogs, K>) => string; lessThan: <K extends QueryableKeys<AppActivityLogs>>(field: K, value: QueryableFieldValue<AppActivityLogs, K>) => string; lessThanEqual: <K extends QueryableKeys<AppActivityLogs>>(field: K, value: QueryableFieldValue<AppActivityLogs, K>) => string; greaterThan: <K extends QueryableKeys<AppActivityLogs>>(field: K, value: QueryableFieldValue<AppActivityLogs, K>) => string; greaterThanEqual: <K extends QueryableKeys<AppActivityLogs>>(field: K, value: QueryableFieldValue<AppActivityLogs, K>) => string; contains: <K extends QueryableKeys<AppActivityLogs>>(field: K, value: QueryableFieldValue<AppActivityLogs, K>) => string; search: <K extends QueryableKeys<AppActivityLogs>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<AppActivityLogs>>(field: K) => string; isNotNull: <K extends QueryableKeys<AppActivityLogs>>(field: K) => string; startsWith: <K extends QueryableKeys<AppActivityLogs>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<AppActivityLogs>>(field: K, value: string) => string; between: <K extends QueryableKeys<AppActivityLogs>>(field: K, start: QueryableFieldValue<AppActivityLogs, K>, end: QueryableFieldValue<AppActivityLogs, K>) => string; select: <K extends keyof AppActivityLogs>(fields: K[]) => string; orderAsc: <K extends keyof AppActivityLogs>(field: K) => string; orderDesc: <K extends keyof AppActivityLogs>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: AppActivityLogs[] }>;
    };
    "anonymized_telemetry": {
      create: (data: {
        "niche": string;
        "app": string;
        "action": string;
        "intent"?: string | null;
        "threadId"?: string | null;
        "metadata"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<AnonymizedTelemetry>;
      get: (id: string) => Promise<AnonymizedTelemetry>;
      update: (id: string, data: Partial<{
        "niche": string;
        "app": string;
        "action": string;
        "intent"?: string | null;
        "threadId"?: string | null;
        "metadata"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<AnonymizedTelemetry>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<AnonymizedTelemetry>>(field: K, value: QueryableFieldValue<AnonymizedTelemetry, K>) => string; notEqual: <K extends QueryableKeys<AnonymizedTelemetry>>(field: K, value: QueryableFieldValue<AnonymizedTelemetry, K>) => string; lessThan: <K extends QueryableKeys<AnonymizedTelemetry>>(field: K, value: QueryableFieldValue<AnonymizedTelemetry, K>) => string; lessThanEqual: <K extends QueryableKeys<AnonymizedTelemetry>>(field: K, value: QueryableFieldValue<AnonymizedTelemetry, K>) => string; greaterThan: <K extends QueryableKeys<AnonymizedTelemetry>>(field: K, value: QueryableFieldValue<AnonymizedTelemetry, K>) => string; greaterThanEqual: <K extends QueryableKeys<AnonymizedTelemetry>>(field: K, value: QueryableFieldValue<AnonymizedTelemetry, K>) => string; contains: <K extends QueryableKeys<AnonymizedTelemetry>>(field: K, value: QueryableFieldValue<AnonymizedTelemetry, K>) => string; search: <K extends QueryableKeys<AnonymizedTelemetry>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<AnonymizedTelemetry>>(field: K) => string; isNotNull: <K extends QueryableKeys<AnonymizedTelemetry>>(field: K) => string; startsWith: <K extends QueryableKeys<AnonymizedTelemetry>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<AnonymizedTelemetry>>(field: K, value: string) => string; between: <K extends QueryableKeys<AnonymizedTelemetry>>(field: K, start: QueryableFieldValue<AnonymizedTelemetry, K>, end: QueryableFieldValue<AnonymizedTelemetry, K>) => string; select: <K extends keyof AnonymizedTelemetry>(fields: K[]) => string; orderAsc: <K extends keyof AnonymizedTelemetry>(field: K) => string; orderDesc: <K extends keyof AnonymizedTelemetry>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: AnonymizedTelemetry[] }>;
    };
    "notifications": {
      create: (data: {
        "originatorId": string;
        "targets": string[];
        "targetPointer"?: string | null;
        "type"?: NotificationsType;
        "metadata"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Notifications>;
      get: (id: string) => Promise<Notifications>;
      update: (id: string, data: Partial<{
        "originatorId": string;
        "targets": string[];
        "targetPointer"?: string | null;
        "type"?: NotificationsType;
        "metadata"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Notifications>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Notifications>>(field: K, value: QueryableFieldValue<Notifications, K>) => string; notEqual: <K extends QueryableKeys<Notifications>>(field: K, value: QueryableFieldValue<Notifications, K>) => string; lessThan: <K extends QueryableKeys<Notifications>>(field: K, value: QueryableFieldValue<Notifications, K>) => string; lessThanEqual: <K extends QueryableKeys<Notifications>>(field: K, value: QueryableFieldValue<Notifications, K>) => string; greaterThan: <K extends QueryableKeys<Notifications>>(field: K, value: QueryableFieldValue<Notifications, K>) => string; greaterThanEqual: <K extends QueryableKeys<Notifications>>(field: K, value: QueryableFieldValue<Notifications, K>) => string; contains: <K extends QueryableKeys<Notifications>>(field: K, value: QueryableFieldValue<Notifications, K>) => string; search: <K extends QueryableKeys<Notifications>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Notifications>>(field: K) => string; isNotNull: <K extends QueryableKeys<Notifications>>(field: K) => string; startsWith: <K extends QueryableKeys<Notifications>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Notifications>>(field: K, value: string) => string; between: <K extends QueryableKeys<Notifications>>(field: K, start: QueryableFieldValue<Notifications, K>, end: QueryableFieldValue<Notifications, K>) => string; select: <K extends keyof Notifications>(fields: K[]) => string; orderAsc: <K extends keyof Notifications>(field: K) => string; orderDesc: <K extends keyof Notifications>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Notifications[] }>;
    };
    "workflows": {
      create: (data: {
        "workflowId": string;
        "name": string;
        "description"?: string | null;
        "niche": string;
        "isPublic"?: boolean;
        "isAnonymized"?: boolean;
        "steps": string;
        "metadata"?: string | null;
        "isGuest"?: boolean | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Workflows>;
      get: (id: string) => Promise<Workflows>;
      update: (id: string, data: Partial<{
        "workflowId": string;
        "name": string;
        "description"?: string | null;
        "niche": string;
        "isPublic"?: boolean;
        "isAnonymized"?: boolean;
        "steps": string;
        "metadata"?: string | null;
        "isGuest"?: boolean | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Workflows>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Workflows>>(field: K, value: QueryableFieldValue<Workflows, K>) => string; notEqual: <K extends QueryableKeys<Workflows>>(field: K, value: QueryableFieldValue<Workflows, K>) => string; lessThan: <K extends QueryableKeys<Workflows>>(field: K, value: QueryableFieldValue<Workflows, K>) => string; lessThanEqual: <K extends QueryableKeys<Workflows>>(field: K, value: QueryableFieldValue<Workflows, K>) => string; greaterThan: <K extends QueryableKeys<Workflows>>(field: K, value: QueryableFieldValue<Workflows, K>) => string; greaterThanEqual: <K extends QueryableKeys<Workflows>>(field: K, value: QueryableFieldValue<Workflows, K>) => string; contains: <K extends QueryableKeys<Workflows>>(field: K, value: QueryableFieldValue<Workflows, K>) => string; search: <K extends QueryableKeys<Workflows>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Workflows>>(field: K) => string; isNotNull: <K extends QueryableKeys<Workflows>>(field: K) => string; startsWith: <K extends QueryableKeys<Workflows>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Workflows>>(field: K, value: string) => string; between: <K extends QueryableKeys<Workflows>>(field: K, start: QueryableFieldValue<Workflows, K>, end: QueryableFieldValue<Workflows, K>) => string; select: <K extends keyof Workflows>(fields: K[]) => string; orderAsc: <K extends keyof Workflows>(field: K) => string; orderDesc: <K extends keyof Workflows>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Workflows[] }>;
    };
    "objects": {
      create: (data: {
        "parentId": string;
        "parentKind": string;
        "childId": string;
        "childKind": string;
        "metadata"?: string | null;
        "userId": string;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
        "isPublic"?: boolean;
        "isGuest"?: boolean;
        "isGeneral"?: boolean;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Objects>;
      get: (id: string) => Promise<Objects>;
      update: (id: string, data: Partial<{
        "parentId": string;
        "parentKind": string;
        "childId": string;
        "childKind": string;
        "metadata"?: string | null;
        "userId": string;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
        "isPublic"?: boolean;
        "isGuest"?: boolean;
        "isGeneral"?: boolean;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Objects>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Objects>>(field: K, value: QueryableFieldValue<Objects, K>) => string; notEqual: <K extends QueryableKeys<Objects>>(field: K, value: QueryableFieldValue<Objects, K>) => string; lessThan: <K extends QueryableKeys<Objects>>(field: K, value: QueryableFieldValue<Objects, K>) => string; lessThanEqual: <K extends QueryableKeys<Objects>>(field: K, value: QueryableFieldValue<Objects, K>) => string; greaterThan: <K extends QueryableKeys<Objects>>(field: K, value: QueryableFieldValue<Objects, K>) => string; greaterThanEqual: <K extends QueryableKeys<Objects>>(field: K, value: QueryableFieldValue<Objects, K>) => string; contains: <K extends QueryableKeys<Objects>>(field: K, value: QueryableFieldValue<Objects, K>) => string; search: <K extends QueryableKeys<Objects>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Objects>>(field: K) => string; isNotNull: <K extends QueryableKeys<Objects>>(field: K) => string; startsWith: <K extends QueryableKeys<Objects>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Objects>>(field: K, value: string) => string; between: <K extends QueryableKeys<Objects>>(field: K, start: QueryableFieldValue<Objects, K>, end: QueryableFieldValue<Objects, K>) => string; select: <K extends keyof Objects>(fields: K[]) => string; orderAsc: <K extends keyof Objects>(field: K) => string; orderDesc: <K extends keyof Objects>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Objects[] }>;
    };
    "Token Registry": {
      create: (data: {
        "chain": string;
        "address": string;
        "symbol": string;
        "decimals": number;
        "iconUrl"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<TokenRegistry>;
      get: (id: string) => Promise<TokenRegistry>;
      update: (id: string, data: Partial<{
        "chain": string;
        "address": string;
        "symbol": string;
        "decimals": number;
        "iconUrl"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<TokenRegistry>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<TokenRegistry>>(field: K, value: QueryableFieldValue<TokenRegistry, K>) => string; notEqual: <K extends QueryableKeys<TokenRegistry>>(field: K, value: QueryableFieldValue<TokenRegistry, K>) => string; lessThan: <K extends QueryableKeys<TokenRegistry>>(field: K, value: QueryableFieldValue<TokenRegistry, K>) => string; lessThanEqual: <K extends QueryableKeys<TokenRegistry>>(field: K, value: QueryableFieldValue<TokenRegistry, K>) => string; greaterThan: <K extends QueryableKeys<TokenRegistry>>(field: K, value: QueryableFieldValue<TokenRegistry, K>) => string; greaterThanEqual: <K extends QueryableKeys<TokenRegistry>>(field: K, value: QueryableFieldValue<TokenRegistry, K>) => string; contains: <K extends QueryableKeys<TokenRegistry>>(field: K, value: QueryableFieldValue<TokenRegistry, K>) => string; search: <K extends QueryableKeys<TokenRegistry>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<TokenRegistry>>(field: K) => string; isNotNull: <K extends QueryableKeys<TokenRegistry>>(field: K) => string; startsWith: <K extends QueryableKeys<TokenRegistry>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<TokenRegistry>>(field: K, value: string) => string; between: <K extends QueryableKeys<TokenRegistry>>(field: K, start: QueryableFieldValue<TokenRegistry, K>, end: QueryableFieldValue<TokenRegistry, K>) => string; select: <K extends keyof TokenRegistry>(fields: K[]) => string; orderAsc: <K extends keyof TokenRegistry>(field: K) => string; orderDesc: <K extends keyof TokenRegistry>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: TokenRegistry[] }>;
    };
    "Web3 Transactions": {
      create: (data: {
        "userId": string;
        "chain": string;
        "hash": string;
        "from": string;
        "to": string;
        "value": string;
        "symbol": string;
        "timestamp": number;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Web3Transactions>;
      get: (id: string) => Promise<Web3Transactions>;
      update: (id: string, data: Partial<{
        "userId": string;
        "chain": string;
        "hash": string;
        "from": string;
        "to": string;
        "value": string;
        "symbol": string;
        "timestamp": number;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Web3Transactions>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Web3Transactions>>(field: K, value: QueryableFieldValue<Web3Transactions, K>) => string; notEqual: <K extends QueryableKeys<Web3Transactions>>(field: K, value: QueryableFieldValue<Web3Transactions, K>) => string; lessThan: <K extends QueryableKeys<Web3Transactions>>(field: K, value: QueryableFieldValue<Web3Transactions, K>) => string; lessThanEqual: <K extends QueryableKeys<Web3Transactions>>(field: K, value: QueryableFieldValue<Web3Transactions, K>) => string; greaterThan: <K extends QueryableKeys<Web3Transactions>>(field: K, value: QueryableFieldValue<Web3Transactions, K>) => string; greaterThanEqual: <K extends QueryableKeys<Web3Transactions>>(field: K, value: QueryableFieldValue<Web3Transactions, K>) => string; contains: <K extends QueryableKeys<Web3Transactions>>(field: K, value: QueryableFieldValue<Web3Transactions, K>) => string; search: <K extends QueryableKeys<Web3Transactions>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Web3Transactions>>(field: K) => string; isNotNull: <K extends QueryableKeys<Web3Transactions>>(field: K) => string; startsWith: <K extends QueryableKeys<Web3Transactions>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Web3Transactions>>(field: K, value: string) => string; between: <K extends QueryableKeys<Web3Transactions>>(field: K, start: QueryableFieldValue<Web3Transactions, K>, end: QueryableFieldValue<Web3Transactions, K>) => string; select: <K extends keyof Web3Transactions>(fields: K[]) => string; orderAsc: <K extends keyof Web3Transactions>(field: K) => string; orderDesc: <K extends keyof Web3Transactions>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Web3Transactions[] }>;
    };
    "nostr_identities": {
      create: (data: {
        "userId": string;
        "npub": string;
        "encryptedNsec": string;
        "iv": string;
        "salt": string;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<NostrIdentities>;
      get: (id: string) => Promise<NostrIdentities>;
      update: (id: string, data: Partial<{
        "userId": string;
        "npub": string;
        "encryptedNsec": string;
        "iv": string;
        "salt": string;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<NostrIdentities>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<NostrIdentities>>(field: K, value: QueryableFieldValue<NostrIdentities, K>) => string; notEqual: <K extends QueryableKeys<NostrIdentities>>(field: K, value: QueryableFieldValue<NostrIdentities, K>) => string; lessThan: <K extends QueryableKeys<NostrIdentities>>(field: K, value: QueryableFieldValue<NostrIdentities, K>) => string; lessThanEqual: <K extends QueryableKeys<NostrIdentities>>(field: K, value: QueryableFieldValue<NostrIdentities, K>) => string; greaterThan: <K extends QueryableKeys<NostrIdentities>>(field: K, value: QueryableFieldValue<NostrIdentities, K>) => string; greaterThanEqual: <K extends QueryableKeys<NostrIdentities>>(field: K, value: QueryableFieldValue<NostrIdentities, K>) => string; contains: <K extends QueryableKeys<NostrIdentities>>(field: K, value: QueryableFieldValue<NostrIdentities, K>) => string; search: <K extends QueryableKeys<NostrIdentities>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<NostrIdentities>>(field: K) => string; isNotNull: <K extends QueryableKeys<NostrIdentities>>(field: K) => string; startsWith: <K extends QueryableKeys<NostrIdentities>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<NostrIdentities>>(field: K, value: string) => string; between: <K extends QueryableKeys<NostrIdentities>>(field: K, start: QueryableFieldValue<NostrIdentities, K>, end: QueryableFieldValue<NostrIdentities, K>) => string; select: <K extends keyof NostrIdentities>(fields: K[]) => string; orderAsc: <K extends keyof NostrIdentities>(field: K) => string; orderDesc: <K extends keyof NostrIdentities>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: NostrIdentities[] }>;
    };
    "Agent Payment Intents": {
      create: (data: {
        "userId": string;
        "agentId": string;
        "status": string;
        "txHash"?: string | null;
        "payload"?: string | null;
        "chainId": number;
        "amount": number;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<AgentPaymentIntents>;
      get: (id: string) => Promise<AgentPaymentIntents>;
      update: (id: string, data: Partial<{
        "userId": string;
        "agentId": string;
        "status": string;
        "txHash"?: string | null;
        "payload"?: string | null;
        "chainId": number;
        "amount": number;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<AgentPaymentIntents>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<AgentPaymentIntents>>(field: K, value: QueryableFieldValue<AgentPaymentIntents, K>) => string; notEqual: <K extends QueryableKeys<AgentPaymentIntents>>(field: K, value: QueryableFieldValue<AgentPaymentIntents, K>) => string; lessThan: <K extends QueryableKeys<AgentPaymentIntents>>(field: K, value: QueryableFieldValue<AgentPaymentIntents, K>) => string; lessThanEqual: <K extends QueryableKeys<AgentPaymentIntents>>(field: K, value: QueryableFieldValue<AgentPaymentIntents, K>) => string; greaterThan: <K extends QueryableKeys<AgentPaymentIntents>>(field: K, value: QueryableFieldValue<AgentPaymentIntents, K>) => string; greaterThanEqual: <K extends QueryableKeys<AgentPaymentIntents>>(field: K, value: QueryableFieldValue<AgentPaymentIntents, K>) => string; contains: <K extends QueryableKeys<AgentPaymentIntents>>(field: K, value: QueryableFieldValue<AgentPaymentIntents, K>) => string; search: <K extends QueryableKeys<AgentPaymentIntents>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<AgentPaymentIntents>>(field: K) => string; isNotNull: <K extends QueryableKeys<AgentPaymentIntents>>(field: K) => string; startsWith: <K extends QueryableKeys<AgentPaymentIntents>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<AgentPaymentIntents>>(field: K, value: string) => string; between: <K extends QueryableKeys<AgentPaymentIntents>>(field: K, start: QueryableFieldValue<AgentPaymentIntents, K>, end: QueryableFieldValue<AgentPaymentIntents, K>) => string; select: <K extends keyof AgentPaymentIntents>(fields: K[]) => string; orderAsc: <K extends keyof AgentPaymentIntents>(field: K) => string; orderDesc: <K extends keyof AgentPaymentIntents>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: AgentPaymentIntents[] }>;
    };
    "Agentic Telemetry": {
      create: (data: {
        "userId"?: string | null;
        "action": string;
        "zone"?: string | null;
        "pointers"?: string | null;
        "metadata"?: string | null;
        "timestamp": string;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<AgenticTelemetry>;
      get: (id: string) => Promise<AgenticTelemetry>;
      update: (id: string, data: Partial<{
        "userId"?: string | null;
        "action": string;
        "zone"?: string | null;
        "pointers"?: string | null;
        "metadata"?: string | null;
        "timestamp": string;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<AgenticTelemetry>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<AgenticTelemetry>>(field: K, value: QueryableFieldValue<AgenticTelemetry, K>) => string; notEqual: <K extends QueryableKeys<AgenticTelemetry>>(field: K, value: QueryableFieldValue<AgenticTelemetry, K>) => string; lessThan: <K extends QueryableKeys<AgenticTelemetry>>(field: K, value: QueryableFieldValue<AgenticTelemetry, K>) => string; lessThanEqual: <K extends QueryableKeys<AgenticTelemetry>>(field: K, value: QueryableFieldValue<AgenticTelemetry, K>) => string; greaterThan: <K extends QueryableKeys<AgenticTelemetry>>(field: K, value: QueryableFieldValue<AgenticTelemetry, K>) => string; greaterThanEqual: <K extends QueryableKeys<AgenticTelemetry>>(field: K, value: QueryableFieldValue<AgenticTelemetry, K>) => string; contains: <K extends QueryableKeys<AgenticTelemetry>>(field: K, value: QueryableFieldValue<AgenticTelemetry, K>) => string; search: <K extends QueryableKeys<AgenticTelemetry>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<AgenticTelemetry>>(field: K) => string; isNotNull: <K extends QueryableKeys<AgenticTelemetry>>(field: K) => string; startsWith: <K extends QueryableKeys<AgenticTelemetry>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<AgenticTelemetry>>(field: K, value: string) => string; between: <K extends QueryableKeys<AgenticTelemetry>>(field: K, start: QueryableFieldValue<AgenticTelemetry, K>, end: QueryableFieldValue<AgenticTelemetry, K>) => string; select: <K extends keyof AgenticTelemetry>(fields: K[]) => string; orderAsc: <K extends keyof AgenticTelemetry>(field: K) => string; orderDesc: <K extends keyof AgenticTelemetry>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: AgenticTelemetry[] }>;
    };
    "Agentic Sessions": {
      create: (data: {
        "userId": string;
        "context"?: string | null;
        "seen"?: boolean;
        "chatHistory"?: string | null;
        "isMemory"?: boolean;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<AgenticSessions>;
      get: (id: string) => Promise<AgenticSessions>;
      update: (id: string, data: Partial<{
        "userId": string;
        "context"?: string | null;
        "seen"?: boolean;
        "chatHistory"?: string | null;
        "isMemory"?: boolean;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<AgenticSessions>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<AgenticSessions>>(field: K, value: QueryableFieldValue<AgenticSessions, K>) => string; notEqual: <K extends QueryableKeys<AgenticSessions>>(field: K, value: QueryableFieldValue<AgenticSessions, K>) => string; lessThan: <K extends QueryableKeys<AgenticSessions>>(field: K, value: QueryableFieldValue<AgenticSessions, K>) => string; lessThanEqual: <K extends QueryableKeys<AgenticSessions>>(field: K, value: QueryableFieldValue<AgenticSessions, K>) => string; greaterThan: <K extends QueryableKeys<AgenticSessions>>(field: K, value: QueryableFieldValue<AgenticSessions, K>) => string; greaterThanEqual: <K extends QueryableKeys<AgenticSessions>>(field: K, value: QueryableFieldValue<AgenticSessions, K>) => string; contains: <K extends QueryableKeys<AgenticSessions>>(field: K, value: QueryableFieldValue<AgenticSessions, K>) => string; search: <K extends QueryableKeys<AgenticSessions>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<AgenticSessions>>(field: K) => string; isNotNull: <K extends QueryableKeys<AgenticSessions>>(field: K) => string; startsWith: <K extends QueryableKeys<AgenticSessions>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<AgenticSessions>>(field: K, value: string) => string; between: <K extends QueryableKeys<AgenticSessions>>(field: K, start: QueryableFieldValue<AgenticSessions, K>, end: QueryableFieldValue<AgenticSessions, K>) => string; select: <K extends keyof AgenticSessions>(fields: K[]) => string; orderAsc: <K extends keyof AgenticSessions>(field: K) => string; orderDesc: <K extends keyof AgenticSessions>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: AgenticSessions[] }>;
    };
    "swept": {
      create: (data: {
        "userId": string;
        "projectId": string;
        "enabled"?: boolean;
        "scopeType"?: string;
        "anchorKind"?: string;
        "anchors"?: string | null;
        "policy"?: string | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
      }, options?: { rowId?: string; permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Swept>;
      get: (id: string) => Promise<Swept>;
      update: (id: string, data: Partial<{
        "userId": string;
        "projectId": string;
        "enabled"?: boolean;
        "scopeType"?: string;
        "anchorKind"?: string;
        "anchors"?: string | null;
        "policy"?: string | null;
        "createdAt"?: string | null;
        "updatedAt"?: string | null;
      }>, options?: { permissions?: (permission: { read: (role: RoleString) => string; write: (role: RoleString) => string; create: (role: RoleString) => string; update: (role: RoleString) => string; delete: (role: RoleString) => string }, role: { any: () => RoleString; user: (userId: string, status?: string) => RoleString; users: (status?: string) => RoleString; guests: () => RoleString; team: (teamId: string, role?: string) => RoleString; member: (memberId: string) => RoleString; label: (label: string) => RoleString }) => string[]; transactionId?: string }) => Promise<Swept>;
      delete: (id: string, options?: { transactionId?: string }) => Promise<void>;
      list: (options?: { queries?: (q: { equal: <K extends QueryableKeys<Swept>>(field: K, value: QueryableFieldValue<Swept, K>) => string; notEqual: <K extends QueryableKeys<Swept>>(field: K, value: QueryableFieldValue<Swept, K>) => string; lessThan: <K extends QueryableKeys<Swept>>(field: K, value: QueryableFieldValue<Swept, K>) => string; lessThanEqual: <K extends QueryableKeys<Swept>>(field: K, value: QueryableFieldValue<Swept, K>) => string; greaterThan: <K extends QueryableKeys<Swept>>(field: K, value: QueryableFieldValue<Swept, K>) => string; greaterThanEqual: <K extends QueryableKeys<Swept>>(field: K, value: QueryableFieldValue<Swept, K>) => string; contains: <K extends QueryableKeys<Swept>>(field: K, value: QueryableFieldValue<Swept, K>) => string; search: <K extends QueryableKeys<Swept>>(field: K, value: string) => string; isNull: <K extends QueryableKeys<Swept>>(field: K) => string; isNotNull: <K extends QueryableKeys<Swept>>(field: K) => string; startsWith: <K extends QueryableKeys<Swept>>(field: K, value: string) => string; endsWith: <K extends QueryableKeys<Swept>>(field: K, value: string) => string; between: <K extends QueryableKeys<Swept>>(field: K, start: QueryableFieldValue<Swept, K>, end: QueryableFieldValue<Swept, K>) => string; select: <K extends keyof Swept>(fields: K[]) => string; orderAsc: <K extends keyof Swept>(field: K) => string; orderDesc: <K extends keyof Swept>(field: K) => string; limit: (value: number) => string; offset: (value: number) => string; cursorAfter: (documentId: string) => string; cursorBefore: (documentId: string) => string; or: (...queries: string[]) => string; and: (...queries: string[]) => string }) => string[] }) => Promise<{ total: number; rows: Swept[] }>;
    }
  }
};

export type DatabaseHandle<D extends DatabaseId> = {
  use: <T extends keyof DatabaseTableMap[D] & string>(tableId: T) => DatabaseTableMap[D][T];

};

export type DatabaseTables = {
  use: <D extends DatabaseId>(databaseId: D) => DatabaseHandle<D>;

};
