---
name: sync
description: Canonical offline-first local-first sync engine, RxDB / IndexedDB substrate, pending sync queues, and database reconciliation in Kylrix.
---

# Offline-First Data & Autonomic Sync Architecture

## 1. Core Sync Tenet: Local-First Single Source of Truth
- **Live Copy is SoT**: Local UI state immediately renders from the local RxDB/IndexedDB substrate.
- **Autonomic Sync Engine**: Changes are queued in a persistent local pending queue (amber state) and asynchronously dispatched to Appwrite backend (green state when confirmed).
- **RxDB / IndexedDB Substrate**: Strictly use RxDB / LocalEngine for local storage. Never store structured application data in browser \`localStorage\`.

## 2. Merge Reconciliation & Query Caching
- **Soft Merge**: When remote data arrives, reconcile with pending local modifications to avoid overwriting uncommitted edits.
- **Detail Views Must Not Auto-Save Blindly**: Edit forms hold draft state in memory or dedicated draft stores until user save/commit, preventing mid-typing remote overwrite clobbers.
- **Read-Through TablesDB Row Cache**: Server and client data layers utilize row caching with coalesced inflight queries to eliminate thundering herd requests.

## 3. Cascading-on-Demand (CoD) & Client-Side Filtering
- Prefer fetching clean baseline entity sets and applying fast client-side filtering/sorting for pinned and shared views rather than complex, brittle multi-compound database queries.
