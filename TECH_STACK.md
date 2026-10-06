# Virtual Patient Simulator — Tech Stack

## Frontend

| What                 | Technology                                                                            |
| -------------------- | ------------------------------------------------------------------------------------- |
| Framework            | React 19                                                                              |
| Build tool           | Vite 5                                                                                |
| Routing              | React Router v7                                                                       |
| State management     | Redux Toolkit + Redux Persist                                                         |
| HTTP client          | Axios                                                                                 |
| Styling              | Tailwind CSS 3 + shadcn/ui                                                            |
| Icons                | Lucide React, Heroicons                                                               |
| Charts               | Recharts                                                                              |
| Forms                | React Hook Form                                                                       |
| Rich text editor     | React Quill                                                                           |
| Date picker          | React DatePicker                                                                      |
| Notifications        | React Hot Toast                                                                       |
| CSV parsing          | PapaParse                                                                             |
| Excel export         | SheetJS (xlsx)                                                                        |
| Date utilities       | date-fns                                                                              |
| Language             | JavaScript (no TypeScript)                                                            |
| Japanese translation | Custom DOM-based translator with a hand-written dictionary (no external i18n library) |

## Backend

| What                 | Technology                                    |
| -------------------- | --------------------------------------------- |
| Runtime              | Node.js 22 (ESM)                              |
| Framework            | Express 4                                     |
| Database             | MongoDB via Mongoose 8                        |
| Cache / OTP store    | Redis via ioredis                             |
| Authentication       | JSON Web Tokens (jsonwebtoken + jose for JWE) |
| Password hashing     | bcryptjs                                      |
| Input validation     | express-validator                             |
| File uploads         | Multer                                        |
| Email (OTP, invites) | AWS SES (@aws-sdk/client-ses)                 |

## AI Services

| What                          | Technology                                 |
| ----------------------------- | ------------------------------------------ |
| Scenario generation (primary) | Google Gemini 2.5 Flash (REST API, no SDK) |
| Reasoning coach (fallback)    | Groq (OpenAI-compatible API, no SDK)       |

## External Services

| What                       | Technology                                                                 |
| -------------------------- | -------------------------------------------------------------------------- |
| Patient simulator (hosted) | StreamPixel — students and educators are redirected here to run a scenario |

## Infrastructure & DevOps

| What               | Technology                                                                 |
| ------------------ | -------------------------------------------------------------------------- |
| Process manager    | PM2 (ecosystem.config.cjs defines vps-backend + vps-frontend)              |
| Static SPA serving | serve (via PM2 in production, Vite dev server locally)                     |
| Package manager    | pnpm                                                                       |
| Linting            | ESLint 9                                                                   |
| Containerisation   | Docker (multi-stage: Node 22 slim, pnpm, Vite build then production image) |
| Hosting            | Ubuntu server (deployed via PM2)                                           |

## Four User Roles

The entire platform is built around role-based access control for four roles:

1. **Student** — takes scenarios, views results
2. **Educator** — creates scenarios, manages students
3. **School Admin** — manages educators and students within a school
4. **Superadmin** — platform-wide oversight
