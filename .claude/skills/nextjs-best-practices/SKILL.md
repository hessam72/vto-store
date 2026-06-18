---
name: nextjs-best-practices
description: Advanced expertise in researching and implementing the latest Next.js 15 architectural patterns, performance benchmarks, and full-stack security standards.
---

## 1. Architectural Foundations (App Router)

* **RSC First:** Default to React Server Components for all data-heavy UI. Use `'use client'` only at the leaf nodes (e.g., interactive buttons, form inputs) to minimize the client-side JavaScript bundle.
* **Async Request APIs (Next.js 15 Breaking Change):** Strictly await `params`, `searchParams`, `cookies()`, and `headers()`. Next.js 15 has moved these to asynchronous APIs to improve performance and future-proof the framework.
* **Nested Layouts & Streaming:** Structure applications using `layout.tsx` for shared UI and `loading.tsx` to automatically wrap pages in **React Suspense** boundaries for instant perceived performance.

## 2. Rendering & Data Strategy

* **Uncached by Default:** Understand that in Next.js 15, `fetch` requests are no longer cached by default. Use `{ cache: 'force-cache' }` for static content or the experimental `'use cache'` directive for granular control.
* **Partial Prerendering (PPR):** Enable PPR in `next.config.js` to combine a static HTML shell with dynamic, streaming content in a single request, providing the best of both static and dynamic worlds.
* **Server Actions for Mutations:** Use Server Actions for all POST/PUT/DELETE operations. 
    * **Optimistic Updates:** Implement `useOptimistic` to make the UI feel instantaneous.
    * **Form State:** Handle form transitions and errors using the `useActionState` hook for a seamless developer experience.

## 3. Performance & Core Web Vitals

* **LCP (Largest Contentful Paint) < 2.5s:**
    * Prioritize above-the-fold images with the `priority` attribute in `next/image`.
    * Utilize `fetchPriority="high"` for critical resources.
* **INP (Interaction to Next Paint) < 200ms:**
    * Minimize main-thread blocking by offloading heavy logic to Server Components.
    * Use `next/script` with `strategy="lazyOnload"` for third-party scripts.
* **CLS (Cumulative Layout Shift) < 0.1:**
    * Always define explicit `width` and `height` for media.
    * Use `next/font` with `variable` fonts to eliminate layout shifts during font loading.

## 4. Modern SEO & Metadata

* **Metadata API:** Utilize the built-in Metadata API (`generateMetadata`) for dynamic pages to ensure OG images, canonical tags, and structured data are tailored to the content.
* **Dynamic Sitemap & Robots:** Generate `sitemap.xml` and `robots.txt` dynamically using `sitemap.ts` and `robots.ts` files within the `app` directory.
* **Structured Data (JSON-LD):** Inject schema markup directly into Server Components to enhance rich results in search engines.

## 5. Security & Authentication

* **Input Validation:** Never trust client input. Always validate `formData` or JSON payloads using **Zod** within Server Actions or API routes.
* **Auth Patterns:** * Prefer **Passkeys** or WebAuthn over passwords where possible.
    * Use `httpOnly`, `secure`, and `sameSite: 'lax'` cookies for session management.
* **Middleware Guards:** Implement authentication and RBAC (Role-Based Access Control) at the Edge using `middleware.ts` for instant protection.

## 6. Research & Evaluation Protocol

When auditing or researching new libraries/patterns:
1.  **Bundle Impact:** Evaluate the library's impact on the client-side bundle using `@next/bundle-analyzer`.
2.  **RSC Compatibility:** Verify if the library requires a client-side wrapper or if it can run natively in Server Components.
3.  **Edge Compatibility:** Check if the logic can run in the **Edge Runtime** for global low-latency execution.
4.  **Community Velocity:** Prioritize libraries with active maintenance that align with the official Vercel/Next.js roadmap.

---

## Next.js 15 Checklist
- [ ] Are all `params` and `searchParams` awaited?
- [ ] Is the "Client-Boundary" placed as low as possible?
- [ ] Are `loading.tsx` and `error.tsx` present for key routes?
- [ ] Is `next/image` used for all external and local images?
- [ ] Are Server Actions validated with Zod?
- [ ] Has the bundle been analyzed for large third-party imports?
