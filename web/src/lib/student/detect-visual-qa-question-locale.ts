import type { VisualQaLocale } from '@/lib/api/visual-qa/types';

const VIETNAMESE_DIACRITICS =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/;

/**
 * Infer answer locale from the student's question text.
 * BE uses the same heuristic; FE sends `?locale=` so responses match the question language.
 */
export function detectVisualQaQuestionLocale(questionText: string): VisualQaLocale {
  const text = questionText.trim();
  if (!text) return 'en';
  if (VIETNAMESE_DIACRITICS.test(text)) return 'vi';
  return 'en';
}
