import React from 'react';
import SharedNoteClient from '../SharedNoteClient';

export async function generateMetadata({ params: _params }: { params: Promise<{ noteid: string; key?: string[] }> }) {
   return {
     title: 'Shared Note • Kylrix Note',
     description: 'This is a secure note shared via Kylrix.'
   };
}

export default async function SharedNotePage({ params }: { params: Promise<{ noteid: string; key?: string[] }> }) {
   const { noteid, key } = await params;
   return <SharedNoteClient noteId={noteid} initialKey={key?.join('/') || undefined} />;
}
