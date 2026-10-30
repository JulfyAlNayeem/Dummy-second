# Alfajr Product Requirements Document

**Document status:** Product baseline for stakeholder review  
**Version:** 1.0  
**Last reviewed:** 29 October 2026  
**Product:** Alfajr  
**Repository:** Dummy monorepo

---

## 1. Purpose and status

This document describes Alfajr's product direction and the behavior represented in the current repository. It is intended to align product, design, engineering, operations, and community stakeholders. The implementation inventory is based on the code and configuration reviewed for this edition; it is not a substitute for stakeholder approval, security review, or legal review.

Status labels used throughout:

- **Implemented:** represented by an application flow, API, data model, or deployment configuration in the repository.
- **Needs validation:** visible in code but its intended policy, user experience, or operational guarantee is not established.
- **Open decision:** the product owner must decide before the behavior can be specified as a commitment.

## 2. Product summary

Alfajr is a web application for learning communities that combines member communication, class coordination, learning activities, and community administration. The current product includes private and group conversations, classroom groups, real-time messaging, audio/video calling, attendance, alertness sessions, assignments, forms, shared notes, reusable quick messages and lessons, and administrative tools.

The product direction is to make these activities available in one community-managed space, with access controls and communication settings that operators can configure. Privacy, member safety, and clear expectations around classroom activity are product principles to validate with the communities Alfajr serves.

## 3. Product goals

1. Help members communicate with peers and instructors in direct, group, and classroom contexts.
2. Give instructors practical tools to organize classes, take attendance, distribute learning activities, and review participation.
3. Give community operators tools to manage membership, permissions, reports, notices, and platform settings.
4. Make the product's privacy, safety, and data-handling behavior understandable to members and operators.
5. Provide an operable web platform with observable service health and recoverable data.

### Out of scope for this baseline

- A verified parental-consent or guardian-management program.
- A defined tenant billing, subscription, or payment system.
- Product-wide analytics or a committed KPI collection program.
- A guarantee that every message type or encryption mode is end-to-end encrypted.
- A compliance claim for any jurisdiction or age group.

## 4. Users and roles

The following personas describe intended use, not finalized account policy.

| Persona | Primary needs | Current role representation |
|---|---|---|
| Learner / member | Join approved communities, communicate, attend classes, respond to activities, complete assignments and forms | Stored role `user`; student routes check `user` |
| Instructor | Organize class membership and activities, take attendance, create assignments, review learner work | Stored role `teacher`; instructor routes check `teacher` |
| Community administrator / moderator | Review membership and reports, configure community settings, manage users and notices | Stored roles `admin`, `superadmin`, `moderator`; admin route guard accepts all three, while individual backend actions vary |
| Developer / support operator | Review technical issue reports and support service operation | Stored role `developer`; developer route is separate and reports are filtered by role |

**Role decision required:** the product owner must define canonical names, privileges, and whether moderator is distinct from admin. The database's default member role is `user`, while the UI and documentation commonly call this person a student. Route guards alone do not establish backend authorization policy.

## 5. Product scope and functional requirements

### 5.1 Access, identity, and membership

- **Implemented:** a public site-security page, sign-up, sign-in, and protected application routes.
- **Implemented:** registration stores a bcrypt-hashed password and sends an email verification message. Sign-in requires email verification. Access and refresh tokens are issued in HTTP-only cookies; refresh tokens are replaced during refresh and cleared on logout.
- **Implemented:** account and user-management interfaces, approval-related models and admin pages, and scheduled-deletion administration surfaces.
- **Needs validation:** site-security pin is a shared access gate; it should not be described as identity verification or proof of membership.
- **Needs validation:** the exact membership approval rules and whether approvals are mandatory for all communities.
- **Open decision:** account recovery, two-factor authentication, inactivity deletion timelines, user notice, appeal, and restoration policy must be confirmed against operational behavior before being stated as guarantees.
- **Open decision:** decide how minors may register, whether guardians are involved, what evidence or consent is collected, and how consent withdrawal and account deletion work. The current repository does not define a parental-consent workflow.

### 5.2 Conversations and messaging

- **Implemented:** direct conversations and group/classroom conversations, conversation discovery and join requests, participant and group management, message history, message reactions, replies, and real-time Socket.IO events.
- **Implemented:** conversation-level communication settings and permission-request workflows exist for selected message capabilities. The user model includes a file-sending permission flag.
- **Implemented:** disappearing-message settings can be configured for a conversation.
- **Needs validation:** exact supported message types, default permissions, who may grant them, and whether permissions apply consistently to every API and socket path.
- **Needs validation:** disappearing-message timing and whether expiry deletes content from databases, backups, caches, and recipient devices.
- **Security qualification:** the repository contains several encryption implementations and key-exchange flows, plus backend encryption for some stored content. Encryption modes differ in their trust boundaries. Product materials must state which data each mode protects and who can access plaintext; “end-to-end encrypted” must not be applied to the whole platform without a security review.

### 5.3 Classes and learning activities

- **Implemented:** class/group creation and management, member and join-request management, class schedules, manual and automatically generated attendance sessions, attendance marking and summaries.
- **Implemented:** instructors can create assignments; learners can submit work; instructor interfaces support reviewing submissions.
- **Implemented:** alertness sessions send a timed prompt to class participants and record responses, response rate, and response time. Class participants can view session records and statistics.
- **Implemented:** forms and form assignments/submissions, plus personal and class-related notes.
- **Needs validation:** establish whether alertness is a voluntary classroom interaction, how results may be used, who can see historical results, and how long they are retained. Response rate and response time are participation signals, not validated measures of attention or learning.

### 5.4 Reusable content and social features

- **Implemented:** quick messages, quick lessons, social posts, friend relationships, blocks, and reminders are represented in backend modules and frontend workflows.
- **Needs validation:** clarify content ownership, moderation, visibility, retention, and whether quick-message seed content is maintained as product content.

### 5.5 Calls and notifications

- **Implemented:** audio/video calling is integrated through LiveKit, with call signaling handled through Socket.IO. Notification preferences and device-token fields are present; in-app notification functionality is represented in backend and frontend modules.
- **Needs validation:** supported call size, quality targets, push-delivery guarantees, and notification privacy behavior. Deployment configuration alone does not establish a service-level guarantee.

### 5.6 Reports and administration

- **Implemented:** users can submit reports. Report retrieval is role-filtered so developer users receive software-issue reports and admin/superadmin users receive misbehavior and other reports. Admin interfaces include user management, approvals, notices, settings, scheduled deletions, and activity logs.
- **Needs validation:** moderator report access and write privileges, escalation and appeal procedures, response-time expectations, and retention of reports and activity logs.

## 6. Primary workflows

1. **Member onboarding:** visit public entry point → register → verify email → sign in → complete any applicable community approval → use protected features.
2. **Join a community:** discover a public group/class or receive an invitation → request to join where required → authorized class/group administrator reviews → participate after acceptance.
3. **Run a class:** instructor opens class tools → manages members and schedule → starts attendance or an alertness session → shares an assignment, form, note, or lesson → reviews participation and submissions.
4. **Participate as a learner:** open class or conversation → respond to live class activity → review and submit assigned work → request access to restricted communication capabilities if applicable.
5. **Handle a report:** member submits a report → authorized operator sees the report according to role → investigates and records an outcome using available administrative controls.
6. **Start a call:** a participant initiates or accepts a call → signaling coordinates participants → clients connect to the configured LiveKit service.

These are product-level summaries; exact states, error handling, and permission rules require workflow review before external commitments are made.

## 7. Product quality requirements

The repository currently provides implementation mechanisms, but numeric service targets have not been approved. The following are requirements to define and validate:

- **Security and privacy:** document data classification, access boundaries, encryption behavior, secret handling, retention, deletion, and incident response. Conduct threat modeling and independent review of encryption before making security claims.
- **Authorization:** enforce role and resource permissions on backend APIs and socket events; use a canonical role/permission policy across UI and server.
- **Reliability:** define availability, recovery-point, and recovery-time objectives; verify backups through restoration exercises.
- **Performance:** define service targets for API latency, message delivery, call setup, and supported concurrent classroom usage.
- **Accessibility and localization:** define accessibility target and supported languages. Bengali and Arabic-oriented content is present, but localization coverage and accessibility conformance are not established by this audit.
- **Observability:** define operational metrics, alerting, log access, retention, and privacy controls. Structured logging, health endpoint, activity logs, and class analytics are present in parts of the system.

## 8. Measurement plan

No product-wide analytics instrumentation or approved KPI definitions were identified in the reviewed repository. Class attendance and alertness statistics are operational classroom records, not a general analytics program.

Candidate measures for stakeholder approval:

- **Onboarding:** registration-to-email-verification completion; time from registration to first approved community access.
- **Learning activity:** attendance completion, assignment submission, and form completion by class and period.
- **Communication:** active members and conversation/call usage, only if collection is necessary, disclosed, and privacy-reviewed.
- **Trust and safety:** report volume, time to triage and resolution, repeat reports, and permission-request outcomes.
- **Reliability:** API availability, message delivery latency, call connection success, and backup restore success.

For every metric, define an event schema, owner, denominator, reporting period, access rules, retention period, and consent/disclosure requirements before collection. Do not use alertness response data as a proxy for educational outcomes without validation.

## 9. Data, privacy, and trust considerations

- The product stores account, communication, class, assignment, attendance, report, and operational data. The precise inventory, retention schedule, and deletion behavior require a data mapping exercise.
- Email/password authentication and cookie-based tokens are implemented. Cookie settings vary by environment; deployment configuration must be reviewed for the actual domain and cross-site behavior.
- The site-security gate is a community convenience control, not authentication.
- Child safety and guardian consent are unresolved product and operational requirements. Identify target ages and launch jurisdictions before defining the flow.
- Encryption mode selection, key recovery, account migration, backup exposure, and administrator access must be described accurately to users.
- Reporting, blocking, moderation, and account actions need clear notice, audit, appeal, and retention policies.
- Analytics and classroom participation records require transparent purpose, limited access, and retention decisions.

## 10. Technical overview

The current repository is a JavaScript/TypeScript monorepo.

- **Web client:** React 19, Vite, Redux Toolkit/RTK Query, React Router, Tailwind CSS, Radix UI, Socket.IO client, and LiveKit client.
- **API and real-time services:** Node.js, Express, Mongoose, MongoDB, Socket.IO, Redis adapter/session components, and LiveKit server SDK integration.
- **Supporting services:** Cloudinary integration for media, email service, logging with Pino, rate limiting, Helmet, compression, Docker Compose, Nginx reverse proxy, and backup scripts with optional cloud upload configuration.
- **Domains represented:** authentication, users, conversations, messages, encryption/key exchange, classes, assignments, attendance, alertness, forms, notes, quick messages, quick lessons, calls, social features, reporting, permissions, notices, reminders, notifications, files/uploads, and administration.

This section describes repository dependencies and modules, not a formal deployment topology or verified production service level. The repository has development and production Compose configurations; deployment readiness, configuration security, and disaster recovery require separate operational review.

## 11. Risks and dependencies

| Risk / dependency | Product impact | Required follow-up |
|---|---|---|
| Role and authorization drift | Users may receive inconsistent capabilities across UI, API, and sockets | Approve canonical role/permission matrix and audit enforcement |
| Encryption complexity and mixed trust boundaries | Users may misunderstand who can read content; migration and recovery may fail | Threat model, security review, mode-by-mode user-facing guarantees |
| Minors and consent | Potential safety, trust, and jurisdictional exposure | Define target ages, guardian process, escalation, and legal review |
| Alertness data interpretation | May create pressure or misleading conclusions about attention | Define purpose, visibility, retention, consent, and limits on use |
| Data deletion and backups | Deleted content may persist in backup or third-party storage | Publish retention/deletion schedule and test lifecycle behavior |
| Third-party services | Calls, media, email, and optional cloud backup depend on provider configuration | Document providers, data transfer, failure handling, and credentials |
| Deployment configuration | Local and production behavior can diverge | Review secrets, origins, TLS, network exposure, monitoring, and recovery |

## 12. Decisions required before treating this PRD as approved

1. Who is the target user, which languages and regions are in scope, and what minimum age is supported?
2. What are the canonical roles and the complete permission matrix, including moderators and developers?
3. Is membership approval required, and how does it interact with email verification and the site-security gate?
4. What parental/guardian consent, verification, withdrawal, and safeguarding process is required?
5. Which encryption modes are supported for each conversation type, and what exact security guarantees may be communicated?
6. What are message, account, attendance, alertness, report, activity-log, media, and backup retention periods?
7. What alertness data may instructors see and use, and what notice or consent is required?
8. Which product metrics may be collected, who may access them, and what privacy/retention controls apply?
9. What availability, performance, capacity, backup, and recovery targets define production readiness?
10. Who owns report triage, moderation appeals, security incidents, and user support?

## 13. Change management

Update this document when approved product behavior, supported workflows, role policy, data practices, or service targets change. Keep implementation status separate from desired behavior and record unresolved decisions with an owner and review date. Security, privacy, legal, and child-safety claims require review by the relevant owners before publication.

---

**Source of current-state detail:** application routes and role guards; backend route registration, controllers, and models; frontend API integrations and workflows; package manifests; Docker Compose and backup configuration in this repository. This source list describes the evidence used for the current-state inventory, not instructions to contributors.
