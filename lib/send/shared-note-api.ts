/** Public note fetch used by shared note + Send receive flows (Next route lives under /note/api). */
export function sharedNotePublicUrl(noteId: string): string {
  return `/note/api/shared/${noteId}`;
}
