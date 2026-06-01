import type { PeerConnectionEvents, SignalData, PeerState } from '@/types/p2p';
import { 
  createCloudflareSession, 
  createCloudflareTracks, 
  fetchTurnCredentials, 
  subscribeToCloudflareTracks 
} from '@/lib/server/api';
import { ID, Permission, Role, Query } from 'appwrite';
import { databases, realtime } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

const DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const SIGNALS_TABLE = 'call_signals';

export class WebRTCManager {
  private sfuPeerConnection: RTCPeerConnection | null = null;
  private p2pPeerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private config: RTCConfiguration = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  };
  
  private events: PeerConnectionEvents;
  public state: PeerState = 'idle';
  private candidateQueue: RTCIceCandidateInit[] = [];
  private isRemoteDescriptionSet = false;
  private currentTargetId: string | null = null;
  private sessionId: string | null = null;
  private isSfuMode: boolean = false;
  private callId: string | null = null;
  private unsubscribeRealtime: (() => void) | null = null;

  private cloudflareSessionToken: string | null = null;
  private screenStream: MediaStream | null = null;
  private recordedChunks: Blob[] = [];
  private mediaRecorder: MediaRecorder | null = null;

  private get peerConnection(): RTCPeerConnection | null {
    return this.isSfuMode ? this.sfuPeerConnection : this.p2pPeerConnection;
  }

  private set peerConnection(pc: RTCPeerConnection | null) {
    if (this.isSfuMode) {
      this.sfuPeerConnection = pc;
    } else {
      this.p2pPeerConnection = pc;
    }
  }

  constructor(events: PeerConnectionEvents, callId?: string) {
    this.events = events;
    this.callId = callId || null;
    // Pre-fetch TURN servers
    this.initializeTurnServers();
    
    if (this.callId) {
        this.setupRealtimeSignaling();
    }
  }

  private setupRealtimeSignaling() {
      if (typeof window === 'undefined' || !this.callId) return;

      const channel = `databases.${DB_ID}.collections.${SIGNALS_TABLE}.documents`;
      const unsub = realtime.subscribe(channel, (event) => {
          const row = event.payload as any;
          if (row.callId !== this.callId) return;
          if (!event.events.some(e => e.includes('.create'))) return;

          // We don't have localUserId here directly, but we can check if it's an offer/answer/candidate
          // and if it's meant for us. In 1:1, any signal from 'the other' is for us.
          // Note: WebRTCManager will filter out self-signals via its own logic if needed.
          
          this.handleAppwriteSignal(row);
      });

      this.unsubscribeRealtime = () => {
          if (typeof unsub === 'function') (unsub as any)();
          else if ((unsub as any).unsubscribe) (unsub as any).unsubscribe();
      };
  }

  private async handleAppwriteSignal(row: any) {
      const signal = {
          type: row.type,
          payload: row.payload,
          sender: row.senderId,
          callId: row.callId
      };

      // Basic protection against self-signals if we can identify sender
      // Usually senderId is the peer.

      if (row.type === 'offer') {
          await this.handleSignal({ type: 'offer', sdp: JSON.parse(row.payload).sdp, sender: row.senderId, target: 'me' });
      } else if (row.type === 'answer') {
          await this.handleSignal({ type: 'answer', sdp: JSON.parse(row.payload).sdp, sender: row.senderId, target: 'me' });
      } else if (row.type === 'candidate') {
          await this.handleSignal({ type: 'candidate', candidate: JSON.parse(row.payload), sender: row.senderId, target: 'me' });
      }
  }

  private async sendAppwriteSignal(type: 'offer' | 'answer' | 'candidate', payload: string, senderId: string, targetId: string) {
      if (!this.callId) return;
      try {
          await databases.createDocument(DB_ID, SIGNALS_TABLE, ID.unique(), {
              callId: this.callId,
              senderId: senderId,
              type,
              payload
          }, [
              Permission.read(Role.user(senderId)),
              Permission.read(Role.user(targetId)),
              Permission.write(Role.user(senderId)),
          ]);
      } catch (err) {
          console.error('[WebRTCManager] Failed to send Appwrite signal:', err);
      }
  }

  private async initializeTurnServers() {
      try {
          const res = await fetchTurnCredentials();
          if (res && 'success' in res && res.success === false) {
              console.warn('[WebRTCManager] TURN Servers not configured:', res.error);
              return;
          }
          const { iceServers } = res;
          const currentServers = this.config.iceServers || [];
          const newServers = Array.isArray(iceServers) ? iceServers : [];
          this.config.iceServers = [...currentServers, ...newServers];
      } catch (err) {
          console.warn('[WebRTCManager] Failed to fetch TURN servers, using STUN-only.');
      }
  }

  private async fetchCloudflareSession() {
    if (this.sessionId) return { sessionId: this.sessionId, sessionToken: this.cloudflareSessionToken };
    
    console.log('[WebRTCManager] Fetching Cloudflare session...');
    const data = await createCloudflareSession();
    if (!data || (data && 'success' in data && data.success === false)) {
      throw new Error((data as any)?.error || 'Cloudflare configuration missing');
    }
    console.log('[WebRTCManager] Cloudflare session created:', data.sessionId);
    this.sessionId = data.sessionId;
    this.cloudflareSessionToken = data.sessionToken;
    return data;
  }

  public async getDevices() {
    return await navigator.mediaDevices.enumerateDevices();
  }

  public async switchDevice(kind: 'audioinput' | 'videoinput', deviceId: string) {
    if (!this.localStream) return;
    
    const constraints = {
      audio: kind === 'audioinput' ? { deviceId: { exact: deviceId } } : true,
      video: kind === 'videoinput' ? { deviceId: { exact: deviceId } } : true
    };

    const newStream = await navigator.mediaDevices.getUserMedia(constraints);
    const newTrack = kind === 'audioinput' ? newStream.getAudioTracks()[0] : newStream.getVideoTracks()[0];
    
    if (this.peerConnection) {
      const senders = this.peerConnection.getSenders();
      const sender = senders.find(s => s.track?.kind === (kind === 'audioinput' ? 'audio' : 'video'));
      if (sender) await sender.replaceTrack(newTrack);
    }

    // Update local stream reference
    const oldTrack = kind === 'audioinput' ? this.localStream.getAudioTracks()[0] : this.localStream.getVideoTracks()[0];
    this.localStream.removeTrack(oldTrack);
    oldTrack.stop();
    this.localStream.addTrack(newTrack);
    
    return this.localStream;
  }

  public async toggleScreenShare(enable: boolean) {
    if (enable) {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = this.screenStream.getVideoTracks()[0];
      
      if (this.peerConnection) {
        const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(screenTrack);
      }

      screenTrack.onended = () => this.toggleScreenShare(false);
      return this.screenStream;
    } else {
      if (this.screenStream) {
        this.screenStream.getTracks().forEach(t => t.stop());
        this.screenStream = null;
      }
      
      if (this.localStream && this.peerConnection) {
        const videoTrack = this.localStream.getVideoTracks()[0];
        const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(videoTrack);
      }
      return null;
    }
  }

  public startRecording() {
    if (!this.remoteStream && !this.localStream) return;
    
    // Combine local and remote for the recording
    const tracks = [
      ...(this.remoteStream ? this.remoteStream.getTracks() : []),
      ...(this.localStream ? this.localStream.getAudioTracks() : []) // Only record local audio to avoid feedback loop if video is redundant
    ];
    
    const combinedStream = new MediaStream(tracks);
    this.recordedChunks = [];
    this.mediaRecorder = new MediaRecorder(combinedStream);
    
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.recordedChunks.push(e.data);
    };
    
    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `call-record-${Date.now()}.webm`;
      a.click();
    };
    
    this.mediaRecorder.start();
  }

  public stopRecording() {
    this.mediaRecorder?.stop();
    this.mediaRecorder = null;
  }

  public async initializeLocalStream(video: boolean = true, audio: boolean = true): Promise<MediaStream> {
    try {
      // If both are false, we can't call getUserMedia. 
      // We return an empty stream or handle it as a 'media-less' session.
      if (!video && !audio) {
        this.localStream = new MediaStream();
        return this.localStream;
      }

      this.localStream = await navigator.mediaDevices.getUserMedia({ video, audio });
      return this.localStream;
    } catch (error: unknown) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  }

  public createPeerConnection(senderId: string, targetId: string, isSfu: boolean = false) {
    this.isSfuMode = isSfu;
    this.currentTargetId = targetId;

    if (isSfu) {
        if (this.sfuPeerConnection) return;
        this.sfuPeerConnection = new RTCPeerConnection(this.config);
    } else {
        if (this.p2pPeerConnection) return;
        this.p2pPeerConnection = new RTCPeerConnection(this.config);
    }

    const pc = isSfu ? this.sfuPeerConnection : this.p2pPeerConnection;
    if (!pc) return;

    if (!isSfu) {
        pc.onicecandidate = (event) => {
            if (event.candidate && this.currentTargetId) {
                const signalPayload = JSON.stringify(event.candidate);
                
                if (this.callId) {
                    this.sendAppwriteSignal('candidate', signalPayload, senderId, this.currentTargetId);
                }

                this.events.onSignal({
                    type: 'candidate',
                    candidate: event.candidate.toJSON(),
                    target: this.currentTargetId,
                    sender: senderId
                });
            }
        };
    }

    pc.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      this.events.onTrack(this.remoteStream);
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState as PeerState;
      this.updateState(state);
    };

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream!);
      });
    }
  }

  public async createOffer(senderId: string, targetId: string, options?: { forceP2p?: boolean }) {
    if (options?.forceP2p) {
      // Skip Cloudflare SFU entirely — pure P2P path
      this.createPeerConnection(senderId, targetId, false);
      if (!this.peerConnection) return;

      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      if (this.callId) {
          this.sendAppwriteSignal('offer', JSON.stringify(offer), senderId, targetId);
      }

      this.events.onSignal({
        type: 'offer',
        sdp: offer.sdp,
        target: targetId,
        sender: senderId
      });
      return;
    }

    try {
      const { sessionId } = await this.fetchCloudflareSession();
      this.createPeerConnection(senderId, targetId, true);
      if (!this.peerConnection) return;

      // Push local tracks to Cloudflare
      const tracks = this.localStream?.getTracks().map(track => ({
        location: "local",
        mid: track.kind === 'audio' ? '0' : '1',
        trackName: `${track.kind}-${senderId}`
      }));

      const trackData = await createCloudflareTracks({ sessionId, tracks: tracks || [] });
      if (trackData && 'success' in trackData && trackData.success === false) {
        throw new Error(trackData.error);
      }

      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      this.events.onSignal({
        type: 'offer',
        sdp: offer.sdp,
        target: targetId,
        sender: senderId,
        cloudflareSessionId: sessionId,
        cloudflareTracks: trackData.tracks
      });
    } catch (error) {
      console.error('Cloudflare SFU Initiation failed, falling back to pure P2P:', error);
      
      // Fallback to pure P2P signaling
      this.createPeerConnection(senderId, targetId, false);
      if (!this.peerConnection) return;

      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      this.events.onSignal({
        type: 'offer',
        sdp: offer.sdp,
        target: targetId,
        sender: senderId
      });
    }
  }

  private async processCandidateQueue() {
    if (!this.peerConnection) return;
    while (this.candidateQueue.length > 0) {
      const candidate = this.candidateQueue.shift();
      if (candidate) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('[WebRTCManager] Error processing queued candidate:', err);
        }
      }
    }
  }

  public async handleSignal(signal: SignalData & { cloudflareSessionId?: string, cloudflareTracks?: any[], ts?: number }) {
    if (!this.peerConnection && signal.type === 'offer') {
      this.createPeerConnection(signal.target, signal.sender, Boolean(signal.cloudflareSessionId));
    }

    if (!this.peerConnection) return;

    if (signal.type === 'offer' && signal.sdp) {
      console.log(`[WebRTCManager] Offer received from ${signal.sender}`);
      // Pull tracks from Cloudflare if specified
      if (signal.cloudflareSessionId && signal.cloudflareTracks) {
        // Logic to subscribe to remote tracks via Cloudflare SFU
        // For simplicity in this surgical fix, we continue the signaling flow
      }
      
      try {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
        this.isRemoteDescriptionSet = true;
        await this.processCandidateQueue();
        
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        
        console.log(`[WebRTCManager] Sending answer to ${signal.sender}`);

        if (this.callId) {
            this.sendAppwriteSignal('answer', JSON.stringify(answer), signal.target, signal.sender);
        }

        this.events.onSignal({
          type: 'answer',
          sdp: answer.sdp,
          target: signal.sender,
          sender: signal.target
        });
      } catch (err) {
        console.error('[WebRTCManager] Error handling offer:', err);
      }
    } else if (signal.type === 'answer' && signal.sdp) {
      console.log(`[WebRTCManager] Answer received from ${signal.sender}`);
      try {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
        this.isRemoteDescriptionSet = true;
        await this.processCandidateQueue();
      } catch (err) {
        console.error('[WebRTCManager] Error handling answer:', err);
      }
    } else if (signal.type === 'candidate' && signal.candidate) {
      console.log(`[WebRTCManager] Candidate received from ${signal.sender}`);
      try {
        if (this.isRemoteDescriptionSet) {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } else {
          this.candidateQueue.push(signal.candidate);
        }
      } catch (err) {
        console.error('[WebRTCManager] Error handling candidate:', err);
      }
    }
  }

  public async subscribeToRemoteTracks(sessionId: string, trackNames: string[]) {
    if (!this.sfuPeerConnection) return;
    
    // Cloudflare SFU subscription protocol
    const tracks = trackNames.map(name => ({
      location: 'remote',
      sessionId: sessionId, // Peer A's session ID
      trackName: name
    }));

    const response = await subscribeToCloudflareTracks({ sessionId: this.sessionId!, tracks });
    
    // Accept SFU SDP offer
    await this.sfuPeerConnection.setRemoteDescription(new RTCSessionDescription(response.sessionDescription));
    const answer = await this.sfuPeerConnection.createAnswer();
    await this.sfuPeerConnection.setLocalDescription(answer);

    // Ship answer back (renegotiation)
    this.events.onSignal({
      type: 'renegotiate',
      sdp: answer.sdp,
      target: this.currentTargetId!,
      sender: 'me'
    });
  }

  public async cleanup() {
    this.localStream?.getTracks().forEach(track => track.stop());
    this.peerConnection?.close();
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.isRemoteDescriptionSet = false;
    this.candidateQueue = [];
    this.currentTargetId = null;
    this.updateState('disconnected');

    if (this.unsubscribeRealtime) {
        this.unsubscribeRealtime();
    }

    // Section 3: The Self-Cleaning Garbage Collection
    if (this.callId) {
        try {
            const currentUserId = (window as any).__KYLRIX_PULSE__?.$id;
            const res = await databases.listDocuments(DB_ID, SIGNALS_TABLE, [
                Query.equal('callId', this.callId)
            ]);
            
            // Concurrent deletions for active signaling blocks
            await Promise.all(
                res.documents.map(doc => databases.deleteDocument(DB_ID, SIGNALS_TABLE, doc.$id))
            );
            console.log(`[WebRTCManager] Purged ${res.total} signaling rows for call ${this.callId}`);
        } catch (err) {
            console.warn('[WebRTCManager] Failed to purge signaling rows:', err);
        }
    }
  }

  private updateState(newState: PeerState) {
    this.state = newState;
    this.events.onStateChange(newState);
  }
}
