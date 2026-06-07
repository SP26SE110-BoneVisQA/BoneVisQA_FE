# BE Request: Case Library — Expert-Owned CRUD, Auto-Publish, Origin Tabs

**Ngày:** 2025-06-07  
**Phía FE:** `ExpertCasesPage`, `expert-cases.ts`, `AdminCasesPage`, `ExpertReviewsPage`  
**Mục tiêu:** Bỏ workflow approve/pending/draft/rejected; expert là owner duy nhất của CRUD case; admin chỉ xem; fix expert library trống trong khi student catalog có case.

---

## 1. Thay đổi nghiệp vụ (đã cập nhật FE)

| Vai trò | Quyền case |
|---------|------------|
| **Expert** | Full CRUD. Tạo case mới hoặc promote từ review → **publish ngay** vào library của expert + catalog lớp sinh viên expert hỗ trợ. |
| **Admin** | **Read-only** — xem list + detail, không approve / hide / delete. |
| **Student** | Xem catalog (`GET /api/cases/catalog`) — chỉ case đã publish. |

**Bỏ hoàn toàn UI status:** `pending`, `approved`, `draft`, `rejected`.

**Thay bằng `caseOrigin` (2 giá trị):**

| `caseOrigin` | Ý nghĩa |
|--------------|---------|
| `expertCreated` | Expert tạo trực tiếp qua **New case** |
| `fromStudentRequest` | Expert publish từ **Approve & Promote** trên escalated review |

FE infer origin từ các field (ưu tiên field explicit từ BE):

- `caseOrigin` / `CaseOrigin` / `libraryCaseSource`
- `isPromotedFromStudentRequest` / `promotedFromReview` / `fromStudentRequest`

---

## 2. Bug hiện tại — Expert library trống, Student catalog có case

### Triệu chứng

- `GET /api/expert/cases` trả **0 items** (hoặc envelope FE không parse được).
- `GET /api/cases/catalog` trả case mà expert vừa tạo / promote.
- Dashboard `GET /api/expert/dashboard/recent-cases` có thể có data trong khi `/api/expert/cases` trống.

### Nguyên nhân FE đã fix (phía client)

`fetchExpertCasesPaged` trước đây chỉ unwrap `data.items` / `data.result.items`. Đã thêm unwrap `data.data.items` giống admin list.

### Yêu cầu BE (bắt buộc)

#### 2.1 `GET /api/expert/cases` — scope & envelope

**Scope:** Trả **tất cả case do expert đang đăng nhập sở hữu**, gồm:

1. Case tạo qua `POST /api/expert/cases` hoặc DICOM ingest (`createdByExpertId = currentExpertId`).
2. Case tạo qua `POST /api/expert/reviews/{sessionId}/promote` (**phải set `createdByExpertId`** = expert promote).

Không filter theo `isApproved` / `status` workflow cũ — mọi case publish đều nằm trong list.

**Response envelope thống nhất:**

```json
{
  "message": "OK",
  "data": {
    "items": [ /* GetMedicalCaseDTO[] */ ],
    "totalCount": 12,
    "pageIndex": 1,
    "pageSize": 100
  }
}
```

Hoặc flat `{ items, totalCount, pageIndex, pageSize }` — FE hỗ trợ cả hai qua unwrap.

**Mỗi item list phải có:**

```json
{
  "id": "uuid",
  "title": "...",
  "createdByExpertId": "uuid",
  "caseOrigin": "expertCreated",
  "thumbnailUrl": "...",
  "categoryName": "...",
  "boneLocation": "...",
  "difficulty": "Medium",
  "createdAt": "2025-06-07T..."
}
```

`caseOrigin` values: `"expertCreated"` | `"fromStudentRequest"`.

#### 2.2 Create case — auto-publish

`POST /api/expert/cases` và DICOM ingest:

- Set `isApproved = true`, `isActive = true` mặc định.
- Set `createdByExpertId` = JWT expert id.
- Set `caseOrigin = "expertCreated"`.
- Đồng bộ ngay vào student catalog cho các lớp expert hỗ trợ (cùng rule với catalog hiện tại).

#### 2.3 Promote review — auto-publish + ownership

`POST /api/expert/reviews/{sessionId}/promote`:

- Tạo/update case với `createdByExpertId = promotingExpertId`.
- Set `caseOrigin = "fromStudentRequest"`.
- Set `isApproved = true`, `isActive = true`.
- Trả `promotedCaseId` / `caseId` trong response.
- **Khuyến nghị:** endpoint atomic `approve-and-promote` (xem `BE_REQUEST_EXPERT_REVIEW_PROMOTE.md`).

Sau promote thành công, case **phải** xuất hiện trong `GET /api/expert/cases` của expert đó.

#### 2.4 Admin endpoints — read-only

| Endpoint | Thay đổi |
|----------|----------|
| `GET /api/admin/cases` | Giữ list read-only; trả `caseOrigin`; **không** yêu cầu admin approve. |
| `GET /api/admin/cases/{id}` | Read-only detail. |
| `PUT /api/admin/cases/{id}` | **Deprecate** hoặc trả `403` — admin không còn approve/hide. |
| `DELETE /api/admin/cases/{id}` | **Deprecate** hoặc trả `403` — chỉ expert xóa qua `DELETE /api/expert/cases/{id}`. |

#### 2.5 Deprecate workflow fields

Có thể giữ `isApproved` / `isActive` trong DB để tương thích catalog, nhưng:

- Luôn `true` khi case còn trong library.
- Không expose `status: Pending|Approved|Draft|Rejected` cho FE expert/admin UI.
- Xóa case = hard delete hoặc soft-delete do expert — không còn trạng thái `rejected`.

---

## 3. Student catalog — không đổi contract chính

`GET /api/cases/catalog` giữ nguyên. Đảm bảo case expert tạo/promote **xuất hiện** với:

```json
{
  "caseOrigin": "expertCreated"
}
```

hoặc

```json
{
  "caseOrigin": "communityPromoted"
}
```

FE student map `communityPromoted` ↔ promote từ student request. **Khuyến nghị BE thống nhất** tên:

- Expert API: `fromStudentRequest`
- Student catalog: `communityPromoted` (giữ backward compat) **hoặc** alias `fromStudentRequest`

---

## 4. Checklist verify sau khi BE deploy

- [ ] Expert A tạo case → thấy ngay trong `/expert/cases` tab **Created by you**.
- [ ] Expert A promote review → thấy trong tab **From student requests**.
- [ ] Student trong lớp expert A hỗ trợ thấy cả hai case trong catalog.
- [ ] Admin mở `/admin/cases` → thấy case, **không** có nút approve/delete (FE đã bỏ).
- [ ] `GET /api/expert/cases` trả envelope có `data.items` và `createdByExpertId` đúng.
- [ ] Expert B **không** thấy case của Expert A (scoped list).

---

## 5. Files FE đã chỉnh (reference)

| File | Thay đổi |
|------|----------|
| `lib/case-origin.ts` | Shared `inferCaseLibraryOrigin`, labels |
| `lib/api/expert-cases.ts` | `caseOrigin` on `ExpertCase`; fix paged unwrap |
| `features/expert/components/ExpertCasesPage.tsx` | Tabs: All / Created / From requests |
| `components/expert/CaseManagementCard.tsx` | Origin badge thay status |
| `features/admin/components/AdminCasesPage.tsx` | Read-only, bỏ delete |
| `features/admin/components/AdminCaseDetailPage.tsx` | Bỏ approve/hide/delete/review form |
| `features/expert/components/CreateExpertCaseForm.tsx` | `isApproved: true` on save |
| `app/expert/dashboard/page.tsx` | Origin tabs |

---

## 6. Ưu tiên triển khai BE

1. **P0:** Fix `GET /api/expert/cases` scope + envelope + `createdByExpertId` trên promote.
2. **P0:** Auto-publish on create (`isApproved/isActive = true`, `caseOrigin`).
3. **P1:** Trả `caseOrigin` explicit trên mọi DTO.
4. **P1:** Block admin PUT/DELETE case (403).
5. **P2:** Atomic approve-and-promote endpoint.
