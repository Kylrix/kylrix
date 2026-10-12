---
name: agents
description: Autonomous AI agents in Kylrix. Provisioning keys, MEK client-side encryption, multi-chain sovereign identity, and REST endpoints.
---

# Autonomous AI Agents Architecture

## 1. Agent Provisioning & Zero-Trust Keys
- Autonomous agents operate strictly within designated agentic workspaces (\`isAgentic: true\`).
- Authenticate via zero-trust Agent Provisioning Keys.

## 2. Sovereign Identity & Multi-Chain Derivation
- Each agent receives a sovereign 12-word BIP-39 mnemonic phrase deriving deterministic EVM, Solana, Bitcoin, and Sui addresses.
- Agent MEK is encrypted with the user Master Key (Gold Key -> Silver Key hierarchy).
- All entity creations inherit the human account \`userId\` to prevent orphaned rows.
