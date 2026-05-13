import { ID, Query } from 'appwrite';
import { tablesDB } from '../appwrite/client';
import { APPWRITE_CONFIG } from '../appwrite/config';
import { getNamedListCache } from './list-cache';

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

const contactsCache = getNamedListCache<any>('contacts', 60000); // 1m cache

export const ContactsService = {
    async getContacts(userId: string, force = false) {
        return contactsCache.fetch(async () => {
            return await tablesDB.listRows(DB_ID, CONTACTS_TABLE, [
                Query.equal('userId', userId)
            ]);
        }, force);
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

        const res = await tablesDB.createRow(DB_ID, CONTACTS_TABLE, ID.unique(), {
            userId,
            contactUserId,
            relationship: 'friend',
            isBlocked: false,
            isFavorite: false,
            tags: [],
            ...data
        });
        contactsCache.invalidate();
        return res;
    },

    async updateContact(contactId: string, data: Partial<Contact>) {
        const res = await tablesDB.updateRow(DB_ID, CONTACTS_TABLE, contactId, data);
        contactsCache.invalidate();
        return res;
    },

    async deleteContact(contactId: string) {
        const res = await tablesDB.deleteRow(DB_ID, CONTACTS_TABLE, contactId);
        contactsCache.invalidate();
        return res;
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
