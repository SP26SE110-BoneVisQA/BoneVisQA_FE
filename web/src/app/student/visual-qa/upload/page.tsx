import { redirect } from 'next/navigation';

/** @deprecated Upload is integrated into the Visual QA workspace. */
export default function StudentVisualQaUploadRedirect() {
  redirect('/student/visual-qa/workspace');
}
