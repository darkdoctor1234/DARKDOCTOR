# System Architecture

1. Overall style — 3-tier, client-server architecture
2. Client — single entity, web app form
3. Server — modular monolith (6 modules: users, auth, colleges, communities, notifications, static content)
4. Data layer — structured (relational alone), media storage
5. Communication protocol — REST over HTTPS
6. Authentication — JWT tokens
7. Authorization — role-based access control (RBAC): User / Admin / Super Admin, enforced server-side
8. External system dependencies — SMTP (email verification + password reset)
