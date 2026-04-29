export interface MomentSignal {
  id: string;
  authorId: string;
  body: string;
  createdAt?: string;
  visibility?: 'private' | 'shared' | 'link';
}

export function createMomentSignal(signal: MomentSignal) {
  return signal;
}
