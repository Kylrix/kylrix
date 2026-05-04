export type AttachmentEntityType = 'vault' | 'note' | 'flow' | 'form';
export type AttachmentSubType = 'totp' | 'password' | 'task' | 'ghost_note' | 'form_template';

export type PeerState = 'idle' | 'calling' | 'incoming' | 'connected' | 'disconnected' | 'failed' | 'new' | 'connecting';

export interface SignalData {
    type: 'offer' | 'answer' | 'candidate';
    sdp?: string;
    candidate?: RTCIceCandidateInit;
    sender: string;
    target: string;
    cloudflareSessionId?: string;
    cloudflareTracks?: any[];
}

export interface PeerConnectionEvents {
    onSignal: (data: SignalData) => void;
    onTrack: (stream: MediaStream) => void;
    onStateChange: (state: PeerState) => void;
    onData?: (data: any) => void;
    onError?: (error: Error) => void;
}

export interface AttachmentMetadata {
    type: 'attachment';
    entity: AttachmentEntityType;
    subType: AttachmentSubType;
    referenceId: string;
    payload: {
        label: string;
        preview?: string;
        expiry?: string;
        // For TOTP Double-Pulse
        currentCode?: string;
        nextCode?: string;
        // For Tasks
        isCompleted?: boolean;
        // For Forms
        formTitle?: string;
    };
}
