-- Supabase: also hide Prisma's own migrations table from the public Data API.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
