# BE Request: Expert Review — Approve & Promote to Case Library

**Ngày:** 2025-06-07  
**Phía FE:** `ExpertReviewsPage`, `ExpertReviewWorkspace`, `expert-reviews.ts`  
**Mục tiêu:** Khắc phục lỗi partial success (approve OK, promote fail), thiếu field `description`, draft 409, student kẹt Educator feedback.

---

## 1. Bối cảnh luồng hiện tại (FE)

Khi expert bấm **Approve & Promote to Library**, FE gọi **3 bước tuần tự**:

| Bước | Method | Path | Body |
|------|--------|------|------|
| 1 (tùy chọn) | `PUT` | `/api/expert/reviews/{sessionId}/draft` | `reviewNote`, `correctedRoiBoundingBox` |
| 2 | `POST` | `/api/expert/reviews/{sessionId}/approve` | `{}` |
| 3 | `POST` | `/api/expert/reviews/{sessionId}/promote` | Xem mục 2 |

**Nguồn dữ liệu clinical trên FE (không nhập tay riêng):**

FE dùng một state duy nhất, hiển thị qua component **`ReportWorkbench`** (card *Expert clinical override*). Khi mở review, FE **prefill** từ `item.report` (câu trả lời AI):

| Field promote (BE) | Nguồn prefill FE | Trường report AI |
|--------------------|------------------|------------------|
| `description` | Main diagnosis | `suggestedDiagnosis` → `diagnosis` → `answerText` |
| `suggestedDiagnosis` | Differential | `differentialDiagnoses[]` → fallback `keyFindings[]` |
| `keyFindings` | Key imaging | `keyImagingFindings` → `keyImagingFindings` trên item |
| `reflectiveQuestions` | Reflection | `report.reflectiveQuestions` / `item.reflectiveQuestions` |

Expert chỉnh sửa trực tiếp trên `ReportWorkbench`; promote gửi giá trị đã chỉnh.

---

## 2. Contract promote (FE → BE)

### `POST /api/expert/reviews/{sessionId}/promote`

**Headers:** `Authorization: Bearer`, `Content-Type: application/json`

**Request body (camelCase):**

```json
{
  "title": "Distal radius fracture — pediatric",
  "categoryId": "uuid",
  "categoryName": "Trauma",
  "difficulty": "intermediate",
  "tagNames": ["fracture", "pediatric", "X-Ray"],
  "description": "Main structured diagnosis text",
  "suggestedDiagnosis": "Differential line 1\nDifferential line 2",
  "keyFindings": "Cortical disruption\nSoft tissue swelling",
  "reflectiveQuestions": "What view best shows the lesion?\nWhich complication to rule out?",
  "turnAnnotations": [
    {
      "turnIndex": 1,
      "turnId": "uuid",
      "userMessageId": "uuid",
      "assistantMessageId": "uuid",
      "roiBoundingBox": [0.1, 0.2, 0.3, 0.4]
    }
  ]
}
```

**Field bắt buộc (FE validate trước khi gọi):**

- `title`, `categoryId`, `difficulty`, `tagNames` (≥ 1 phần tử)
- `description`, `suggestedDiagnosis`, `keyFindings`, `reflectiveQuestions` — **non-empty string**

**Response thành công (200/201):**

```json
{
  "promotedCaseId": "uuid",
  "caseId": "uuid",
  "title": "...",
  "status": "approved"
}
```

FE đọc `promotedCaseId` hoặc `caseId` để invalidate case library cache.

**Lỗi validation (400):**

```json
{
  "type": "https://tools.ietf.org/html/rfc7807",
  "title": "Validation failed",
  "status": 400,
  "errors": {
    "description": ["Description is required."]
  }
}
```

---

## 3. Yêu cầu BE — Ưu tiên cao

### 3.1 Endpoint atomic (khuyến nghị mạnh)

**`POST /api/expert/reviews/{sessionId}/approve-and-promote`**

Gộp approve + tạo case library trong **một transaction**. Nếu promote fail → **rollback** approve (session vẫn `EscalatedToExpert`).

**Body:** giống promote + tùy chọn:

```json
{
  "reviewNote": "Optional expert note to student",
  "correctedRoiBoundingBox": [0.1, 0.2, 0.3, 0.4],
  "title": "...",
  "categoryId": "...",
  "difficulty": "intermediate",
  "tagNames": ["..."],
  "description": "...",
  "suggestedDiagnosis": "...",
  "keyFindings": "...",
  "reflectiveQuestions": "...",
  "turnAnnotations": []
}
```

**Lợi ích:** Tránh trạng thái “đã approve, chưa có case” — nguyên nhân student kẹt *Educator feedback*.

---

### 3.2 Queue / detail API — trả đủ structured report

**`GET /api/expert/reviews/case-answer`** (list) và **`GET /api/expert/reviews/{sessionId}`** (detail) phải luôn trả `report` đầy đủ để FE prefill không cần nhập tay:

```json
{
  "report": {
    "suggestedDiagnosis": "string",
    "diagnosis": "string",
    "answerText": "string",
    "differentialDiagnoses": ["string"],
    "keyFindings": ["string"],
    "keyImagingFindings": "string",
    "reflectiveQuestions": ["string"] ,
    "aiConfidenceScore": 0.85
  }
}
```

**Hiện trạng lỗi:** List queue đôi khi thiếu field → FE prefill rỗng → promote 400 *Description required* dù AI đã trả lời.

**Yêu cầu:** Detail endpoint merge từ turn assistant message / session report; list có thể tóm tắt nhưng detail **bắt buộc đủ** 4 nhóm field trên.

---

### 3.3 Draft endpoint — phạm vi và lỗi 409

**`PUT /api/expert/reviews/{sessionId}/draft`**

| Yêu cầu | Chi tiết |
|---------|----------|
| Chỉ cho phép khi | `sessionStatus === EscalatedToExpert` (hoặc tương đương pending expert) |
| Body hợp lệ | `reviewNote?`, `correctedRoiBoundingBox?` — **ít nhất một field**; body rỗng → 400 thay vì 409 |
| Sau approve | Trả **409** với message rõ: `"Draft can only be saved while the session is escalated to an expert."` — **đúng như hiện tại**, FE sẽ skip draft khi không cần |
| Không bắt buộc draft trước promote | Promote không nên phụ thuộc draft đã lưu |

**Lỗi quan sát:** Auto-save ROI sau approve gây 409 hàng loạt trên console — BE có thể trả **404/204** im lặng nếu session không còn escalated (tùy chọn).

---

### 3.4 Đồng bộ trạng thái student sau promote / partial fail

| Trạng thái | Session student | Educator feedback UI |
|------------|-----------------|----------------------|
| Escalated, chưa review | `EscalatedToExpert` | Chờ expert |
| Approve + promote OK | `Resolved` / `PublishedToLibrary` | Hiển thị feedback + case trong library |
| Approve OK, promote FAIL | **Không được** để student ở trạng thái “feedback recorded” mà không có case | Rollback hoặc flag `promoteFailed` |

**Student thread (`GET /api/student/visual-qa/sessions/{id}/thread`):**

- Cập nhật `sessionStatus`, `reviewFeedback`, `capabilities` đồng bộ với kết quả promote.
- Nếu expert đã ghi `reviewNote` nhưng promote fail → student vẫn thấy note nhưng **không** hiển thị “published to library”.

---

### 3.5 Case library sau promote

**`GET /api/expert/cases?pageIndex=1&pageSize=100`**

- Case vừa promote phải xuất hiện ngay (không cache stale phía BE).
- Trả `status`, `isApproved`, `thumbnailUrl` nếu DICOM đã gắn từ session gốc.
- `pageSize` tối đa ≥ 100 (FE request 1000, nên BE cap rõ trong doc hoặc hỗ trợ cursor).

---

## 4. Yêu cầu BE — Ưu tiên trung bình

### 4.1 Map field naming nhất quán

| Promote field | Case entity field | Ghi chú |
|---------------|-------------------|---------|
| `description` | `MedicalCase.Description` | Chẩn đoán / mô tả chính |
| `suggestedDiagnosis` | `SuggestedDiagnosis` | FE gửi differential (naming lịch sử) |
| `keyFindings` | `KeyFindings` | Imaging findings |
| `reflectiveQuestions` | `ReflectiveQuestions` | Chuỗi, phân tách `\n` |

BE xác nhận mapping; nếu đổi tên, cập nhật `API_CONTRACTS.md`.

### 4.2 Promote tự copy media

Từ session escalated → case library:

- Copy `studyImageUrl` / DICOM reference
- Copy ROI từ `turnAnnotations` hoặc `correctedRoiBoundingBox`
- Gán `createdByExpertId` từ JWT expert

### 4.3 Idempotency

`POST .../promote` gọi lại cùng `sessionId` đã promote → trả **200** + `promotedCaseId` hiện có (không tạo duplicate case).

---

## 5. Test plan cho BE

1. Escalated session có AI report đầy đủ → promote thành công → case visible tại `GET /api/expert/cases`.
2. Promote thiếu `description` → 400, **session vẫn escalated**, chưa approve (hoặc rollback nếu atomic).
3. Approve thành công, promote fail (mock DB error) → session **không** chuyển history approved; student không kẹt feedback.
4. `PUT /draft` sau approve → 409 (hoặc 404), không side effect.
5. Student thread sau promote OK → `sessionStatus` phản ánh published; educator section có nội dung review.
6. Gọi promote 2 lần → idempotent, một case duy nhất.

---

## 6. Tham chiếu FE (sau refactor)

- Clinical fields: **`ReportWorkbench`** only — không duplicate form publish.
- Prefill: `prefillClinicalFieldsFromItem()` khi `openEdit` + sau `GET /api/expert/reviews/{sessionId}`.
- Publish card: chỉ metadata (title, category, difficulty, tags) + checklist `PromoteClinicalReadiness`.
- Validation: `validatePromotePayload()` trước mọi API call.

---

## 7. Liên hệ / phụ thuộc

- Cập nhật `_ai-context/API_CONTRACTS.md` mục **Expert promote case library** khi BE triển khai atomic endpoint.
- FE sẽ chuyển sang `approve-and-promote` khi BE sẵn sàng (một call thay vì 3).
