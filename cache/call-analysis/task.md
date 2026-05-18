# Analysis: Kylrix Calling Infrastructure Dysfunction

## Overview
The Kylrix calling feature uses a hybrid approach attempting to use Cloudflare's WebRTC SFU (RTC) via P2P signaling, with a fallback to pure P2P. Both paths currently fail, preventing multi-party interaction and successful media stream exchange.

## Technical Analysis
1.  **Signaling Mismatch**: The `WebRTCManager` uses Appwrite's real-time signaling (events.onSignal) but the signaling payload structure is rudimentary. It lacks robust handling for multi-peer negotiation or room-based signaling (it is currently point-to-point only).
2.  **Cloudflare SFU Integration**: 
    - The `createCloudflareSession` and `createCloudflareTracks` server-side API calls are implemented, but the `WebRTCManager` doesn't properly subscribe the remote client to the SFU tracks retrieved from the Cloudflare API.
    - Cloudflare WebRTC requires the client to explicitly subscribe to specific tracks based on the session ID. The current implementation creates a session and tracks but fails to provide the remote client with the SFU endpoint or the track-subscription logic.
3.  **ICE Candidates**: ICE candidate exchange is highly latent or fails in multi-network environments (NAT traversal). STUN servers are configured, but TURN is completely absent, which is fatal for many real-world P2P scenarios where NATs block hole-punching.
4.  **Race Conditions**: `processCandidateQueue` is implemented, but the peer connection state management between Cloudflare SFU tracks and P2P signaling is non-deterministic.
5.  **MediaStream Handling**: The `createPeerConnection` logic adds tracks before `setRemoteDescription` is reliably negotiated, which can cause track negotiation failures in most modern browser WebRTC stacks (specifically regarding unified-plan behavior).

## Identified Failure Points
- **Lack of TURN**: Without TURN servers, P2P falls back to STUN, which fails 50-70% of the time in symmetric NAT or restricted firewalls.
- **Incomplete Cloudflare Implementation**: The client-side SFU subscribe logic is nonexistent. It creates tracks but never fetches or renders the stream corresponding to the SFU session.
- **Non-Deterministic Signaling**: The `WebRTCManager` acts as both an SFU client and a P2P agent without clear separation, leading to SDP collision between the SFU-negotiated tracks and P2P-negotiated tracks.
