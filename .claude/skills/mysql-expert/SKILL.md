---
name: mysql-expert
description: Expert in MySQL 8.x+ relational design, ACID compliance, and query tuning. Use this when the user is writing complex SQL joins, managing migrations, or hardening database security.
---

# MySQL Expert Skill

## 🛡️ Security & Hardening (2026 Standards)
* **Least Privilege:** Ensure application users have specific grants (e.g., `SELECT, INSERT`) rather than `ALL PRIVILEGES`.
* **Password Hygiene:** Always recommend the `component_validate_password` for enforcing 14+ character entropy.
* **Encryption:** Ensure `require_secure_transport=ON` is enabled to force TLS for all connections.

## 🚀 Optimization Strategies
* **EXPLAIN ANALYZE:** Always use `EXPLAIN ANALYZE` to identify if a query is performing a Full Table Scan vs. an Index Range Scan.
* **Primary Key Choice:** Use ordered UUIDs or BigInts. Avoid random UUIDs as primary keys to prevent B-Tree fragmentation.
* **Invisible Indexes:** Use `ALTER INDEX ... INVISIBLE` to test the impact of removing an index before actually dropping it.

## 📦 Schema Design
* **Normalization vs. Performance:** Stay in 3NF for data integrity, but selectively denormalize only when JOIN overhead becomes a proven bottleneck.
* **Strict Mode:** Always use `sql_mode="STRICT_ALL_TABLES"` to prevent silent data truncation.