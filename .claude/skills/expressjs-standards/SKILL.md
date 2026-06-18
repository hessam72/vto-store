---
name: expressjs-standards
description: Senior-level expertise in architecting scalable Node.js backends using Express 5.0+, TypeScript, and modern middleware patterns.
---

### Core Technical Standards
* **Express 5.0+ Native Async:** Leverage automatic error detection for Promises (no more `express-async-errors`).
* **ESM First:** Use ECMAScript Modules (`type: module`) as the default.
* **Strict Typing:** Explicitly type Request, Response, and Middleware using TypeScript.

### Architecture: The "Service Layer" Pattern
1.  **Routes/Controllers:** Handle request/response and parameter extraction.
2.  **Services:** House core business logic (agnostic of Express).
3.  **Data Access (DAL):** Interface with databases (Prisma, Mongoose).

### Security & Hardening
* **Boundary Validation:** Validate `req.body` and `req.params` with **Zod** middleware.
* **Security Headers:** Use `helmet()` with a strict Content Security Policy.
* **Rate Limiting:** Protect `/auth` and `/upload` routes via `express-rate-limit`.

### Observability & Error Handling
* **Centralized Error Handler:** Use a single middleware for consistent API error responses.
* **Structured Logging:** Replace console logs with **Pino**, including `request-id` for tracing.
* **Graceful Shutdown:** Listen for `SIGTERM` to close database pools before exit.

### Performance & Docker
* **Event Loop Monitoring:** Monitor lag using APM tools.
* **Connection Pooling:** Initialize DB clients as singletons with proper pooling.
* **Non-Root User:** Always run the app as the `node` user in Docker containers.
