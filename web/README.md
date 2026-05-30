# BoneVisQA — Frontend (Next.js)

Ứng dụng web **BoneVisQA** hỗ trợ sinh viên y khoa học chẩn đoán hình ảnh với AI, thư viện ca bệnh, Visual QA trên X-quang/DICOM, và các luồng Lecturer / Expert / Admin.

> **Repo:** `BoneVisQA_FE/web` · **API .NET 8:** `NEXT_PUBLIC_API_URL` (mặc định dev: `http://localhost:5046`)

---

## 1. Tổng quan kiến trúc

```text
┌─────────────────────────────────────────────────────────────────┐
│  Browser (Next.js 16 App Router + React 19)                     │
├─────────────────────────────────────────────────────────────────┤
│  app/                    Routes theo vai trò (student, admin, …) │
│  features/visual-qa/     Visual QA: store, hooks, workspace UI   │
│  components/             UI tái sử dụng (chat, viewer, shell)   │
│  lib/api/                Axios client + domain API + RFC 7807     │
│       visual-qa/         ask-json, upload-personal, history      │
│       errors/            Toast tiếng Việt (Sonner)               │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTPS + JWT Bearer
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Backend .NET 8 API (code freeze) + Python AI (Visual QA / RAG)  │
└─────────────────────────────────────────────────────────────────┘
```

**Luồng Visual QA (Sinh viên):**

| Flow | Mô tả | API chính |
|------|--------|-----------|
| **A — Thư viện ca** | Duyệt catalog → mở ca → hỏi AI (tối đa 3 lượt/phiên) | `GET /cases/catalog`, `GET /cases/{id}`, `POST /visual-qa/ask-json` |
| **B — DICOM cá nhân** | Upload `.zip`/`.rar` → preview → hỏi AI | `POST /visual-qa/upload-personal`, `POST /ask-json` |
| **Resume** | Mở lại phiên từ Lịch sử | `GET /visual-qa/history/{sessionId}` |

**State:** Zustand (`features/visual-qa/store`) — lưu `sessionId`, `caseId`, `previewImageUrl`, `turns`, `capabilities`.

---

## 2. Cài đặt & chạy local

### Yêu cầu

- Node.js 20+
- Backend BoneVisQA chạy tại `http://localhost:5046` (hoặc URL trong env)
- Tài khoản **Student** đã đăng ký

### Bước chạy

```bash
cd web
npm install
cp .env.example .env.local   # nếu có file mẫu; nếu không, tạo .env.local
```

Trong `web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5046
```

```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000) → **Đăng nhập** → `/auth/sign-in`.

### Kiểm tra build production

```bash
npm run lint
npm run build
npm run start
```

---

## 3. Demo — Ba luồng chính (Smoke test)

| # | Luồng | Đường dẫn FE |
|---|--------|----------------|
| 1 | Đăng nhập → Catalog → Case → Ask AI | `/auth/sign-in` → `/student/catalog` → `/student/cases/{id}` → **Ask AI** |
| 2 | Upload DICOM → Workspace → ROI + Ask | `/student/visual-qa/upload` → workspace tự redirect |
| 3 | Resume phiên | `/student/history` → tab Personal / Case studies → mở thẻ |

**Thông báo lỗi (tiếng Việt):** toast Sonner toàn cục (400, 404, 503, 500); Visual QA chat dùng `skipApiToast` và hiển thị `system_notice` trong timeline.

---

## 4. Kịch bản demo cho Hội đồng / Mentor

**Thời lượng gợi ý: 5–7 phút**

### Chuẩn bị

1. Backend + DB chạy ổn định; ít nhất **1 ca** trong catalog đã approved.
2. Có sẵn file DICOM nén `.zip` hoặc `.rar` (< 200 MB) cho Flow B.
3. Đăng nhập tài khoản **Student**.

### Kịch bản A — Thư viện ca + AI có cấu trúc

1. Sidebar → **Case Catalog** (`/student/catalog`).
2. Chọn một ca → **Case Library Detail** → nút **Ask AI** / mở Visual QA.
3. **Workspace** (`/student/visual-qa/workspace`):
   - **Trái (desktop) / tab Hình ảnh (mobile):** ảnh X-quang; bật công cụ **hình vuông**, kéo vẽ **ROI**.
   - **Phải / tab Hỏi đáp:** nhập câu hỏi tiếng Việt hoặc Anh → **Gửi**.
4. Chỉ ra **phản hồi AI:**
   - Header **Chẩn đoán chính**
   - Accordion: Findings, Chẩn đoán phân biệt, Câu hỏi gợi mở
   - **Citation chips** (mở tab tài liệu)
5. Chỉ **badge lượt hỏi** (ví dụ `1/3`) trên header; sau 3 lượt composer khóa + toast cảnh báo.

### Kịch bản B — DICOM cá nhân

1. **AI Q&A** → **Personal DICOM upload** (`/student/visual-qa/upload`).
2. Kéo thả file `.zip`/`.rar` → theo dõi **thanh tiến trình** upload → **ingest**.
3. Tự chuyển **Workspace** với `flow=personal` và ảnh preview.
4. (Tùy chọn) Vẽ ROI → hỏi AI → nhấn mạnh `sessionId` + `previewImageUrl` từ Zustand.

### Kịch bản C — Resume lịch sử

1. **History** (`/student/history`) → tab **Personal Q&A** hoặc **Case studies**.
2. Mở một phiên → workspace load `GET /history/{sessionId}`.
3. Xác nhận **timeline chat** khớp trước khi refresh.

### Câu nói gợi ý (elevator pitch)

> "BoneVisQA kết hợp thư viện ca chuẩn hóa và upload DICOM cá nhân. Sinh viên vẽ ROI trên ảnh, AI trả lời dạng chẩn đoán có cấu trúc có trích dẫn tài liệu, giới hạn 3 lượt hỏi/phiên theo chính sách backend."

---

## 5. Technology stack

| Layer | Công nghệ |
|-------|-----------|
| Framework | **Next.js 16** (App Router), **React 19**, **TypeScript** |
| Styling | **Tailwind CSS v4**, Radix UI (Accordion, Tabs, Dialog, …) |
| HTTP | **Axios** — interceptor JWT + RFC 7807 → toast VI |
| Client state | **Zustand** (persist session ids) + **TanStack Query** (catalog, …) |
| Upload | **react-dropzone** + Axios `onUploadProgress` |
| Toast | **Sonner** |
| Realtime | **SignalR** (thông báo; tùy cấu hình) |

### Cấu trúc Visual QA (FE)

```text
features/visual-qa/
  components/     WorkspaceShell, WorkspaceChatPanel, WorkspaceStructuredAnswer, …
  hooks/          useVisualQA, useVisualQAUpload
  pages/          upload-page.tsx
  store/          visual-qa-store.ts

lib/api/visual-qa/
  ask-json.ts
  upload-personal.ts
  history.ts
```

### Routes Student (Visual QA)

| Route | Mục đích |
|-------|----------|
| `/student/visual-qa/upload` | Upload DICOM (Flow B) |
| `/student/visual-qa/workspace` | Split-screen workspace |
| `/student/qa/image` | Legacy → redirect workspace (map query) |
| `/student/catalog` | Catalog (Flow A entry) |

### Responsive

- **lg+:** Split 55% viewer / 45% chat.
- **< lg:** Tabs **Hình ảnh** | **Hỏi đáp**; viewer hỗ trợ pinch zoom + pan/ROI bằng touch.

---

## 6. Tài liệu liên quan

| File | Nội dung |
|------|----------|
| `../_ai-context/API_CONTRACTS.md` | Bảng endpoint đồng bộ FE–BE |
| `../_ai-context/PROJECT_SPEC.md` | Spec dự án |
| `../DEVELOPER_GUIDE.md` | Convention & build |

---

## 7. Trạng thái demo

- [x] Visual QA workspace split-screen
- [x] Upload DICOM + progress + redirect
- [x] ask-json + structured answer UI
- [x] Toast lỗi tiếng Việt (RFC 7807)
- [x] Mobile tabs + touch viewer
- [x] Legacy `/student/qa/image` redirect

**Trước demo:** chạy `npm run build` một lần; kiểm tra `NEXT_PUBLIC_API_URL`; đăng nhập Student; mở một ca + một file ZIP test.
