import type { PeerConnectionEvents, SignalData, PeerState } from '@/types/p2p';
import { 
  createCloudflareSession, 
  createCloudflareTracks, 
  fetchTurnCredentials, 
  subscribeToCloudflareTracks 
} from '@/lib/server/api';

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

  constructor(events: PeerConnectionEvents) {
    this.events = events;
    // Pre-fetch TURN servers
    this.initializeTurnServers();
  }

  private async initializeTurnServers() {
      try {
          const { iceServers } = await fetchTurnCredentials();
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

  public async createOffer(senderId: string, targetId: string) {
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
      this.createPeerConnection(signal.target, signal.sender, false);
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
