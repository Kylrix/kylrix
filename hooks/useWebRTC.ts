import { useState, useEffect, useRef, useCallback } from 'react';
import { WebRTCManager } from '@/lib/webrtc/WebRTCManager';
import { CallRecorder } from '@/lib/webrtc/CallRecorder';
import type { SignalData, PeerState } from '@/types/p2p';

export function useWebRTC(userId: string) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<PeerState>('idle');
  const [isRecording, setIsRecording] = useState(false);
  const [roomId, setRoomId] = useState<string>('');
  
  const rtcManager = useRef<WebRTCManager | null>(null);
  const recorder = useRef<CallRecorder | null>(null);
  const signalingChannel = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    // Initialize WebRTC Manager
    rtcManager.current = new WebRTCManager({
      onTrack: (stream) => setRemoteStream(stream),
      onData: (data) => console.log('Data received:', data),
      onStateChange: (state) => setConnectionState(state),
      onSignal: (signal) => {
        // Send signal via BroadcastChannel
        if (signalingChannel.current) {
          signalingChannel.current.postMessage(signal);
        }
      }
    });

    recorder.current = new CallRecorder();

    return () => {
      rtcManager.current?.cleanup();
      signalingChannel.current?.close();
    };
  }, []);

  const joinRoom = useCallback((id: string) => {
    if (signalingChannel.current) {
      signalingChannel.current.close();
    }

    setRoomId(id);
    const channel = new BroadcastChannel(`kylrix-room-${id}`);
    signalingChannel.current = channel;

    channel.onmessage = async (event) => {
      const signal: SignalData = event.data;
      
      // Ignore own messages
      if (signal.sender === userId) return;

      console.log('RECEIVED SIGNAL:', signal.type, 'FROM', signal.sender);

      if (!rtcManager.current) return;

      // Auto-initialize local stream if receiving an offer and not yet set up
      if (signal.type === 'offer' && !localStream) {
         try {
            const stream = await rtcManager.current.initializeLocalStream(true, true);
            setLocalStream(stream);
         } catch (e: unknown) {
            console.error("Failed to initialize stream on incoming call", e);
         }
      }

      await rtcManager.current.handleSignal(signal);
    };
  }, [userId, localStream]);

  const startCall = async (video = true, audio = true) => {
    if (!rtcManager.current || !roomId) return;
    
    // Initialize stream if not already done
    if (!localStream) {
      const stream = await rtcManager.current.initializeLocalStream(video, audio);
      setLocalStream(stream);
    }

    // Create offer - target is "broadcast" for this demo
    await rtcManager.current.createOffer(userId, 'broadcast');
  };

  const startRecording = () => {
    if (localStream && remoteStream && recorder.current) {
      recorder.current.startRecording(localStream, remoteStream);
      setIsRecording(true);
    }
  };

  const stopRecording = async () => {
    if (recorder.current && isRecording) {
      const blob = await recorder.current.stopRecording();
      setIsRecording(false);
      
      // Auto-download for now
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `call-recording-${new Date().toISOString()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return {
    localStream,
    remoteStream,
    connectionState,
    startCall,
    joinRoom,
    startRecording,
    stopRecording,
    isRecording
  };
}
