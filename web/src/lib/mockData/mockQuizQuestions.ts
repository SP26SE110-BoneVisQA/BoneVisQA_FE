/**
 * Mock data: Câu hỏi mẫu cho Quiz
 * Dùng để test hoặc import vào quiz
 */

export interface MockQuizQuestion {
  questionText: string;
  type: 'MultipleChoice';
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  topic: string;
  /** URL ảnh X-quang minh họa - sử dụng API placeholder của hệ thống */
  imageUrl?: string;
}

/**
 * Các URL ảnh placeholder X-quang mẫu
 * Sử dụng API placeholder: /api/placeholder/{width}/{height}
 */
export const SAMPLE_XRAY_IMAGES = {
  // X-quang đầu gối
  knee: '/api/placeholder/480/320',
  // X-quang cột sống
  spine: '/api/placeholder/480/320',
  // X-quang xương dài
  longBone: '/api/placeholder/480/320',
  // X-quang khớp vai
  shoulder: '/api/placeholder/480/320',
  // X-quang cánh tay
  arm: '/api/placeholder/480/320',
  // X-quang sọ
  skull: '/api/placeholder/480/320',
  // CT scan
  ctScan: '/api/placeholder/480/320',
};

/**
 * Câu hỏi mẫu về X-quang xương - phù hợp với chủ đề BoneVisQA
 */
export const MOCK_QUIZ_QUESTIONS: MockQuizQuestion[] = [
  {
    questionText: 'Trên X-quang thẳng đầu gối, dấu hiệu "Joint Space Narrowing" thường liên quan đến bệnh lý nào?',
    type: 'MultipleChoice',
    optionA: 'Viêm khớp dạng thấp (Rheumatoid Arthritis)',
    optionB: 'Thoái hóa khớp (Osteoarthritis)',
    optionC: 'Gút (Gout)',
    optionD: 'Viêm khớp nhiễm trùng (Septic Arthritis)',
    correctAnswer: 'B',
    difficulty: 'Medium',
    topic: 'Joint Diseases',
    imageUrl: SAMPLE_XRAY_IMAGES.knee,
  },
  {
    questionText: 'Đặc điểm X-quang nào giúp phân biệt gãy xương lành tính (Greenstick) với gãy xương thông thường ở trẻ em?',
    type: 'MultipleChoice',
    optionA: 'Có nhiều mảnh gãy',
    optionB: 'Chỉ một bên vỏ xương gãy, bên kia cong gãy',
    optionC: 'Xương bị di lệch hoàn toàn',
    optionD: 'Có tổn thương mô mềm kèm theo',
    correctAnswer: 'B',
    difficulty: 'Medium',
    topic: 'Long Bone Fractures',
    imageUrl: SAMPLE_XRAY_IMAGES.longBone,
  },
  {
    questionText: 'Góc di lệch bao nhiêu độ được coi là chấp nhận được ở người lớn khi gãy xương cánh tay?',
    type: 'MultipleChoice',
    optionA: '5-10 độ',
    optionB: '15-20 độ',
    optionC: '25-30 độ',
    optionD: 'Dưới 5 độ',
    correctAnswer: 'B',
    difficulty: 'Easy',
    topic: 'Long Bone Fractures',
    imageUrl: SAMPLE_XRAY_IMAGES.arm,
  },
  {
    questionText: 'Dấu hiệu "Codman Triangle" trên X-quang thường gợi ý bệnh lý ác tính nào của xương?',
    type: 'MultipleChoice',
    optionA: 'Ung thư xương nguyên phát (Osteosarcoma)',
    optionB: 'U xương lành tính (Osteoid Osteoma)',
    optionC: 'Di căn xương (Bone Metastasis)',
    optionD: 'Bệnh Paget của xương',
    correctAnswer: 'A',
    difficulty: 'Hard',
    topic: 'Bone Tumors',
    imageUrl: SAMPLE_XRAY_IMAGES.longBone,
  },
  {
    questionText: 'Đặc điểm X-quang nào là dấu hiệu đặc trưng của bệnh Perthes ở trẻ em?',
    type: 'MultipleChoice',
    optionA: 'Đầu xương đùi bị dẹt và teo',
    optionB: 'Khe khớp rộng bất thường',
    optionC: 'Có dị vật trong khớp',
    optionD: 'Xương bị calcification tăng',
    correctAnswer: 'A',
    difficulty: 'Medium',
    topic: 'Joint Diseases',
    imageUrl: SAMPLE_XRAY_IMAGES.knee,
  },
  {
    questionText: 'Tổn thương "Egg-shell Appearance" trên X-quang là đặc trưng của loại u xương nào?',
    type: 'MultipleChoice',
    optionA: 'Osteosarcoma',
    optionB: 'Giant Cell Tumor',
    optionC: 'Aneurysmal Bone Cyst',
    optionD: 'Enchondroma',
    correctAnswer: 'C',
    difficulty: 'Hard',
    topic: 'Bone Tumors',
    imageUrl: SAMPLE_XRAY_IMAGES.longBone,
  },
  {
    questionText: 'Trên X-quang cột sống cổ, góc Pavlov ratio nhỏ hơn bao nhiêu được coi là bất thường?',
    type: 'MultipleChoice',
    optionA: '0.5',
    optionB: '0.7',
    optionC: '0.8',
    optionD: '1.0',
    correctAnswer: 'C',
    difficulty: 'Hard',
    topic: 'Spine Lesions',
    imageUrl: SAMPLE_XRAY_IMAGES.spine,
  },
  {
    questionText: 'Dấu hiệu "Snowstorm Appearance" trên X-quang thường gặp trong bệnh lý nào?',
    type: 'MultipleChoice',
    optionA: 'Bệnh Huntington',
    optionB: 'Bệnh Paget của xương',
    optionC: 'Bệnh cò xương (Rickets)',
    optionD: 'Loãng xương (Osteoporosis)',
    correctAnswer: 'B',
    difficulty: 'Medium',
    topic: 'Spine Lesions',
    imageUrl: SAMPLE_XRAY_IMAGES.spine,
  },
  {
    questionText: 'Đặc điểm nào trên X-quang giúp phân biệt gãy xương mới với gãy xương cũ đã liền?',
    type: 'MultipleChoice',
    optionA: 'Đường gãy sắc nét',
    optionB: 'Có Calhoun callus',
    optionC: 'Xương bị lệch trục',
    optionD: 'Mất vỏ xương tại chỗ gãy',
    correctAnswer: 'B',
    difficulty: 'Easy',
    topic: 'Long Bone Fractures',
    imageUrl: SAMPLE_XRAY_IMAGES.longBone,
  },
  {
    questionText: 'Thương tổn lamelar (Layered) hay "Onion Skin" trên CT scan thường gợi ý loại u nào?',
    type: 'MultipleChoice',
    optionA: 'Osteosarcoma',
    optionB: 'Ewing Sarcoma',
    optionC: 'Chondrosarcoma',
    optionD: 'Metastatic Disease',
    correctAnswer: 'B',
    difficulty: 'Hard',
    topic: 'Bone Tumors',
    imageUrl: SAMPLE_XRAY_IMAGES.ctScan,
  },
];

/**
 * Convert mock questions sang format import cho QuestionImportDialog
 */
export function getMockQuestionsForImport() {
  return MOCK_QUIZ_QUESTIONS.map((q, idx) => ({
    id: idx + 1,
    questionText: q.questionText,
    type: q.type,
    optionA: q.optionA,
    optionB: q.optionB,
    optionC: q.optionC,
    optionD: q.optionD,
    correctAnswer: q.correctAnswer,
    imageUrl: q.imageUrl,
  }));
}

/**
 * Format Excel/CSV để import
 * Copy nội dung này vào file Excel rồi import
 * Lưu ý: Import CSV không hỗ trợ imageUrl - cần thêm ảnh thủ công sau khi import
 */
export const MOCK_CSV_CONTENT = `questionText,type,optionA,optionB,optionC,optionD,correctAnswer
"Trên X-quang thẳng đầu gối, dấu hiệu Joint Space Narrowing thường liên quan đến bệnh lý nào?",MultipleChoice,Viêm khớp dạng thấp (Rheumatoid Arthritis),Thoái hóa khớp (Osteoarthritis),Gút (Gout),Viêm khớp nhiễm trùng (Septic Arthritis),B
"Đặc điểm X-quang nào giúp phân biệt gãy xương lành tính (Greenstick) với gãy xương thông thường ở trẻ em?",MultipleChoice,"Có nhiều mảnh gãy","Chỉ một bên vỏ xương gãy, bên kia cong gãy",Xương bị di lệch hoàn toàn,Có tổn thương mô mềm kèm theo,B
"Góc di lệch bao nhiêu độ được coi là chấp nhận được ở người lớn khi gãy xương cánh tay?",MultipleChoice,5-10 độ,15-20 độ,25-30 độ,Dưới 5 độ,B
"Dấu hiệu Codman Triangle trên X-quang thường gợi ý bệnh lý ác tính nào của xương?",MultipleChoice,Ung thư xương nguyên phát (Osteosarcoma),U xương lành tính (Osteoid Osteoma),Di căn xương (Bone Metastasis),Bệnh Paget của xương,A
"Đặc điểm X-quang nào là dấu hiệu đặc trưng của bệnh Perthes ở trẻ em?",MultipleChoice,Đầu xương đùi bị dẹt và teo,Khe khớp rộng bất thường,Có dị vật trong khớp,Xương bị calcification tăng,A
"Tổn thương Egg-shell Appearance trên X-quang là đặc trưng của loại u xương nào?",MultipleChoice,Osteosarcoma,Giant Cell Tumor,Aneurysmal Bone Cyst,Enchondroma,C
"Trên X-quang cột sống cổ, góc Pavlov ratio nhỏ hơn bao nhiêu được coi là bất thường?",MultipleChoice,0.5,0.7,0.8,1.0,C
"Dấu hiệu Snowstorm Appearance trên X-quang thường gặp trong bệnh lý nào?",MultipleChoice,Bệnh Huntington,Bệnh Paget của xương,Bệnh cò xương (Rickets),Loãng xương (Osteoporosis),B
"Đặc điểm nào trên X-quang giúp phân biệt gãy xương mới với gãy xương cũ đã liền?",MultipleChoice,Đường gãy sắc nét,Có Calhoun callus,Xương bị lệch trục,Mất vỏ xương tại chỗ gãy,B
"Thương tổn lamelar (Layered) hay Onion Skin trên CT scan thường gợi ý loại u nào?",MultipleChoice,Osteosarcoma,Ewing Sarcoma,Chondrosarcoma,Metastatic Disease,B`;

/**
 * Danh sách imageUrl để thêm ảnh vào câu hỏi sau khi import
 * Dán giá trị này vào cột imageUrl trong database
 */
export const MOCK_IMAGE_URLS: Record<number, string> = {
  1: '/api/placeholder/480/320',  // Knee X-ray
  2: '/api/placeholder/480/320',  // Long Bone X-ray
  3: '/api/placeholder/480/320',  // Arm X-ray
  4: '/api/placeholder/480/320',  // Bone Tumor X-ray
  5: '/api/placeholder/480/320',  // Knee X-ray
  6: '/api/placeholder/480/320',  // Long Bone X-ray
  7: '/api/placeholder/480/320',  // Spine X-ray
  8: '/api/placeholder/480/320',  // Spine X-ray
  9: '/api/placeholder/480/320',  // Long Bone X-ray
  10: '/api/placeholder/480/320', // CT Scan
};
