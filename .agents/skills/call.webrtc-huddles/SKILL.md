---
name: call.webrtc-huddles
description: Deep dive into the WebRTC real-time calls architecture in Kylrix. Explains direct P2P transport, presence signaling, device dynamic hot-swapping, and integrated MediaRecording archives.
---

# Why: WebRTC Pure P2P Calling & Ephemeral Presence Signaling

Real-time audio and video communications in web browsers must be fast, private, and maintenance-free. Direct Peer-to-Peer (P2P) connections link peers directly with zero intermediate server overhead.

We implement this in `lib/webrtc/WebRTCManager.ts`.

## 1. Pure Direct P2P Architecture

The manager uses direct P2P `RTCPeerConnection` for seamless voice/video communications with Google STUN / Cloudflare TURN for NAT traversal:
- Links peers directly with minimal network hop latency.
- Uses ephemeral presence channels for instant SDP offer/answer exchange without database writes.

## 2. Dynamic Input Device Hot-Swapping

In call interfaces, letting users switch microphones or cameras without disconnecting the active call is crucial. The engine swaps raw media tracks in real time:

```typescript
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
    if (sender) await sender.replaceTrack(newTrack); // Swap track
  }
}
```

## 3. ICE Candidate Queue Buffering

When WebRTC connections are establishing, ICE candidates are often received before the browser has finished setting up the Remote Description. Directly adding these early candidates causes browser errors.

We buffer incoming candidates until the connection description is ready:

```typescript
private candidateQueue: RTCIceCandidateInit[] = [];
private isRemoteDescriptionSet = false;

public async addIceCandidate(candidate: RTCIceCandidateInit) {
  if (!this.isRemoteDescriptionSet) {
    this.candidateQueue.push(candidate);
    return;
  }
  await this.peerConnection?.addIceCandidate(candidate);
}
```

## 4. Archiving with MediaRecorder

To support secure call archiving, the engine combines local and remote audio tracks into a single stream and records it using the standard `MediaRecorder` API:

```typescript
const tracks = [
  ...(this.remoteStream ? this.remoteStream.getTracks() : []),
  ...(this.localStream ? this.localStream.getAudioTracks() : [])
];
const combinedStream = new MediaStream(tracks);
this.mediaRecorder = new MediaRecorder(combinedStream);
```

This records the conversation accurately while avoiding feedback loops.
