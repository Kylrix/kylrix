"use client";

import { useEffect, useRef } from 'react';
import { useAuth } from '@/context/auth/AuthContext';
import { decryptGhostData } from '@/lib/encryption/ghost-crypto';

const GHOST_STORAGE_KEY = 'kylrix_ghost_notes_v2';
const GHOST_SECRET_KEY = 'kylrix_ghost_secret_v2';

/**
 * Background component that claims ghost notes when a user authenticates.
 * Automatically claims and twists all kinds of ghost notes (notes, tasks, credentials, TOTPs)
 * into official data containers upon login.
 */
export const GhostNoteClaimer = () => {
    const { isAuthenticated, user } = useAuth();
    const isClaiming = useRef(false);

    useEffect(() => {
        if (!isAuthenticated || !user?.$id || isClaiming.current) return;

        const claimGhostNotes = async () => {
            const historyRaw = localStorage.getItem(GHOST_STORAGE_KEY);
            if (!historyRaw) return;

            try {
                const history = JSON.parse(historyRaw);
                if (!Array.isArray(history) || history.length === 0) return;

                isClaiming.current = true;
                console.log(`[GhostClaimer] Detected ${history.length} items to claim for user ${user.$id}`);

                const remainingHistory = [...history];

                for (const item of history) {
                    try {
                        // Decrypt title and content
                        const decryptedTitle = item.decryptionKey 
                            ? await decryptGhostData(item.title, item.decryptionKey)
                            : item.title;
                        const decryptedContent = (item.content && item.decryptionKey)
                            ? await decryptGhostData(item.content, item.decryptionKey)
                            : (item.content || '');

                        // Parse metadata
                        const meta = (() => {
                            try { return JSON.parse(item.metadata || '{}'); } catch { return {}; }
                        })();
                        const kind = meta?.send_object?.kind || 'note';
                        const isDeleted = meta?._deleted === true;
                        const isUpdate = item.id && !item.id.startsWith('ghost-');

                        if (isDeleted) {
                            if (kind === 'task') {
                                const { tasks: taskApi } = await import('@/lib/kylrixflow');
                                await taskApi.delete(item.id);
                            } else if (kind === 'password') {
                                const { deleteCredential } = await import('@/lib/appwrite/vault');
                                await deleteCredential(item.id);
                            } else if (kind === 'totp') {
                                const { deleteTotpSecret } = await import('@/lib/appwrite/vault');
                                await deleteTotpSecret(item.id);
                            } else {
                                const { deleteNote } = await import('@/lib/actions/client-ops');
                                await deleteNote(item.id);
                            }
                        } else if (isUpdate) {
                            if (kind === 'task') {
                                const payload = (() => {
                                    try { return JSON.parse(decryptedContent); } catch { return null; }
                                })();
                                if (payload) {
                                    const { tasks: taskApi } = await import('@/lib/kylrixflow');
                                    await taskApi.update(item.id, {
                                        title: payload.title || decryptedTitle,
                                        description: payload.detail || '',
                                        status: payload.status || 'todo',
                                        priority: payload.priority || 'medium',
                                        dueDate: payload.dueAt ? payload.dueAt : null,
                                    });
                                }
                            } else if (kind === 'password') {
                                const payload = (() => {
                                    try { return JSON.parse(decryptedContent); } catch { return null; }
                                })();
                                if (payload) {
                                    const { updateCredential } = await import('@/lib/appwrite/vault');
                                    await updateCredential(item.id, {
                                        name: decryptedTitle,
                                        username: payload.username || null,
                                        password: payload.password || null,
                                        totpId: payload.totpSecret || null,
                                    });
                                }
                            } else if (kind === 'totp') {
                                const payload = (() => {
                                    try { return JSON.parse(decryptedContent); } catch { return null; }
                                })();
                                if (payload) {
                                    const { updateTotpSecret } = await import('@/lib/appwrite/vault');
                                    await updateTotpSecret(item.id, {
                                        issuer: payload.issuer || decryptedTitle || 'Imported',
                                        accountName: payload.account || payload.accountName || decryptedTitle || 'Authenticator',
                                        secretKey: payload.secret || payload.secretKey || '',
                                        algorithm: payload.algorithm || 'SHA1',
                                        digits: payload.digits || 6,
                                        period: payload.period || 30,
                                    });
                                }
                            } else {
                                const { updateNote } = await import('@/lib/actions/client-ops');
                                await updateNote(item.id, {
                                    title: decryptedTitle,
                                    content: decryptedContent,
                                });
                            }
                        } else if (kind === 'task') {
                            const payload = (() => {
                                try { return JSON.parse(decryptedContent); } catch { return null; }
                            })();
                            if (payload) {
                                const { tasks: taskApi, buildTaskPermissions } = await import('@/lib/kylrixflow');
                                await taskApi.create({
                                    title: payload.title || decryptedTitle,
                                    description: payload.detail || '',
                                    status: 'todo',
                                    priority: payload.priority || 'medium',
                                    dueDate: payload.dueAt ? new Date(payload.dueAt).toISOString() : null,
                                    userId: user.$id,
                                    tags: [],
                                    assigneeIds: [user.$id],
                                    attachmentIds: [],
                                    eventId: '',
                                    parentId: '',
                                    recurrenceRule: '',
                                }, buildTaskPermissions(user.$id, [user.$id]));
                            }
                        } else if (kind === 'password') {
                            const payload = (() => {
                                try { return JSON.parse(decryptedContent); } catch { return null; }
                            })();
                            if (payload) {
                                const { createCredential } = await import('@/lib/appwrite/vault');
                                await createCredential({
                                    userId: user.$id,
                                    itemType: 'login',
                                    name: decryptedTitle,
                                    username: payload.username || null,
                                    password: payload.password || null,
                                    totpId: payload.totpSecret || null,
                                    isFavorite: false,
                                });
                            }
                        } else if (kind === 'totp') {
                            const payload = (() => {
                                try { return JSON.parse(decryptedContent); } catch { return null; }
                            })();
                            if (payload) {
                                const { createTotpSecret } = await import('@/lib/appwrite/vault');
                                await createTotpSecret({
                                    userId: user.$id,
                                    issuer: payload.issuer || decryptedTitle || 'Imported',
                                    accountName: payload.account || payload.accountName || decryptedTitle || 'Authenticator',
                                    secretKey: payload.secret || payload.secretKey || '',
                                    algorithm: payload.algorithm || 'SHA1',
                                    digits: payload.digits || 6,
                                    period: payload.period || 30,
                                });
                            }
                        } else if (kind === 'project') {
                            const payload = (() => {
                                try { return JSON.parse(decryptedContent); } catch { return null; }
                            })();
                            const { ProjectsService } = await import('@/lib/appwrite/projects');
                            await ProjectsService.createProject({
                                title: decryptedTitle,
                                summary: payload?.description || '',
                                status: payload?.status || 'active',
                                visibility: 'public',
                                isPublic: true,
                                isGuest: true,
                            });
                        } else if (kind === 'tag') {
                            const { createStandaloneTag } = await import('@/lib/actions/client-ops');
                            await createStandaloneTag(decryptedTitle);
                        } else {
                            // Note
                            const { createNote } = await import('@/lib/actions/client-ops');
                            await createNote({
                                title: decryptedTitle,
                                content: decryptedContent,
                                format: 'markdown',
                                tags: [],
                                isPublic: false,
                                isGuest: false,
                            });
                        }

                        // Remove from remaining list
                        const idx = remainingHistory.findIndex(h => h.id === item.id);
                        if (idx !== -1) {
                            remainingHistory.splice(idx, 1);
                        }
                    } catch (itemErr) {
                        console.error(`[GhostClaimer] Failed to claim item ${item.id}:`, itemErr);
                    }
                }

                // Update localStorage with any items that failed to claim
                if (remainingHistory.length === 0) {
                    localStorage.removeItem(GHOST_STORAGE_KEY);
                    localStorage.removeItem(GHOST_SECRET_KEY);
                    console.log('[GhostClaimer] All ghost items claimed successfully.');
                } else {
                    localStorage.setItem(GHOST_STORAGE_KEY, JSON.stringify(remainingHistory));
                }

                // Dispatch event to refresh UI
                window.dispatchEvent(new Event('storage'));
                window.dispatchEvent(new CustomEvent('kylrix:ghost-claimed'));
            } catch (e) {
                console.error('[GhostClaimer] Error processing ghost history:', e);
            } finally {
                isClaiming.current = false;
            }
        };

        claimGhostNotes();

        if (typeof window !== 'undefined') {
            const handleOnline = () => {
                if (isAuthenticated && user?.$id && !isClaiming.current) {
                    void claimGhostNotes();
                }
            };
            window.addEventListener('online', handleOnline);
            return () => window.removeEventListener('online', handleOnline);
        }
    }, [isAuthenticated, user?.$id]);

    return null; // Renderless component
};
