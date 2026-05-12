# Kylrix Ecosystem

Welcome to the **Kylrix Mono-App**, the unified Next.js engine powering the Kylrix ecosystem. This codebase consolidates the core services of Connect, Vault, Flow, and Note into a single, high-performance, and secure platform.

## 🪐 Philosophy: Deep Earth & Zero-Knowledge

Kylrix is built on two foundational pillars:
1.  **Muted V3 "Deep Earth" UI**: A professional, focused aesthetic utilizing an opaque, dark palette (`#0A0908` canvas) with hairline borders and zero translucency.
2.  **Zero-Knowledge Security**: A two-tier encryption model where sensitive data (Tier 2) is encrypted client-side using a Master Encryption Key (MEK) derived from your MasterPass or Passkey. Kylrix never sees your plaintext secrets.

---

## 🏗️ Core Architecture

-   **Frontend**: [Next.js 16 (Turbopack)](https://nextjs.org/) + [Material UI](https://mui.com/) + [Framer Motion](https://www.framer.com/motion/)
-   **Backend**: [Appwrite](https://appwrite.io/) (Databases, Auth, Storage, Messaging, Realtime)
-   **State & Security**: [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) for E2E encryption (X25519, AES-GCM)
-   **Intelligence**: Integrated AI agent workspace with Google Generative AI

### **The "Zero-API" Mandate**
Kylrix strictly avoids traditional RESTful API routes (`/api/*`) for core product logic. Instead, we utilize:
-   **Direct Client SDKs**: For low-latency, permission-gated reads and real-time synchronization.
-   **Secure Server Actions**: For administrative mutations and permission-heavy operations, utilizing JWT-based authentication to ensure session stability.

---

## 📱 Modules

### **💬 Connect**
- **E2E Encrypted Chat**: Secure p2p and group messaging with T4 epoch rotation.
- **Integrated Tipping**: Instant $KYLRIX transfers directly from chat detail.
- **Public Identities**: Discoverable user profiles with verified identity badges.

### **🛡️ Vault**
- **Zero-Knowledge Storage**: Securely manage passwords, TOTPs, and sensitive notes.
- **Secure Sharing**: MasterPass-backed credential sharing with fine-grained ACLs.
- **Identity Sync**: Automated profile updates upon security context changes.

### **⚡ Flow**
- **Task Management**: Collaborative task tracking with AI-assisted goal setting.
- **Dynamic Forms**: Powerful form engine with support for anonymous and authenticated submissions.
- **Engagement Analytics**: Real-time tracking of workspace productivity.

### **📝 Note**
- **Collaborative Editor**: Real-time markdown editing with revision history.
- **Ephemeral Notes**: Self-destructing notes for temporary data.
- **Seamless Export**: Port your data across the ecosystem in standard formats.

---

## 🛠️ Development

### **Prerequisites**
- [Node.js 20+](https://nodejs.org/)
- [pnpm 9+](https://pnpm.io/)
- [Appwrite CLI](https://appwrite.io/docs/command-line)

### **Setup**
1.  Clone the repository.
2.  Install dependencies: `pnpm install`
3.  Configure environment: Copy `env.sample` to `.env` and fill in your Appwrite credentials.
4.  Generate types: `pnpm aw:gen` (requires Appwrite login).
5.  Start dev server: `pnpm dev`

### **Engineering Standards**
- **No Tailwind**: Use Material UI components or Vanilla CSS modules.
- **Strict Types**: Ensure all data models extend `Models.Row` for compatibility with our `tablesDB` wrapper.
- **HMR Stability**: Logic-heavy code must reside in `lib/*-server.ts` utilities, with `actions/*.ts` kept as lean wrappers.

---

## 📜 License

Kylrix is licensed under the **AGPL-3.0**. Built with ❤️ for the privacy-first web.
