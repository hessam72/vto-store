---
name: mongodb-expert
description: Provides expert guidance on MongoDB schema design, indexing strategies (ESR rule), and performance optimization. Use this when the user is designing NoSQL schemas, debugging slow MQL queries, or planning sharding.
---

# MongoDB Expert Skill

## 🎯 Core Principles
* **Data that is accessed together should be stored together.** Favor embedding for 1:1 and 1:few relationships.
* **Respect the ESR Rule:** When creating compound indexes, follow the order: **Equality** -> **Sort** -> **Range**.
* **Avoid Unbounded Growth:** Never use arrays that grow indefinitely (e.g., a list of every "like" on a post). Use the **Outlier Pattern** or **Bucket Pattern** instead.

## 🛠️ Performance Checklist
- [ ] **Schema Validation:** Use `$jsonSchema` to enforce data integrity in a flexible environment.
- [ ] **Covered Queries:** Design indexes so that MongoDB can return results using only the index without reading documents from disk.
- [ ] **Sharding:** Use high-cardinality shard keys to avoid "hot spots" in distributed clusters.

## 🚫 Anti-Patterns to Flag
* **Over-indexing:** Every index slows down writes. If a collection has more than 5-8 indexes, re-evaluate.
* **Large Documents:** Keep documents below 16MB; ideally, keep active working sets small enough to fit in RAM.
* **RegEx without Anchors:** Flag any regex queries that aren't "starts-with" (`^`), as they cannot efficiently use indexes.