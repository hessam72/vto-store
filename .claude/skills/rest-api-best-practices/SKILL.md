---
name: rest-api-best-practices
description: Expert proficiency in designing, documenting, and implementing scalable, secure, and developer-friendly RESTful APIs using modern Node.js and Next.js environments.
---


## 1. Resource Design & URI Standards

* **Resource-Oriented URI:** Use nouns instead of verbs for endpoints (e.g., `/api/v1/users` instead of `/api/v1/getUsers`).
* **Logical Nesting:** Keep resource nesting shallow (maximum 2 levels). Use query parameters for filtering, sorting, and pagination rather than deep paths.
* **HTTP Methods:** Strictly adhere to semantic meanings:
    * `GET`: Retrieve data (Idempotent).
    * `POST`: Create new resources.
    * `PUT`: Replace a resource (Idempotent).
    * `PATCH`: Update specific resource fields.
    * `DELETE`: Remove a resource (Idempotent).

## 2. Architecture & Data Handling

* **Service Layer Separation:** Decouple API controllers from business logic. Implement a Service Layer to house logic and a Data Access Layer (DAL) for database interactions [cite: 1].
* **Strict Boundary Validation:** Validate all incoming requests (`body`, `params`, `query`) using **Zod** or **Ajv** before processing [cite: 1, 2].
* **Standardized Responses:** Use consistent JSON structures for success and error states. 
    * Success: `{ "status": "success", "data": { ... } }`
    * Error: `{ "status": "error", "message": "..." }` [cite: 1]

## 3. Security & Hardening

* **Security Headers:** Use `helmet()` to set secure HTTP headers and protect against common vulnerabilities like XSS and clickjacking [cite: 1].
* **Rate Limiting:** Implement `express-rate-limit` on sensitive endpoints like `/auth`, `/login`, and `/uploads` to mitigate brute-force and DoS attacks [cite: 1].
* **Secure Cookie Management:** Store session tokens and JWTs in `httpOnly`, `secure`, and `sameSite: 'lax'` or `'strict'` cookies [cite: 1, 2].
* **CORS Policy:** Define a strict Cross-Origin Resource Sharing (CORS) policy. Avoid using wildcard `*` origins in production.

## 4. Observability & Error Handling

* **Centralized Error Middleware:** Handle all API errors in a single middleware to ensure consistent status codes and prevent leaking sensitive stack traces in production [cite: 1].
* **Structured Logging:** Utilize logging libraries like **Pino** or **Winston** to output logs in JSON format. Include a unique `request-id` in every log to facilitate distributed tracing [cite: 1].
* **Health Checks:** Provide `/healthz` or `/status` endpoints that verify database connectivity and system uptime [cite: 1].

## 5. Performance Optimization

* **Asynchronous Operations:** Utilize non-blocking, async/await patterns for all I/O operations. Express 5.0+ natively handles async rejections [cite: 1].
* **Pagination:** Always implement pagination for resource collections to prevent memory exhaustion and excessive payload sizes.
* **Connection Pooling:** Use connection pooling for database clients (e.g., Prisma, Redis) to manage resource availability effectively [cite: 1].
* **Compression:** Enable Gzip or Brotli compression for large JSON responses to reduce latency [cite: 1].

## 6. Documentation & Versioning

* **API Versioning:** Version your API via the URI (e.g., `/api/v1/...`) or custom headers to ensure backward compatibility as the schema evolves.
* **OpenAPI/Swagger:** Maintain up-to-date documentation using the OpenAPI Specification (OAS). Automate documentation generation from Zod schemas where possible.

