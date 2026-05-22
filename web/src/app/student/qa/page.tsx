import { StudentAppChrome } from '@/components/student/StudentAppChrome';
import Link from 'next/link';
import { ImageUp, ArrowRight, ArrowLeft } from 'lucide-react';

export default function StudentQAPage() {
  return (
    <div className="min-h-screen">
      <StudentAppChrome breadcrumb="AI Q&A" title="AI Q&A" subtitle="Upload medical images for AI analysis" />

      <div className="p-6 max-w-2xl mx-auto">
        <Link
          href="/student/dashboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <Link
          href="/student/qa/image"
          className="block bg-card rounded-xl border border-border p-8 transition-all duration-200 hover:shadow-lg hover:border-warning/50 group"
        >
          <div className="w-16 h-16 rounded-xl bg-warning/10 text-warning flex items-center justify-center mb-6 mx-auto">
            <ImageUp className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-semibold text-card-foreground mb-3 text-center">Q&A by Image</h2>
          <p className="text-muted-foreground mb-6 text-center">
            Upload an X-ray, CT, or MRI image and ask AI questions about it.
          </p>

          <ul className="space-y-3 mb-8">
            <li className="flex items-start gap-3 text-sm text-card-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-warning mt-1.5 flex-shrink-0" />
              Support X-ray, CT, MRI image formats
            </li>
            <li className="flex items-start gap-3 text-sm text-card-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-warning mt-1.5 flex-shrink-0" />
              AI detects and analyzes bone lesions
            </li>
            <li className="flex items-start gap-3 text-sm text-card-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-warning mt-1.5 flex-shrink-0" />
              Get structured diagnostic suggestions
            </li>
          </ul>

          <div className="flex items-center justify-center gap-2 text-warning font-medium text-sm group-hover:gap-3 transition-all duration-200">
            Get started
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>
      </div>
    </div>
  );
}
