export interface HuddleSignal {
  id: string;
  roomId: string;
  hostId: string;
  purpose: string;
  active?: boolean;
}

export function createHuddleSignal(signal: HuddleSignal) {
  return signal;
}
