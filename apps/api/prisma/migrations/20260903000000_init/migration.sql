CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "linkedin_url" TEXT NOT NULL,
    "linkedin_id" TEXT,
    "full_name" TEXT NOT NULL,
    "job_title" TEXT,
    "company_name" TEXT,
    "industry" TEXT,
    "location" TEXT,
    "normalized_location" TEXT,
    "country" TEXT,
    "summary" TEXT,
    "years_experience" DOUBLE PRECISION,
    "experience" JSONB NOT NULL DEFAULT '[]',
    "education" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "skills" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profile_skills" (
    "profile_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,

    CONSTRAINT "profile_skills_pkey" PRIMARY KEY ("profile_id", "skill_id")
);

CREATE UNIQUE INDEX "profiles_linkedin_url_key" ON "profiles"("linkedin_url");
CREATE INDEX "profiles_id_cursor_idx" ON "profiles"("id");
CREATE UNIQUE INDEX "skills_normalized_name_key" ON "skills"("normalized_name");
CREATE INDEX "profile_skills_skill_id_idx" ON "profile_skills"("skill_id");

ALTER TABLE "profile_skills"
  ADD CONSTRAINT "profile_skills_profile_id_fkey"
  FOREIGN KEY ("profile_id") REFERENCES "profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "profile_skills"
  ADD CONSTRAINT "profile_skills_skill_id_fkey"
  FOREIGN KEY ("skill_id") REFERENCES "skills"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
