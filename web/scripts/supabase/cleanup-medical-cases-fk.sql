-- BoneVisQA — cleanup medical_cases blocked by visual_qa_sessions FK
-- Run in Supabase SQL Editor (staging first, then production).
--
-- Error addressed:
--   visual_qa_sessions.vqs_case_fk references medical_cases(id) without ON DELETE behavior
--   → deleting a case fails while sessions still reference it.
--
-- Recommended long-term fix (also request BE migration):
--   ON DELETE SET NULL  — keep anonymized session history, drop case link
--   ON DELETE CASCADE   — delete sessions when case is deleted (destructive)
--
-- This script uses SET NULL as the safer default for teaching audit trails.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Inspect blocking references (run alone first if you only want a report)
-- ---------------------------------------------------------------------------
-- SELECT mc.id, mc.title, COUNT(vqs.id) AS session_count
-- FROM medical_cases mc
-- JOIN visual_qa_sessions vqs ON vqs.case_id = mc.id
-- GROUP BY mc.id, mc.title
-- ORDER BY session_count DESC;

-- ---------------------------------------------------------------------------
-- 2) Optional: delete dependent rows first (use only if you want hard purge)
--    Uncomment block B instead of block A when sessions must be removed too.
-- ---------------------------------------------------------------------------

-- Block A (recommended): unlink sessions, then delete orphan cases you choose
-- Replace the UUID list with case ids you want to remove.
/*
UPDATE visual_qa_sessions
SET case_id = NULL
WHERE case_id IN (
  '0c794ad3-2323-4853-97fb-3e9fddf5e03f'::uuid
  -- , 'another-case-id'::uuid
);

DELETE FROM medical_cases
WHERE id IN (
  '0c794ad3-2323-4853-97fb-3e9fddf5e03f'::uuid
);
*/

-- Block B (destructive): cascade-delete sessions for specific cases, then cases
/*
DELETE FROM visual_qa_sessions
WHERE case_id IN (
  '0c794ad3-2323-4853-97fb-3e9fddf5e03f'::uuid
);

DELETE FROM medical_cases
WHERE id IN (
  '0c794ad3-2323-4853-97fb-3e9fddf5e03f'::uuid
);
*/

-- ---------------------------------------------------------------------------
-- 3) Fix FK so future deletes do not fail (schema migration)
-- ---------------------------------------------------------------------------
ALTER TABLE visual_qa_sessions
  DROP CONSTRAINT IF EXISTS vqs_case_fk;

ALTER TABLE visual_qa_sessions
  ADD CONSTRAINT vqs_case_fk
  FOREIGN KEY (case_id)
  REFERENCES medical_cases (id)
  ON DELETE SET NULL;

-- Ensure case_id is nullable if it was NOT NULL (required for SET NULL)
ALTER TABLE visual_qa_sessions
  ALTER COLUMN case_id DROP NOT NULL;

COMMIT;

-- ---------------------------------------------------------------------------
-- 4) Verify
-- ---------------------------------------------------------------------------
-- SELECT conname, confdeltype
-- FROM pg_constraint
-- WHERE conname = 'vqs_case_fk';
-- confdeltype: 'n' = SET NULL, 'c' = CASCADE, 'r' = RESTRICT

-- After migration, delete a case with no other blockers:
-- DELETE FROM medical_cases WHERE id = '0c794ad3-2323-4853-97fb-3e9fddf5e03f';
