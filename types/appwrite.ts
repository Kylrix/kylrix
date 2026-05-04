import type { Models } from 'appwrite';

export enum Status {
    DRAFT = "draft",
    PUBLISHED = "published",
    ARCHIVED = "archived",
    ACTIVE = "active",
    CANCELED = "canceled",
    TRIALING = "trialing",
    PENDING = "pending",
    ACCEPTED = "accepted",
    BLOCKED = "blocked",
    SENDING = "sending",
    SENT = "sent",
    DELIVERED = "delivered",
    READ = "read",
    FAILED = "failed",
    PROCESSING = "processing"
}

export enum TargetType {
    NOTE = "note",
    COMMENT = "comment"
}

export enum Permission {
    READ = "read",
    WRITE = "write",
    ADMIN = "admin"
}

export enum Cause {
    MANUAL = "manual",
    AI = "ai",
    COLLAB = "collab"
}

export enum Plan {
    FREE = "free",
    PRO = "pro",
    ORG = "org"
}

export enum ContentType {
    TEXT = "text",
    IMAGE = "image",
    VIDEO = "video",
    AUDIO = "audio",
    FILE = "file",
    GIF = "gif",
    STICKER = "sticker",
    LOCATION = "location",
    CONTACT = "contact",
    POLL = "poll",
    VOICE = "voice",
    CRYPTO_TX = "crypto_tx",
    NFT = "nft",
    TOKEN_GIFT = "token_gift",
    LINK = "link",
    REPLY = "reply",
    FORWARD = "forward",
    STORY_REPLY = "story_reply",
    GAME = "game",
    ARTICLE = "article"
}

export enum Privacy {
    PUBLIC = "public",
    FRIENDS = "friends",
    CLOSE_FRIENDS = "close_friends",
    PRIVATE = "private",
    CUSTOM = "custom"
}

export enum Category {
    FACE = "face",
    WORLD = "world",
    SKY = "sky",
    HAND = "hand",
    BODY = "body"
}

export enum Type {
    DIRECT = "direct",
    GROUP = "group",
    CHANNEL = "channel",
    BROADCAST = "broadcast",
    COMMUNITY = "community"
}

export enum Relationship {
    FRIEND = "friend",
    FAMILY = "family",
    COLLEAGUE = "colleague",
    ACQUAINTANCE = "acquaintance",
    BLOCKED = "blocked",
    FAVORITE = "favorite"
}

export enum Chain {
    ETHEREUM = "ethereum",
    POLYGON = "polygon",
    BSC = "bsc",
    SOLANA = "solana",
    AVALANCHE = "avalanche",
    ARBITRUM = "arbitrum",
    OPTIMISM = "optimism",
    BASE = "base"
}

export enum WalletType {
    METAMASK = "metamask",
    WALLETCONNECT = "walletconnect",
    COINBASE = "coinbase",
    PHANTOM = "phantom",
    TRUST = "trust",
    OTHER = "other"
}

export type Users = Models.Document & {
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

export type Notes = Models.Document & {
    id: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    userId: string | null;
    isPublic: boolean | null;
    status: Status | null;
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
    // Virtual attributes (hydrated from metadata)
    linkedTaskId?: string;
    linkedSource?: string;
}

export type Tags = Models.Document & {
    id: string | null;
    name: string | null;
    notes: string[] | null;
    createdAt: string | null;
    color: string | null;
    description: string | null;
    usageCount: number | null;
    userId: string | null;
    nameLower: string | null;
}

export type ApiKeys = Models.Document & {
    id: string | null;
    key: string | null;
    name: string | null;
    userId: string | null;
    createdAt: string | null;
    lastUsed: string | null;
    expiresAt: string | null;
    scopes: string[] | null;
    lastUsedIp: string | null;
    keyHash: string | null;
}

export type Comments = Models.Document & {
    noteId: string;
    userId: string;
    content: string;
    createdAt: string;
    parentCommentId: string | null;
}

export type Extensions = Models.Document & {
    name: string;
    description: string | null;
    version: string | null;
    authorId: string | null;
    enabled: boolean | null;
    settings: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    isPublic: boolean | null;
}

export type Reactions = Models.Document & {
    targetType: TargetType;
    emoji: string;
    createdAt: string;
    targetId: string;
    userId: string;
}

export type Collaborators = Models.Document & {
    noteId: string;
    userId: string;
    permission: Permission;
    invitedAt: string | null;
    accepted: boolean | null;
}

export type ActivityLog = Models.Document & {
    userId: string;
    action: string;
    targetType: string;
    targetId: string;
    timestamp: string;
    details: string | null;
}

export type Settings = Models.Document & {
    userId: string;
    settings: string;
    createdAt: string | null;
    updatedAt: string | null;
    mode: string | null;
}

export type WalletMap = Models.Document & {
    walletAddressLower: string;
    userId: string;
    updatedAt: string | null;
}

export type NoteTags = Models.Document & {
    noteId: string;
    tagId: string;
    userId: string;
    createdAt: string | null;
    tag: string | null;
}

export type NoteRevisions = Models.Document & {
    noteId: string;
    revision: number;
    userId: string | null;
    title: string | null;
    content: string | null;
    createdAt: string | null;
    diff: string | null;
    diffFormat: string | null;
    fullSnapshot: boolean | null;
    cause: Cause | null;
}

export type AiGenerations = Models.Document & {
    userId: string;
    promptHash: string | null;
    prompt: string | null;
    mode: string | null;
    providerId: string | null; model: string | null; durationMs: number | null; tokensUsed: number | null; success: boolean | null; error: string | null; createdAt: string | null;
}

export type Subscriptions = Models.Document & { userId: string; plan: Plan; status: Status | null; currentPeriodStart: string | null; currentPeriodEnd: string | null; seats: number | null; createdAt: string | null; updatedAt: string | null; }

export type SecurityLogs = Models.Document & { userId: string; eventType: string; ipAddress: string | null; userAgent: string | null; deviceFingerprint: string | null; details: string | null; success: boolean; severity: string; timestamp: string; }

export type Credentials = Models.Document & { userId: string; itemType: string; name: string; url: string | null; notes: string | null; totpId: string | null; username: string | null; password: string | null; cardNumber: string | null; cardholderName: string | null; cardExpiry: string | null; cardCVV: string | null; cardPIN: string | null; cardType: string | null; folderId: string | null; tags: string[] | null; customFields: string | null; faviconUrl: string | null; isFavorite: boolean; isDeleted: boolean; deletedAt: string | null; lastAccessedAt: string | null; passwordChangedAt: string | null; createdAt: string | null; updatedAt: string | null; }

export type Identities = Models.Document & { userId: string; identityType: string; label: string; credentialId: string | null; publicKey: string | null; counter: number; passkeyBlob: string | null; transports: string[] | null; aaguid: string | null; deviceInfo: string | null; isPrimary: boolean; isBackup: boolean; lastUsedAt: string | null; createdAt: string | null; updatedAt: string | null; }

export type User = Models.Document & { userId: string; email: string | null; masterpass: boolean | null; twofa: boolean | null; salt: string | null; twofaSecret: string | null; backupCodes: string | null; isPasskey: boolean | null; check: string | null; passkeyBlob: string | null; credentialId: string | null; publicKey: string | null; counter: number | null; authVersion: number; v2Migrated: boolean; mustCreatePasskey: boolean; sessionFingerprint: string | null; lastLoginAt: string | null; lastPasswordChangeAt: string | null; createdAt: string | null; updatedAt: string | null; }

export type Folders = Models.Document & { userId: string; name: string; parentFolderId: string | null; icon: string | null; color: string | null; sortOrder: number; isDeleted: boolean; deletedAt: string | null; createdAt: string | null; updatedAt: string | null; }

export type TotpSecrets = Models.Document & { userId: string; issuer: string; accountName: string; secretKey: string; algorithm: string; digits: number; period: number; url: string | null; folderId: string | null; tags: string[] | null; isFavorite: boolean; isDeleted: boolean; deletedAt: string | null; lastUsedAt: string | null; createdAt: string | null; updatedAt: string | null; }

export type Messages = Models.Document & { conversationId: string; senderId: string; content: string; contentType: ContentType; plainText: string | null; mediaUrls: string[]; mediaFileIds: string[]; thumbnailUrl: string | null; thumbnailFileId: string | null; metadata: string | null; replyToMessageId: string | null; forwardedFromMessageId: string | null; forwardedFromConversationId: string | null; editedAt: string | null; deletedAt: string | null; deletedFor: string[]; isSystemMessage: boolean; isPinned: boolean; pinnedAt: string | null; reactions: string | null; mentions: string[]; links: string[]; readBy: string[]; deliveredTo: string[]; status: Status; expiresAt: string | null; createdAt: string | null; updatedAt: string | null; }

export type Stories = Models.Document & { userId: string; contentType: ContentType; mediaUrl: string | null; mediaFileId: string | null; thumbnailUrl: string | null; text: string | null; backgroundColor: string | null; duration: number; filters: string | null; stickers: string | null; music: string | null; location: string | null; mentions: string[]; viewerIds: string[]; viewCount: number; reactionCount: number; replyCount: number; shareCount: number; privacy: Privacy; allowReplies: boolean; expiresAt: string; createdAt: string | null; }

export type Polls = Models.Document & { creatorId: string; conversationId: string | null; messageId: string | null; question: string; options: string; votes: string | null; totalVotes: number; allowMultiple: boolean; isAnonymous: boolean; expiresAt: string | null; createdAt: string | null; }

export type ArFilters = Models.Document & { name: string; description: string | null; creatorId: string | null; thumbnailUrl: string; thumbnailFileId: string | null; filterDataUrl: string; filterDataFileId: string | null; category: Category; tags: string[]; isPremium: boolean; usageCount: number; isPublic: boolean; createdAt: string | null; }

export type TypingIndicators = Models.Document & { conversationId: string; userId: string; isTyping: boolean; expiresAt: string; }

export type UserStickers = Models.Document & { userId: string; stickerPackId: string; isPurchased: boolean; isFavorite: boolean; addedAt: string | null; }

export type StoryViews = Models.Document & { storyId: string; viewerId: string; watchDuration: number; completedView: boolean; viewedAt: string | null; }

export type Presence = Models.Document & { userId: string; status: Status; device: string | null; lastSeen: string; expiresAt: string; }

export type MessageQueue = Models.Document & { messageId: string; conversationId: string; recipientIds: string[]; pendingFor: string[]; priority: number; retryCount: number; maxRetries: number; status: Status; error: string | null; scheduledFor: string | null; createdAt: string | null; processedAt: string | null; }

export type Conversations = Models.Document & { type: Type; name: string | null; description: string | null; avatar: string | null; creatorId: string; participantIds: string[]; adminIds: string[]; moderatorIds: string[]; participantCount: number; maxParticipants: number; isEncrypted: boolean; encryptionVersion: string | null; isPinned: string[]; isMuted: string[]; isArchived: string[]; lastMessageId: string | null; lastMessageText: string | null; lastMessageAt: string | null; lastMessageSenderId: string | null; unreadCount: string | null; settings: string | null; isPublic: boolean; inviteLink: string | null; inviteLinkExpiry: string | null; category: string | null; tags: string[]; createdAt: string | null; updatedAt: string | null; }

export type Contacts = Models.Document & { userId: string; contactUserId: string; nickname: string | null; relationship: Relationship; isBlocked: boolean; isFavorite: boolean; notes: string | null; tags: string[]; lastInteraction: string | null; addedAt: string | null; updatedAt: string | null; }

export type Posts = Models.Document & { userId: string; content: string | null; contentType: ContentType; mediaUrls: string[]; mediaFileIds: string[]; thumbnails: string | null; mentions: string[]; hashtags: string[]; location: string | null; privacy: Privacy; allowComments: boolean; allowShares: boolean; likeCount: number; commentCount: number; shareCount: number; viewCount: number; isPinned: boolean; isSponsored: boolean; createdAt: string | null; updatedAt: string | null; }

export type GiFs = Models.Document & { title: string; url: string; fileId: string | null; thumbnailUrl: string | null; source: string | null; externalId: string | null; tags: string[]; category: string | null; width: number | null; height: number | null; usageCount: number; createdAt: string | null; }

export type MediaLibrary = Models.Document & { userId: string; fileId: string; fileName: string; fileType: string; mimeType: string | null; fileSize: number | null; width: number | null; height: number | null; duration: number | null; thumbnailFileId: string | null; url: string | null; metadata: string | null; tags: string[]; album: string | null; isPublic: boolean; uploadedAt: string | null; }

export type Follows = Models.Document & { followerId: string; followingId: string; status: Status; isCloseFriend: boolean; notificationsEnabled: boolean; createdAt: string | null; }

export type TokenHoldings = Models.Document & { userId: string; walletAddress: string; chain: string; tokenAddress: string; tokenSymbol: string | null; tokenName: string | null; balance: string | null; decimals: number; usdValue: number | null; pricePerToken: number | null; lastSynced: string | null; }

export type StickerPacks = Models.Document & { name: string; description: string | null; creatorId: string | null; coverImageUrl: string | null; coverImageFileId: string | null; stickerCount: number; isPremium: boolean; price: number; currency: string | null; downloadCount: number; isPublic: boolean; tags: string[]; createdAt: string | null; updatedAt: string | null; }

export type Wallets = Models.Document & { userId: string; address: string; chain: Chain; walletType: WalletType; isPrimary: boolean; nickname: string | null; balance: string | null; nftsCount: number; lastSynced: string | null; isVerified: boolean; verifiedAt: string | null; addedAt: string | null; }

export type Stickers = Models.Document & { name: string; description: string | null; creatorId: string | null; packId: string | null; imageUrl: string; imageFileId: string | null; animatedUrl: string | null; animatedFileId: string | null; tags: string[]; category: string | null; isPremium: boolean; isAnimated: boolean; usageCount: number; isPublic: boolean; createdAt: string | null; }
