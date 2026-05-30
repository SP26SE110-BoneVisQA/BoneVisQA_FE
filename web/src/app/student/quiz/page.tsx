import { redirect } from 'next/navigation';

/** Legacy route — quiz hub moved to `/student/quizzes`. */
export default function StudentQuizLegacyPage() {
  redirect('/student/quizzes');
}
