---
name: why.webrtc-huddles
description: Deep dive into the WebRTC real-time calls and audio/video mesh architecture in Kylrix. Explains direct P2P vs Cloudflare SFU transport modes, device dynamic hot-swapping, and integrated MediaRecording archives.
---

# Why: WebRTC Mesh calls & SFU Cloudflare Signaling

Real-time audio and video communications in web browsers must adapt dynamically to network conditions. Direct Peer-to-Peer (P2P) connections are great for one-on-one calls but fail in group calls due to high bandwidth demands. We also need high-quality audio call archiving.

We solve these challenges using the hybrid connection engine in `lib/webrtc/WebRTCManager.ts`.

## 1. Dual-Transport Architecture: P2P and SFU Modes

The manager implements both P2P (direct) and SFU (Selective Forwarding Unit) topologies to optimize performance:
- **P2P Mode** (`p2pPeerConnection`): Links two peers directly using standard Google STUN/TURN servers to bypass firewalls and minimize network hop latency.
- **SFU Mode** (`sfuPeerConnection`): Uses Cloudflare Calls API to route group call media. Instead of sending media to every participant, each client uploads their stream **once** to Cloudflare, which distributes it to the other group members:

```typescript
private get peerConnection(): RTCPeerConnection | null {
  return this.isSfuMode ? this.sfuPeerConnection : this.p2pPeerConnection;
}

private async fetchCloudflareSession() {
  if (this.sessionId) return { sessionId: this.sessionId, sessionToken: this.cloudflareSessionToken };
  const data = await createCloudflareSession();
  this.sessionId = data.sessionId;
  this.cloudflareSessionToken = data.sessionToken;
  return data;
}
```

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
