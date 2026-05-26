# Kylrix Federation & Peer Node Roadmap ⬢

This roadmap outlines the milestones, cryptographic protocols, and data synchronization algorithms required to transition Kylrix into a decentralized network of federated nodes. 

Under this architecture, every Kylrix installation (whether the official cloud instance, a local CLI, or a self-hosted server) operates as an independent, secure **Node**. Users can seamlessly run private instances, authenticate securely across peer boundaries, and selectively synchronize database tables and rows without requiring 1:1 replica parity.

---

## 🛰️ 1. Node Identity & Cryptographic Trust Foundation

To enable secure, peer-to-peer federated communication without central single-points-of-failure, every instance must establish independent cryptographic authority.

- [x] **Instance Node Key-Pair Generation**:
  - Implement a secure setup utility that automatically generates a unique Ed25519 keypair (Node Identity Key) on initial instance booting.
  - Securely persist the private key in the local vault keychain, while exposing the public key via a standard public metadata endpoint.
- [x] **Node Verification & Cryptographic Handshakes**:
  - Define a lightweight handshake protocol (`/connect` / `/challenge`) where a node proves identity ownership by signing an ephemeral challenge payload using its Node Identity Key.
  - Implement a trust-level registry categorizing nodes:
    - **Verified Core Nodes** (Official secure cloud anchors).
    - **Self-Hosted Verified Nodes** (User-run nodes authenticated via masterpass signature).
    - **Guest/Ephemeral Nodes** (TUI clients, CLI shells).
- [ ] **Zero-Trust Access Control**:
  - Secure inter-node API channels using cryptographically signed headers, preventing replay attacks via high-resolution timestamps and request-body HMAC assertions.

---

## 🔄 2. Foundation for Smart Table & Row Synchronization

Synchronization in a federated environment must be selective, high-performance, and resilient to arbitrary connection dropouts.

- [ ] **Table Metadata & Vector Vector-Clock Integration**:
  - Define a local database table tracking **Row Merges & Synchronizations** (`sync_vector_clocks`).
  - Upgrade key table rows (Notes, Tasks, Credentials) with logical version counters to dynamically track modification lineages without relying solely on system wall-clocks.
- [x] **Foundational Local Diffing Engine**:
  - Implement a highly optimized, fully in-app **Row Diffing Algorithm**:
    - **Step 1 (Digest Generation)**: Calculate lightweight SHA-256 cryptographic hashes for every table row based on normalized, key-sorted fields.
    - **Step 2 (Merkle Table Trees)**: Group row digests into chronological buckets (e.g. daily, hourly) to allow peers to rapidly pinpoint divergent timeframes in a single metadata handshake.
    - **Step 3 (Delta Discovery)**: Discover exactly which row IDs are missing, newer, or conflicting between two nodes using cheap metadata exchanges before streaming actual payloads.
- [x] **Conflict Resolution & Merge Strategies**:
  - Design a Last-Write-Wins (LWW) conflict resolver that falls back to explicit user-driven merging when structural divergence occurs.
  - For structured documents (e.g. notes, tags), implement a delta merge strategy utilizing simple text patches rather than overwriting entire rows.

---

## 🏡 3. Self-Hosting Incentives & Multi-Node Handshake

Self-hosting should be a first-class feature that integrates seamlessly with the wider ecosystem, rather than an isolated silo.

- [ ] **Federated Authenticated Bridge**:
  - Allow a user on a local CLI client or a mobile shell to authenticate against a self-hosted node by pointing to its custom URI (e.g., `https://my-node.space`).
  - The self-hosted node issues a standard, verified JWT token signed by its private key, allowing the client to execute secure CRUD operations.
- [ ] **Selective Up-and-Down Sync**:
  - Implement dynamic UI/UX controls enabling users to configure selective sync filters (e.g., *"Only sync notes tagged with #shared to the Verified Core Node"*).
  - Enable bidirectional sync of secure vault credentials, maintaining strict security guarantees: credentials remain encrypted on the user's client using their Master Encryption Key (MEK) and are never exposed as plaintext during synchronization.
- [ ] **Node Directory & Discovery**:
  - Establish a voluntary gossip table mapping known federated nodes to help peer instances announce their presence and share system health updates.

