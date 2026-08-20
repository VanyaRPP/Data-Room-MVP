-- Search matches names anywhere in the string ("%query%"), which a btree index
-- cannot help with: btrees only accelerate anchored prefixes. A trigram GIN
-- index is what makes an unanchored, case-insensitive match indexable, and it
-- covers exactly the expression the query uses.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "node_name_trgm" ON "Node" USING gin (lower("name") gin_trgm_ops);
