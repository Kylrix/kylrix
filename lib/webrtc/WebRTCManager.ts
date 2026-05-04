import type { PeerConnectionEvents, SignalData, PeerState } from '@/types/p2p';
import { createCloudflareSession, createCloudflareTracks } from '@/lib/server/api';

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private config: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ]
  };
  
  private events: PeerConnectionEvents;
  public state: PeerState = 'idle';
  private candidateQueue: RTCIceCandidateInit[] = [];
  private isRemoteDescriptionSet = false;
  private currentTargetId: string | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private screenStream: MediaStream | null = null;
  private sessionId: string | null = null;
  private cloudflareSessionToken: string | null = null;

  constructor(events: PeerConnectionEvents) {
    this.events = events;
  }

  private async fetchCloudflareSession() {
    if (this.sessionId) return { sessionId: this.sessionId, sessionToken: this.cloudflareSessionToken };
    
    console.log('[WebRTCManager] Fetching Cloudflare session...');
    const data = await createCloudflareSession();
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

  public createPeerConnection(senderId: string, targetId: string) {
    if (this.peerConnection) return;
    this.currentTargetId = targetId;

    console.log(`[WebRTCManager] Creating PeerConnection for ${senderId} -> ${targetId}`);
    this.peerConnection = new RTCPeerConnection(this.config);

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.currentTargetId) {
        console.log(`[WebRTCManager] ICE Candidate generated for ${this.currentTargetId}`);
        this.events.onSignal({
          type: 'candidate',
          candidate: event.candidate.toJSON(),
          target: this.currentTargetId,
          sender: senderId
        });
      }
    };

    this.peerConnection.ontrack = (event) => {
      console.log(`[WebRTCManager] Remote track received`);
      this.remoteStream = event.streams[0];
      this.events.onTrack(this.remoteStream);
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState as PeerState;
      console.log(`[WebRTCManager] Connection state changed: ${state}`);
      this.updateState(state);
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log(`[WebRTCManager] ICE state changed: ${this.peerConnection?.iceConnectionState}`);
    };

    // Add local tracks to connection
    if (this.localStream) {
      console.log(`[WebRTCManager] Adding ${this.localStream.getTracks().length} local tracks`);
      this.localStream.getTracks().forEach(track => {
        this.peerConnection?.addTrack(track, this.localStream!);
      });
    }
  }

  public async createOffer(senderId: string, targetId: string) {
    try {
            const { sessionId } = await this.fetchCloudflareSession();
            this.createPeerConnection(senderId, targetId);
            if (!this.peerConnection) return;

      // Push local tracks to Cloudflare
      const tracks = this.localStream?.getTracks().map(track => ({
        location: "local",
        mid: track.kind === 'audio' ? '0' : '1',
        trackName: `${track.kind}-${senderId}`
      }));

      const trackData = await createCloudflareTracks({ sessionId, tracks: tracks || [] });

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
      this.createPeerConnection(senderId, targetId);
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

    public async handleSignal(signal: SignalData & { cloudflareSessionId?: string, cloudflareTracks?: any[], ts?: number }) {
    if (!this.peerConnection && signal.type === 'offer') {
      this.createPeerConnection(signal.target, signal.sender);
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

  private async processCandidateQueue() {
    for (const candidate of this.candidateQueue) {
      await this.peerConnection?.addIceCandidate(new RTCIceCandidate(candidate));
    }
    this.candidateQueue = [];
  }

  public cleanup() {
    this.localStream?.getTracks().forEach(track => track.stop());
    this.peerConnection?.close();
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.isRemoteDescriptionSet = false;
    this.candidateQueue = [];
    this.currentTargetId = null;
    this.updateState('disconnected');
  }

  private updateState(newState: PeerState) {
    this.state = newState;
    this.events.onStateChange(newState);
  }
}
