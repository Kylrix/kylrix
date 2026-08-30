import { APPWRITE_CONFIG } from '../../appwrite/config';
import { internalAppwriteFetchHeaders } from '../../appwrite/internal-headers';
import { Forms } from '../../../generated/appwrite/types';

const DATABASE_ID = APPWRITE_CONFIG.DATABASES.FLOW;
const FORMS_TABLE = APPWRITE_CONFIG.TABLES.FLOW.FORMS;

export const FormsServerService = {
    async getFormPublic(formId: string): Promise<Forms | null> {
        try {
            const url = `${APPWRITE_CONFIG.SERVER_ENDPOINT}/databases/${DATABASE_ID}/collections/${FORMS_TABLE}/documents/${formId}`;
            const res = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-Appwrite-Project': APPWRITE_CONFIG.PROJECT_ID,
                    'Content-Type': 'application/json',
                    ...internalAppwriteFetchHeaders()},
                next: { revalidate: 60 } // Cache for 1 minute
            });

            if (!res.ok) return null;
            return await res.json();
        } catch (error) {
            console.error('getFormPublic error:', error);
            return null;
        }
    }
};
