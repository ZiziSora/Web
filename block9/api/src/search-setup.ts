import type { PoolClient } from 'pg';

export const quoteIdentifier = (value: string) => '"' + value.replaceAll('"', '""') + '"';

/** Additive, repeatable setup; does not change business fields or extension ownership. */
export async function setupSearch(client: PoolClient, schema: string) {
  const ns = quoteIdentifier(schema);
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query("SET LOCAL statement_timeout = '60s'");
    await client.query('CREATE SCHEMA IF NOT EXISTS extensions');
    await client.query('CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions');
    await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions');
    const extensions = await client.query<{ extname: string; schema: string }>(`SELECT e.extname, n.nspname AS schema FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname IN ('unaccent','pg_trgm')`);
    const unaccent = quoteIdentifier(extensions.rows.find(e => e.extname === 'unaccent')!.schema);
    const trgm = quoteIdentifier(extensions.rows.find(e => e.extname === 'pg_trgm')!.schema);
    await client.query(`CREATE OR REPLACE FUNCTION ${ns}.search_normalize(value text) RETURNS text
      LANGUAGE sql STABLE PARALLEL SAFE SET search_path = pg_catalog
      AS $fn$ SELECT lower(${unaccent}.unaccent('${(unaccent + '.unaccent').replaceAll("'", "''")}'::regdictionary, coalesce(value, ''))) $fn$`);
    for (const table of ['Dish', 'Chef', 'Ingredient']) {
      await client.query(`ALTER TABLE ${ns}.${quoteIdentifier(table)} ADD COLUMN IF NOT EXISTS "searchName" text NOT NULL DEFAULT ''`);
    }
    await client.query(`ALTER TABLE ${ns}."Dish" ADD COLUMN IF NOT EXISTS "searchVector" tsvector NOT NULL DEFAULT ''::tsvector`);
    await client.query(`CREATE OR REPLACE FUNCTION ${ns}.sync_search_name() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $fn$
      BEGIN NEW."searchName" := ${ns}.search_normalize(NEW.name); RETURN NEW; END $fn$`);
    await client.query(`CREATE OR REPLACE FUNCTION ${ns}.sync_dish_search() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $fn$
      BEGIN
        NEW."searchName" := ${ns}.search_normalize(NEW.name);
        NEW."searchVector" := setweight(to_tsvector('simple', NEW."searchName"), 'A') || setweight(to_tsvector('simple', ${ns}.search_normalize(NEW.description)), 'B');
        RETURN NEW;
      END $fn$`);
    for (const table of ['Dish', 'Chef', 'Ingredient']) {
      const t = `${ns}.${quoteIdentifier(table)}`;
      await client.query(`DROP TRIGGER IF EXISTS search_sync ON ${t}`);
      await client.query(`CREATE TRIGGER search_sync BEFORE INSERT OR UPDATE OF name${table === 'Dish' ? ', description' : ''} ON ${t} FOR EACH ROW EXECUTE FUNCTION ${ns}.${table === 'Dish' ? 'sync_dish_search' : 'sync_search_name'}()`);
      await client.query(`UPDATE ${t} SET "searchName" = ${ns}.search_normalize(name)${table === 'Dish' ? `, "searchVector" = setweight(to_tsvector('simple', ${ns}.search_normalize(name)), 'A') || setweight(to_tsvector('simple', ${ns}.search_normalize(description)), 'B')` : ''}`);
      await client.query(`CREATE INDEX IF NOT EXISTS ${quoteIdentifier(table + '_search_name_trgm')} ON ${t} USING gin ("searchName" ${trgm}.gin_trgm_ops)`);
      await client.query(`CREATE INDEX IF NOT EXISTS ${quoteIdentifier(table + '_search_name_order')} ON ${t} ("searchName", id)`);
    }
    await client.query(`CREATE INDEX IF NOT EXISTS "Dish_search_vector" ON ${ns}."Dish" USING gin ("searchVector")`);
    await client.query(`CREATE INDEX IF NOT EXISTS "Dish_category_price_id" ON ${ns}."Dish" (category, price, id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS "Dish_price_id" ON ${ns}."Dish" (price, id)`);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
