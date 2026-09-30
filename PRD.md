# PRD

## 1. Platform Name
Darkdoctor (DD-V2)

## 2. Platform Description
An anonymous-review and Q&A platform for Indian medical colleges (MBBS/Dental/Nursing, UG and PG), where verified students/alumni review colleges (approval-gated) and ask/answer college-specific questions, and PG doctors participate in specialty-based communities auto-assigned by specialty and state.

## 3. Components
1. Colleges
2. Communities

## 4. Component 1 — Colleges
- **Part A — Read-only (static data)**: College directory — seats, fees, stipends, departments.
- **Part B — Read & write**: Reviews, Q&A, Discussions (all scoped to a specific college).

## 5. Component 2 — Communities
Fully interactive, read & write for eligible users — specialty-based discussions, comments, polls.

## Stakeholders
1. **Users** — full access to the Colleges component; access to Communities restricted to eligible users only (PG-track: PG students, working professionals, alumni, faculty — UG-track users are not eligible).
2. **Admin** — moderates Reviews (approve/reject).
3. **Super Admin** — full platform control: college CRUD/bulk-import, admin management, leads, review moderation (superset of Admin), About page.
