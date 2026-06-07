import axios from 'axios';

const UPLOAD_MESSAGE_EN: Record<string, string> = {
  'File is larger than 209715200 bytes':
    'File exceeds the 200 MB limit. Compress the study below 200 MB and try again.',
  'File size exceeds 200 MB limit.':
    'File exceeds the 200 MB limit. Compress the study below 200 MB and try again.',
  'Only .zip or .rar study archives are allowed.':
    'Only .zip or .rar study archives are allowed.',
  'No valid DICOM images were found in this archive.':
    'No valid DICOM images were found in this archive.',
  'Study archive could not be read after upload.':
    'The archive could not be read after upload. Try again later or contact an administrator.',
};

function mapUploadMessage(message: string): string {
  const trimmed = message.trim();
  return UPLOAD_MESSAGE_EN[trimmed] ?? trimmed;
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
  return 'Upload failed. Please try again.';
}
