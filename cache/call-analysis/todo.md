# To-Do: Kylrix Calls Architecture Remediation

## Task Breakdown
- [ ] Research: Review Cloudflare Calls API documentation (sessions/new, tracks/new, subscribe) to confirm exact JSON schemas.
- [ ] Backend Service (lib/server/api.ts): Implement `fetchTurnCredentials` to retrieve Cloudflare TURN credentials.
- [ ] Backend Service (lib/server/api.ts): Implement `subscribeToCloudflareTracks` to handle downstream track subscription.
- [ ] Refactor WebRTCManager (lib/webrtc/WebRTCManager.ts):
    - [ ] Create `sfuPeerConnection` vs `p2pPeerConnection` isolation.
    - [ ] Update `RTCPeerConnection` instantiation to use the new Cloudflare TURN servers.
    - [ ] Implement SFU negotiation logic: stop P2P ICE candidate exchange when in SFU mode.
- [ ] Implement Subscription Dance:
    - [ ] Implement signal-based upstream track ID propagation (Peer A -> Peer B).
    - [ ] Implement downstream subscription orchestration (Peer B handles incoming track IDs).
- [ ] Validation: Test multi-party media establishment in browser environment.
