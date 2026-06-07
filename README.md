# BoneVisQA — Frontend (`BoneVisQA_FE`)

Monorepo chứa ứng dụng web **Next.js** (thư mục `web/`), tùy chọn `mobile/`, và script tiện ích.

## Bắt đầu

```bash
cd web
npm install
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000). Cấu hình API: `web/.env.local` — `NEXT_PUBLIC_API_URL` (origin backend, ví dụ `http://localhost:5046`).

## Deploy (Vercel)

1. **Root Directory:** `web` (Project Settings → General).
2. **Node.js:** `20.x` (Next.js 16 yêu cầu ≥ 20.9; repo khai báo `"engines": { "node": "20.x" }` trong `web/package.json`).
3. **Biến môi trường (Production + Preview)** — bắt buộc trước khi build:
   - `NEXT_PUBLIC_API_URL` — origin backend, **không** có suffix `/api` (vd. `https://bonevisqa.onrender.com`)
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (nếu dùng Google Sign-In)
4. Redeploy sau khi đổi env (client bundle nhúng `NEXT_PUBLIC_*` lúc build).

Mẫu: `web/.env.example`.

## Làm việc với Cursor & Backend

- **Hai repo GitHub (FE / BE)** là bình thường: mở **hai cửa sổ Cursor** — một workspace repo FE này, một workspace repo Backend — để code và đối chiếu contract song song.
- **Luồng ngữ cảnh cho agent:** đọc `DEVELOPER_GUIDE.md` → `_ai-context/PROJECT_SPEC.md` → `_ai-context/API_CONTRACTS.md` → (khi sửa UI/API) mẫu prompt trong `_ai-context/FRONTEND_CONTEXT_BLOCK.md`.
- Quy tắc IDE: `.cursorrules` ở root.
- **Đồng bộ BE:** nếu repo Backend có `_ai-context/` (PROJECT_SPEC, API_CONTRACTS, …), merge hoặc copy sang `_ai-context/` của repo FE để một nguồn sự thật cho API.

**Lưu ý:** Nếu chưa có bản từ Backend, các file `_ai-context/*.md` có thể là **tổng hợp từ codebase FE** — cần đối chiếu với BE trước khi coi là chuẩn duy nhất.

## Tài liệu thêm

- `DEVELOPER_GUIDE.md` — kiến trúc, convention, quy tắc commit, lệnh build/lint.
- `web/README.md` — ghi chú Next.js mặc định.

## Demo reset + seed (review 21/04/2026)

Nguồn chính thức nằm trong repo **Backend** `SP26SE110_BoneVisQA` (Postman one-click, SQL reset, runbook, audit, handoff FE notification):

- Runbook: `D:/DATN/BoneVisQA/SP26SE110_BoneVisQA/docs/DEMO_REVIEW_2026-04-21_RUNBOOK.md`
- Audit luồng ghi bảng: `D:/DATN/BoneVisQA/SP26SE110_BoneVisQA/docs/BE_AUDIT_MAIN_FLOW_TABLES.md`
- Handoff FE (bell / read / routing): `D:/DATN/BoneVisQA/SP26SE110_BoneVisQA/docs/FE_HANDOFF_NOTIFICATIONS_2026-04-21.md`
- Postman: `D:/DATN/BoneVisQA/SP26SE110_BoneVisQA/postman/BoneVisQA-Demo-Seed.postman_collection.json` và `D:/DATN/BoneVisQA/SP26SE110_BoneVisQA/postman/BoneVisQA-Demo-Seed.postman_environment.json`
- SQL reset: `D:/DATN/BoneVisQA/SP26SE110_BoneVisQA/db/20260419_reset_demo_flow_tables.sql` (trong script: bật `confirm_reset := true` trước khi chạy)

Script import LabelMe trong repo FE đã **gỡ** theo hướng Postman-only trên BE.
