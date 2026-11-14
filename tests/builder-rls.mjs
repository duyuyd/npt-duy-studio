import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const db = new PGlite();
const alice = "00000000-0000-4000-8000-000000000002";
const bob = "00000000-0000-4000-8000-000000000003";
const founder = "00000000-0000-4000-8000-000000000001";
async function as(role, user = "") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
  await db.exec(`set role ${role}`);
}
try {
  await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
    grant usage on schema auth to anon, authenticated; create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create publication supabase_realtime;`);
  const schema = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");
  const migration = await readFile(new URL("../supabase/migrations/20261114_builder.sql", import.meta.url), "utf8");
  await db.exec(schema);
  await db.exec(migration);
  await db.query("insert into auth.users(id,email) values ($1,'founder@example.test'),($2,'alice@example.test'),($3,'bob@example.test')", [founder, alice, bob]);
  await db.query("update public.profiles set role='admin' where id=$1", [founder]);
  await as("authenticated", alice);
  const project = (await db.query("select public.create_studio_project('My project','web') as id")).rows[0].id;
  const page = (await db.query("select id,revision from public.pages where project_id=$1", [project])).rows[0];
  assert.equal(page.revision, 0);
  assert.equal((await db.query("select * from public.save_page_tree($1,0,$2::jsonb)", [page.id, '{"nodes":[]}'])).rows[0].new_revision, 1);
  await assert.rejects(db.query("select * from public.save_page_tree($1,1,$2::jsonb)", [page.id, '{}']), e => e.code === "22023");
  assert.equal((await db.query("select * from public.save_page_tree($1,0,$2::jsonb)", [page.id, '{"nodes":[]}'])).rows.length, 0, "stale writes must not overwrite newer data");
  const job = (await db.query("select public.create_studio_build($1,'android') as id", [project])).rows[0].id;
  await assert.rejects(db.query("update public.build_jobs set status='succeeded' where id=$1", [job]), e => e.code === "42501");
  await assert.rejects(db.query("select * from public.update_platform_settings_v2('#123456','A','B',false)"), e => e.code === "42501");
  await as("authenticated", bob);
  assert.equal((await db.query("select * from public.pages where id=$1", [page.id])).rows.length, 0);
  assert.equal((await db.query("select * from public.save_page_tree($1,1,$2::jsonb)", [page.id, '{"nodes":[]}'])).rows.length, 0);
  assert.equal((await db.query("select * from public.build_jobs where id=$1", [job])).rows.length, 0);
  await assert.rejects(db.query("select public.create_studio_build($1,'ios')", [project]), e => e.code === "42501");
  await as("authenticated", founder);
  const saved = (await db.query("select key,value from public.update_platform_settings_v2('#123456','Title','Subtitle',false)")).rows;
  assert.equal(saved.length, 4);
  assert.equal(saved.find(row => row.key === "hero_subtitle").value, "Subtitle");
  await as("authenticated", alice);
  await db.query("select public.fail_undispatched_build($1)", [job]);
  assert.equal((await db.query("select status from public.build_jobs where id=$1", [job])).rows[0].status, "failed");
  await db.exec("reset role");
  await db.exec(migration);
  assert.equal((await db.query("select value from public.platform_settings where key='hero_subtitle'")).rows[0].value, "Subtitle");
  console.log("PASS: project isolation, atomic save conflicts, build-job permissions, admin settings and migration rerun");
} finally { await db.close(); }
