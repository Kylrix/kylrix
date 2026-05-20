# 🏴 Kylrix Ecosystem

> **The Sovereign Agentic Operating System.** One platform. Zero friction. A deeply interconnected, zero-knowledge workspace where people create, agents execute, and workflows flow without boundaries.

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-black.svg?style=flat-square)](https://www.gnu.org/licenses/agpl-3.0)
[![Built with Next.js](https://img.shields.io/badge/Frontend-Next.js%2016-black?style=flat-square&logo=nextdotjs)](https://nextjs.org/)
[![Backend: Appwrite](https://img.shields.io/badge/Backend-Appwrite-black?style=flat-square&logo=appwrite)](https://appwrite.io/)
[![Crypto: Web Crypto API](https://img.shields.io/badge/Crypto-Web%20Crypto%20API-pink?style=flat-square)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)

---

## 💡 The Genesis Story

Kylrix was born out of raw frustration. 

As builders, we became completely exhausted by the constant app-juggling act required just to accomplish daily work. Moving between **Notion** for documentation, **Slack** for communication, **1Password** for credentials, and **Google Docs/Keep** for fast tracking felt archaic. The digital workspace had become an entirely fragmented mess of data silos, context switching, and endless platform fees. 

We asked ourselves a fundamental question: **Why isn't there a premium, open-source platform that unifies all of these utilities into a single, cohesive layer?**

Then, the AI agentic revolution arrived, and it became clear: this was the exact moment to design the future of productivity. Kylrix was engineered from the ground up to solve this paradigm. It is an end-to-end interconnected workspace where data is genuinely secured, completely open source with nothing hidden, free of telemetry or marketing fluff, and fully self-hostable. **There is absolutely nothing in existence today that can boast this level of premium utility combined with cryptographic openness, security, and user freedom. Absolutely nothing.**

---

## 🪐 The Holy Grail: Ecosystem Integration

In Kylrix, **everything is an object, and Projects are the ultimate gravity wells.** We have completely dismantled the walls between app modules. Instead of separate data containers, every asset floats within a highly contextual, single ecosystem grid.

```text
              ┌──────────────────────────────┐
              │      PROJECT OBJECT          │
              └──────────────┬───────────────┘
                             │
     ┌───────────────────────┼───────────────────────┐
     ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Dynamic Notes   │     │ Secure Vaults   │     │ Actionable Goals│
│ & Deep Context  │     │ & Secret Deleg. │     │ & Task Threads  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 💎 Rich Context Object Modeling
* **Interlinked Knowledge Webs:** A project is not just a folder; it is an active web. Link multiple notes together seamlessly within a workspace to feed deep context to human contributors and automated agents alike.
* **Granular Permission Topologies:** Add collaborators with highly precise control parameters (`read`, `write`, `admin`). 

### 🤯 The Secret Delegation Breakthrough (Human & Agent)
We engineered a profound UX breakthrough in secure sharing. Through our cryptographic pipeline, you can securely grant project access to highly sensitive items—like operational server passwords or TOTP seeds—to a assigned collaborator or cloud agent. 
* The assignee or agent borrows that programmatic permission to execute the required work.
* **They never see or leak the underlying raw secret components.**
* Once the execution loop concludes, the credential permissions are instantly withdrawn from the project layer.

### 💬 High-Velocity Communication Matrix
* **Contextual Threads:** Stop polluting generalized chat rooms. Communication happens directly inside specific task objects and note canvases, preserving historical execution context precisely where the work lives.
* **Hangouts & Live Huddles:** Spin up multiple project threads, convert conversations into dedicated multi-peer groups called **Hangouts**, or instantly launch a live video/audio huddle via `WebRTCManager.ts`. You do not need Google Meet or Zoom. Create an event, toggle it public or private, and an active huddle is spawned immediately.

---

## ⚡ Flagship Innovation: Realtime Ingestion Forms

Kylrix introduces a monumental utility workflow missing from traditional suites: **Autonomous Ingestion Forms.**

```text
[ Public / Internal Form ] ──(Realtime Ingestion)──► [ Project Goal Engine ]
│
┌────────┴────────┐
▼                 ▼
[ Subtask Array ]   [ Blog Post ]
```

1. **Native Creation:** Spin up a structured form right inside the ecosystem without relying on external builders.
2. **Realtime Ingestion:** As soon as an internal collaborator or external guest submits a response, Kylrix automatically ingests the payload in real time.
3. **Actionable Conversion:** The submission is immediately transformed into high-priority **Goals** (our ecosystem terminology for tasks) inside your designated project, completely mapped with deep nested subtasks. 
4. **The Complete Lifecycle Loop:** We use this exact feature internally to develop Kylrix itself—accepting feature request forms that instantly become project milestones. Once resolved, collaborators can seamlessly convert those completed tasks directly into **Articles/Blogs** to document the solution, publishing them through an internal mini-blog architecture viewable both inside the network or exported as external public assets.

---

## 💳 The Effortless Crypto UX Wallet Layer

Crypto user experience is notoriously broken. Even solutions claiming to fix web3 fragmentation fail to integrate natively at a meaningful workspace scale. Kylrix completely solves this disconnect.

* **Dual-Architecture Infrastructure:** Every single user and their autonomous agents are assigned fully integrated, completely **non-custodial wallets** out of the box.
* **Effortless Transfers:** Human peers can stream assets to other collaborators or fund an agent's operational balance instantly and natively within their chat thread or task card.
* **The Absolute Best of Both Worlds:** Users navigate peer transfers seamlessly without ever feeling the underlying complexity of gas tokens or complex infrastructure layout. Yet, because the wallet is truly non-custodial, the underlying keys remain entirely accessible and under the user's sovereign control the exact second they choose to export them.

---

## 🔒 Deep Cryptographic Security: WESP

Kylrix relies on the **Web Ecosystem Security Protocol (WESP)** to maintain an ironclad, zero-knowledge perimeter.

| Security Component | Implementation Protocol | Sovereign Advantage |
| :--- | :--- | :--- |
| **Master Key Derivation** | `PBKDF2-HMAC-SHA256` (600k Iterations) | Complete brute-force immunity inside client device runtimes. |
| **Data At Rest** | `AES-256-GCM` Client-Side Core | The server only holds ciphertext. Zero provider oversight. |
| **P2P Identity Handoff** | **X25519** Elliptic Curve Diffie-Hellman | Secure key wrapping and exchange without network tracking. |
| **Session Control** | Ephemeral PIN Piggybacking | Short-pin re-unlock flows isolated strictly to volatile RAM. |
| **Zero-Lock-In Rule** | Standard Symmetric JSON Export | **We never lock you in.** Every single byte of data is instantly exportable. |

### 🛑 Responsible Security Disclosure
We take infrastructure integrity with absolute seriousness. If you discover a legitimate, critical cryptographic or system vulnerability within the Kylrix ecosystem, **do not create a public GitHub issue.** Doing so endangers active sovereign environments.

Please route comprehensive proof-of-concept logs directly to: **`security@kylrix.space`**

We are committed to reviewing legitimate, responsibly disclosed security concerns promptly, and valid critical bugs will receive appropriate rewards.

---

## 🗲 Technical Stack

* **Frontend Engine:** Next.js 16 (Turbopack optimization), React 19, TypeScript.
* **Data Core Caching:** `context/DataNexusContext.tsx` providing memory deduplication and background sync.
* **Sovereign Backend:** Self-hosted Appwrite infrastructure running with maxed out open-file descriptors for high-capacity asynchronous worker pools (`_APP_WORKER_PER_CORE=8`).
* **UI Aesthetic:** **Muted Bold (V3)** — Pure OLED pitch black (`#000000`), deep graphite surface elevators, and fluid global drawer actions.

---

## 🛠️ Get Started in 60 Seconds

We believe contributing should be free of environment configuration hell. 

1. **Clone the Source Tree:**
   ```bash
   git clone https://github.com/Kylrix/kylrix.git
   cd kylrix
   ```

2. **Install & Launch:**
   ```bash
   pnpm install
   pnpm dev
   ```

Open your browser to **`http://localhost:3005`**. For a deeper guide on contributing, please read our [CONTRIBUTING.md](CONTRIBUTING.md).

---

**Build freely. Coordinate flawlessly. Work while you sleep.** 🌙
