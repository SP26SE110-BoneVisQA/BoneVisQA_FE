# Mẫu Câu Hỏi Quiz - BoneVisQA

## Format CSV

```csv
questionText,type,optionA,optionB,optionC,optionD,correctAnswer,hint,explanation
"Câu hỏi ở đây?",MultipleChoice,"Đáp án A","Đáp án B","Đáp án C","Đáp án D",B,"Gợi ý khi cần","Giải thích đáp án đúng"
```

## Format JSON

```json
[
  {
    "questionText": "Câu hỏi ở đây?",
    "type": "MultipleChoice",
    "optionA": "Đáp án A",
    "optionB": "Đáp án B",
    "optionC": "Đáp án C",
    "optionD": "Đáp án D",
    "correctAnswer": "B",
    "hint": "Gợi ý khi cần",
    "explanation": "Giải thích đáp án đúng"
  }
]
```

## Format Paste Text

```
1. Câu hỏi ở đây?
A) Đáp án A  B) Đáp án B  C) Đáp án C  D) Đáp án D
Answer: B
Hint: Gợi ý khi cần
Explanation: Giải thích đáp án đúng

2. Câu hỏi tiếp theo?
A) Đáp án A  B) Đáp án B  C) Đáp án C  D) Đáp án D
Answer: A
```

## Các trường bắt buộc

| Trường | Mô tả | Ví dụ |
|--------|-------|-------|
| questionText | Nội dung câu hỏi | "Dấu hiệu Codman Triangle là gì?" |
| type | Loại câu hỏi | MultipleChoice, selection-choice |
| correctAnswer | Đáp án đúng | A, B, C, hoặc D |
| optionA | Đáp án A | "Osteosarcoma" |
| optionB | Đáp án B | "Osteoid Osteoma" |
| optionC | Đáp án C | "Bone Metastasis" |
| optionD | Đáp án D | "Bệnh Paget" |

## Các trường tùy chọn

| Trường | Mô tả | Ví dụ |
|--------|-------|-------|
| hint | Gợi ý cho học sinh | "Xem xét hình tam giác" |
| explanation | Giải thích đáp án | "Đây là dấu hiệu của Osteosarcoma" |
| caseTitle | Liên kết case lâm sàng | "Case 1: Gãy xương đùi" |
| maxScore | Điểm tối đa (mặc định: 10) | 10 |
| imageUrl | URL hình ảnh minh họa | "/images/xray-001.jpg" |

## Ví dụ thực tế

Xem file: `sample_quiz_questions_vi.csv` hoặc `sample_quiz_questions_vi.json`
