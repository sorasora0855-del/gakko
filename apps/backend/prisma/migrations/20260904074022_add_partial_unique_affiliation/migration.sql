DROP INDEX IF EXISTS "user_affiliations_academicYearId_gradeId_attendanceNumber_idx";

CREATE UNIQUE INDEX "user_affiliations_current_unique"
ON "user_affiliations"("academicYearId", "gradeId", "attendanceNumber")
WHERE "isCurrent" = true;
