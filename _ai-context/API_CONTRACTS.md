# BoneVisQA — API contracts (FE view)

> **Cập nhật:** 2026-05-22 (đồng bộ Visual QA code freeze + FE `web/src/lib/api/visual-qa/`).  
> **Nguồn:** Tổng hợp từ `web/src/lib/api/*.ts` và `FRONTEND_HANDOFF_REPORT.md`.

**Base URL:** `NEXT_PUBLIC_API_URL` (ví dụ `http://localhost:5046`). Mọi path dưới đây là suffix sau origin.

**Auth header:** `Authorization: Bearer <token>` (axios interceptor trong `client.ts`).

---

## Auth

| Method | Path | Ghi chú |
|--------|------|---------|
| POST | `/api/auths/login` | body login |
| POST | `/api/auths/register` | |
| POST | `/api/auths/forgot-password` | `{ email }` |
| POST | `/api/auths/reset-password` | |
| POST | `/api/auths/google-register` | `{ idToken }` |
| POST | `/api/auths/request-medical-verification` | |

## Profile / user chung

| Method | Path |
|--------|------|
| GET/PUT | `/api/profile` |
| POST | `/api/profile/avatar` | multipart |
| GET | `/api/users/me` | student profile |
| PUT | `/api/users/me` | |
| GET | `/api/search` | `?q=` |

## Student

| Method | Path | Ghi chú |
|--------|------|---------|
| GET | `/api/student/progress` | |
| GET | `/api/student/progress/topic-stats` | |
| GET | `/api/student/progress/recent-activity` | |
| GET | `/api/student/announcements` | |
| GET | `/api/students/classes` | |
| POST | `/api/student/visual-qa/ask` | multipart Visual QA (legacy — prefer `ask-json`) |
| POST | `/api/student/visual-qa/ask-json` | JSON Visual QA chat (`questionText`, `caseId`, `sessionId?`, `coordinates?`, `clientRequestId?`); query `locale=vi\|en` |
| POST | `/api/student/visual-qa/upload-personal` | multipart DICOM `.zip`/`.rar` (max 200MB) → `sessionId`, `caseId`, `previewImageUrl`, `ingestOk` |
| POST | `/api/student/visual-qa/turns/{assistantMessageId}/request-review` | query `sessionId`; path id is the **assistant (AI) message** id for that turn |
| GET | `/api/student/visual-qa/history/{sessionId}` | Full thread (`VisualQaThreadDto`) |
| GET | `/api/student/visual-qa/history/cases` | Catalog session list (`limit`, `offset`) |
| GET | `/api/student/visual-qa/history/personal` | Personal upload session list |
| GET | `/api/student/cases/catalog` | query: `location`, `lesionType`, `difficulty`, `q` / `search` (optional text; FE gửi cả hai nếu BE hỗ trợ một trong hai). Response item nên có: `thumbnailUrl`/`imageUrl`, `tags` (string[]), `categoryName`/`category`, `difficulty` (raw enum), `createdAt`, `caseOrigin` hoặc `source` (`ExpertCreated` / `CommunityPromoted` / tương đương). |
| GET | `/api/student/cases/{id}` | Chi tiết: `description`, `diagnosis`, `keyLearningPoints` / `keyLearnings`, `images[]` (url + `roiBoundingBox` / annotations), `caseOrigin` để FE khóa Visual QA. |
| GET | `/api/cases/filters` | |
| GET | `/api/student/quizzes` | |
| GET | `/api/student/quizzes/practice` | |
| POST | `/api/student/quizzes/practice/generate` | |
| POST | `/api/student/quizzes/submit` | |
| GET | `/api/student/quizzes/history` | |

## Lecturer

| Method | Path |
|--------|------|
| GET/POST | `/api/lecturer/classes` |
| GET | `/api/lecturer/cases` |
| GET | `/api/lecturer/experts` |
| GET | `/api/lecturer/quizzes` |
| GET | `/api/lecturer/quizzes/batch` |
| POST | `/api/lecturer` | tạo quiz (legacy path trong code) |
| GET | `/api/lecturer/dashboard/stats` |
| GET | `/api/lecturer/dashboard/analytics` |
| GET | `/api/lecturer/monitoring/class-leaderboard` |
| GET | `/api/lecturer/triage` | query `classId` … |
| GET/PUT | `/api/lecturer/profile` |
| POST | `/api/lecturer/ai/generate-quiz` |
| POST | `/api/lecturer/ai/suggest-questions` |
| POST | `/api/lecturer/ai/create-quiz` |

## Expert

| Method | Path |
|--------|------|
| POST | `/api/expert/cases` |
| GET | `/api/expert/tags` | alias of `/api/expert/tag`; query `pageIndex`, `pageSize` |
| GET | `/api/expert/tag` | query `pageIndex`, `pageSize` |
| POST | `/api/expert/images` |
| POST | `/api/expert/annotations` |
| POST | `/api/expert/case-tag` |
| GET | `/api/expert/reviews/case-answer` |
| GET | `/api/expert/reviews/escalated` |
| GET | `/api/expert/reviews/{sessionId}` | Chi tiết session review (cùng shape queue); alias `GET /api/expert/reviews/{sessionId}/session`. |
| GET | `/api/expert/dashboard/stats` |
| GET | `/api/expert/dashboard/pending-reviews` |
| GET | `/api/expert/dashboard/recent-cases` |
| GET | `/api/expert/dashboard/activity` |
| GET/POST | `/api/expert/quizzes` |
| POST | `/api/expert/quizzes/assign` |
| POST | `/api/expert/assign` | |

## Admin

| Method | Path |
|--------|------|
| GET | `/api/admin/users` | query `page`, `pageSize` |
| GET | `/api/admin/role/:role` | fallback directory |
| GET/POST | `/api/admin/classes` | enrollments, … |
| GET | `/api/admin/cases` |
| GET | `/api/admin/documents` |
| GET | `/api/admin/documents/chunks/flagged` | Alias: `GET /api/admin/rag/flagged-chunks` — chunk RAG bị expert flag (`chunkId`, `documentId`, `documentTitle`, `preview`, `reason`, …). |
| PATCH | `/api/admin/documents/chunks/{chunkId}/flag` | Body: `{ "resolved": true }` — alias: `PATCH /api/admin/rag/chunks/{chunkId}/flag`. |
| GET | `/api/admin/monitoring/users` |
| GET | `/api/admin/monitoring/activity` | `from`, `to` ISO |
| GET | `/api/admin/monitoring/rag` |
| GET | `/api/admin/monitoring/reviews` |
| GET/PUT | `/api/admin/profile` |

## Notifications & upload

| Method | Path |
|--------|------|
| GET | `/api/notifications` |
| PUT | `/api/notifications/:id/read` |
| POST | `/api/upload/image` | multipart |

## SignalR (không phải REST)

- Hub theo cấu hình FE (`useSignalR`): nhận `ReceiveNotification`, payload khớp `NotificationDto` (có `route`, `targetUrl`, …).
- Trang Visual QA student có thể dùng `notifications` từ context để refetch session khi `type` liên quan `visual_qa` / expert reply (bổ sung khi BE chuẩn hóa type).

## Expert promote case library

- `POST /api/expert/reviews/{sessionId}/promote` — FE gửi thêm (camelCase, BE có thể bỏ qua field chưa hỗ trợ): `title`, `categoryId`, `categoryName`, `difficulty`, `tagNames` (string[]), `description`, `suggestedDiagnosis`, `keyFindings`, `reflectiveQuestions`, `imageAnnotations` / `turnAnnotations` (ROI theo turn).

## Visual QA thread (REST)

- **Chuẩn mới (code freeze):** `web/src/lib/api/visual-qa/` — `ask-json.ts`, `upload-personal.ts`, `history.ts`; state `web/src/features/visual-qa/store/visual-qa-store.ts`, hooks `useVisualQA`, `useVisualQAUpload`.
- **Routes FE:** `/student/visual-qa/upload`, `/student/visual-qa/workspace`; legacy `/student/qa/image` → redirect workspace (map `caseId`, `sessionId`, …).
- Legacy multipart/SSE: `student-visual-qa.ts` (`ask`, `ask-stream`) — không dùng cho UI workspace mới.
- **Lỗi:** RFC 7807 + body Visual QA (`message`, `systemNotice`, `latestTurn`, `capabilities`) qua `web/src/lib/api/errors/`; toast tiếng Việt `showApiErrorToast` (400/404/503/500/429); chat `ask-json` dùng `skipApiToast: true`.

### ask-json (request / response tóm tắt)

| Field request | Ghi chú |
|---------------|---------|
| `questionText` | Bắt buộc |
| `caseId` | Bắt buộc (catalog hoặc sau upload) |
| `sessionId` | Follow-up; bỏ qua lượt đầu catalog |
| `coordinates` | JSON bbox chuẩn hóa 0–1 (ROI) |
| `clientRequestId` | UUID tùy chọn |

| Field response | UI |
|----------------|-----|
| `diagnosis`, `findings[]`, `differentialDiagnoses[]`, `reflectiveQuestions[]` | `WorkspaceStructuredAnswer` |
| `citations[]` | Citation chips |
| `capabilities.canAskNext`, `turnsUsed`, `turnLimit` | Khóa composer |
| `latestTurn` | Append timeline; 400 session block vẫn append nếu có |

### upload-personal

| Field | Ghi chú |
|-------|---------|
| `file` | `.zip` / `.rar`, max 200MB |
| `diagnosisText` | Tùy chọn |
| Response `ingestOk`, `sessionId`, `caseId`, `previewImageUrl` | Zustand `setFromUpload` → redirect workspace |

---

**Khi đổi contract BE:** cập nhật `web/src/lib/api/types.ts` + mapper + file này.
