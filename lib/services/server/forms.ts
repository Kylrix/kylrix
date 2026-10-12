import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { Forms } from '@/types/appwrite';

export const FormsServerService = {
    async getFormPublic(formId: string): Promise<Forms | null> {
        try {
            const rows = await db.select().from(schema.forms).where(eq(schema.forms.id, formId)).limit(1);
            if (rows.length === 0) return null;
            const row = rows[0];
            return {
                ...row,
                $id: row.id,
                $createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
                $updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
            } as unknown as Forms;
        } catch (error) {
            console.error('getFormPublic error:', error);
            return null;
        }
    }
};
