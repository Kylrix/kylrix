import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export interface MomentMetadata {
  type: 'post' | 'reply' | 'pulse' | 'quote';
  sourceId?: string;
  attachments?: {
    type: 'note' | 'event' | 'image' | 'video' | 'call';
    id: string;
  }[];
}

export const SocialService = {
  async getInteractionCounts(_momentId: string): Promise<{ likes: number; replies: number; pulses: number }> {
    return { likes: 0, replies: 0, pulses: 0 };
  },

  async isPulsed(_userId: string, _sourceId: string) {
    return false;
  },

  async toggleLike(_userId: string, _momentId: string, _creatorId?: string, _contentSnippet?: string) {
    return { liked: true };
  },

  async isLiked(_userId: string, _momentId: string) {
    return false;
  },

  async getFeed(_userId?: string, _targetUserId?: string) {
    return { rows: [], total: 0 };
  },

  async getTrendingFeed(_userId?: string) {
    return { rows: [], total: 0 };
  },

  subscribeToFeed(_callback: (event: any) => void) {
    return () => {};
  },

  async uploadMedia(_file: File) {
    return crypto.randomUUID();
  },

  getMediaPreview(_fileId: string, _width: number = 800, _height: number = 600) {
    return '';
  },

  async createMoment(
    creatorId: string,
    content: string,
    _type: 'post' | 'reply' | 'pulse' | 'quote' = 'post',
    _mediaIds: string[] = [],
    _visibility: 'public' | 'private' | 'followers' = 'public',
    _noteId?: string,
    _eventId?: string,
    _sourceId?: string,
    _callId?: string,
    _fallbackSearchTitle?: string | null,
    _nostrId?: string | null,
    _attachmentsPayload?: any
  ) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    return { $id: id, id, userId: creatorId, caption: content, createdAt: now };
  },

  async deleteMoment(_momentId: string) {
    return { success: true };
  },

  async unpulseMoment(_userId: string, _sourceId: string) {
    return false;
  },

  async updateMomentVisibility(_momentId: string, _visibility: 'public' | 'private' | 'followers') {
    return { success: true };
  },

  async updateMoment(momentId: string, content: string) {
    return { $id: momentId, id: momentId, caption: content };
  },

  async followUser(followerId: string, followingId: string) {
    const id = crypto.randomUUID();
    await db.insert(schema.follows).values({
      id,
      followerId,
      followingId,
      createdAt: new Date().toISOString(),
    }).onConflictDoNothing();
    return { id, followerId, followingId };
  },

  async unfollowUser(followerId: string, followingId: string) {
    await db
      .delete(schema.follows)
      .where(and(eq(schema.follows.followerId, followerId), eq(schema.follows.followingId, followingId)));
    return true;
  },

  async isFollowing(followerId: string, followingId: string) {
    const rows = await db
      .select()
      .from(schema.follows)
      .where(and(eq(schema.follows.followerId, followerId), eq(schema.follows.followingId, followingId)))
      .limit(1);
    return rows.length > 0;
  },

  async getFollowStats(userId: string) {
    try {
      const followers = await db
        .select()
        .from(schema.follows)
        .where(eq(schema.follows.followingId, userId));
      const following = await db
        .select()
        .from(schema.follows)
        .where(eq(schema.follows.followerId, userId));

      return {
        followers: followers.length,
        following: following.length,
        followerRows: followers,
        followingRows: following,
      };
    } catch {
      return { followers: 0, following: 0, followerRows: [], followingRows: [] };
    }
  },

  async getFollowers(_userId: string, _currentUserId?: string) {
    return [];
  },

  async getFollowing(_userId: string, _currentUserId?: string) {
    return [];
  },

  async searchMoments(_query: string, _userId?: string) {
    return { rows: [], total: 0 };
  },

  async getMomentById(momentId: string, _currentUserId?: string) {
    return { $id: momentId, id: momentId };
  },

  async getUserReplies(_userId: string, _currentUserId?: string) {
    return [];
  },

  async getUserLikedMoments(_userId: string, _currentUserId?: string) {
    return [];
  },

  async getReplies(_momentId: string, _currentUserId?: string) {
    return [];
  },
};
