import axios from 'axios';

const UPLOAD_MESSAGE_VI: Record<string, string> = {
  'File is larger than 209715200 bytes':
    'File vượt 200 MB. Hãy nén study nhỏ hơn 200 MB.',
  'File size exceeds 200 MB limit.':
    'File vượt 200 MB. Hãy nén study nhỏ hơn 200 MB.',
  'Only .zip or .rar study archives are allowed.':
    'Chỉ upload file .zip hoặc .rar.',
  'No valid DICOM images were found in this archive.':
    'Không tìm thấy file DICOM hợp lệ trong archive.',
  'Study archive could not be read after upload.':
    'Hệ thống chưa đọc được archive (thử lại sau hoặc liên hệ admin).',
};

function mapUploadMessage(message: string): string {
  const trimmed = message.trim();
  return UPLOAD_MESSAGE_VI[trimmed] ?? trimmed;
}

/** User-facing upload failure copy (ingestError / message / detail). */
export function formatVisualQaUploadError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as Record<string, unknown> | undefined;
    if (data) {
      if (typeof data.ingestError === 'string' && data.ingestError.trim()) {
        return mapUploadMessage(data.ingestError);
      }
      if (typeof data.message === 'string' && data.message.trim()) {
        return mapUploadMessage(data.message);
      }
      if (typeof data.detail === 'string' && data.detail.trim()) {
        return mapUploadMessage(data.detail);
      }
    }
  }
  if (err instanceof Error && err.message.trim()) {
    return mapUploadMessage(err.message);
  }
  return 'Upload thất bại. Vui lòng thử lại.';
}
