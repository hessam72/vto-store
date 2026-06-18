---
name: redis-expert
description: Specialist in Redis data structures, caching strategies, and Redis Search (RediSearch). Use this when the user is designing real-time systems, pub/sub architectures, or high-speed caching layers.
---

# Redis Expert Skill

## 🧠 Data Structure Selection
* **Strings:** For simple K/V pairs or atomic counters (`INCR`).
* **Hashes:** For objects with multiple fields; more memory-efficient than storing JSON strings.
* **Sorted Sets (ZSET):** For leaderboards, rate limiters, or priority queues.
* **Streams:** For high-throughput message bus patterns.

## ⚡ Performance Best Practices
* **Avoid KEYS *:** Never use the `KEYS` command in production. Use `SCAN` to prevent blocking the main thread.
* **Pipeline Requests:** Group multiple commands into a single RTT (Round Trip Time) using Pipelining to increase throughput.
* **Memory Policy:** Set an explicit `maxmemory-policy` (e.g., `allkeys-lru`) to prevent OOM (Out of Memory) crashes.

## 🔍 Redis Search (FT.*)
* **TAG vs TEXT:** Use `TAG` for exact matches (IDs, Categories) and `TEXT` only for full-text search to save memory.
* **FT.PROFILE:** Use this to debug slow search queries and identify which part of the filter is most expensive.
* **Dialect 2:** Always default to `DIALECT 2` for modern query parsing and better performance.