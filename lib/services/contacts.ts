import { ID, Query } from 'appwrite';
import { tablesDB } from '../appwrite/client';
import { APPWRITE_CONFIG } from '../appwrite/config';

const DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const CONTACTS_TABLE = APPWRITE_CONFIG.TABLES.CHAT.CONTACTS || 'contacts';

export interface Contact {
    $id: string;
    userId: string;
    contactUserId: string;
    nickname?: string;
    relationship: 'friend' | 'family' | 'colleague' | 'acquaintance' | 'blocked' | 'favorite';
    isBlocked: boolean;
    isFavorite: boolean;
    notes?: string;
    tags: string[];
}

export const ContactsService = {
    async getContacts(userId: string) {
        return await tablesDB.listRows(DB_ID, CONTACTS_TABLE, [
            Query.equal('userId', userId)
        ]);
    },

    async addContact(userId: string, contactUserId: string, data: Partial<Contact> = {}) {
        // Check if already exists
        const existing = await tablesDB.listRows(DB_ID, CONTACTS_TABLE, [
            Query.equal('userId', userId),
            Query.equal('contactUserId', contactUserId)
        ]);

        if (existing.total > 0) {
            return existing.rows[0];
        }

        return await tablesDB.createRow(DB_ID, CONTACTS_TABLE, ID.unique(), {
            userId,
            contactUserId,
            relationship: 'friend',
            isBlocked: false,
            isFavorite: false,
            tags: [],
            ...data
        });
    },

    async updateContact(contactId: string, data: Partial<Contact>) {
        return await tablesDB.updateRow(DB_ID, CONTACTS_TABLE, contactId, data);
    },

    async deleteContact(contactId: string) {
        return await tablesDB.deleteRow(DB_ID, CONTACTS_TABLE, contactId);
    },

    async blockUser(userId: string, contactUserId: string) {
        const contact = await this.addContact(userId, contactUserId);
        return await this.updateContact(contact.$id, { isBlocked: true, relationship: 'blocked' });
    },

    async unblockUser(userId: string, contactUserId: string) {
        const existing = await tablesDB.listRows(DB_ID, CONTACTS_TABLE, [
            Query.equal('userId', userId),
            Query.equal('contactUserId', contactUserId),
            Query.equal('isBlocked', true)
        ]);

        if (existing.total > 0) {
            return await this.updateContact(existing.rows[0].$id, { isBlocked: false, relationship: 'friend' });
        }
    }
};
