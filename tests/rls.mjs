import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

// Real PostgreSQL engine (PGlite) with a minimal Auth fixture; no Supabase service is contacted.
const db = new PGlite();
const founder = "00000000-0000-4000-8000-000000000001";
const alice = "00000000-0000-4000-8000-000000000002";
const bob = "00000000-0000-4000-8000-000000000003";
const projectA = "10000000-0000-4000-8000-000000000001";
const projectB = "10000000-0000-4000-8000-000000000002";

async function as(role, userId = "") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.exec(`set role ${role}`);
}
async function denied(sql, args = [], expectedCode = "42501") {
  await assert.rejects(db.query(sql, args), (error) => {
    assert.equal(error.code, expectedCode);
    return true;
  });
}

try {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    grant usage on schema auth to anon, authenticated;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create publication supabase_realtime;
  `);
  const migration = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");
  await db.exec(migration);
  await db.query("insert into auth.users(id,email) values ($1,'founder@example.test'),($2,'alice@example.test'),($3,'bob@example.test')", [founder, alice, bob]);
  await db.query("update public.profiles set role = 'admin' where id = $1", [founder]);

  await db.query("insert into public.projects(id,owner_id,name,type) values ($1,$2,'Seed site','web')", [projectA, alice]);
  await db.query("insert into public.api_keys(project_id,key_hash) values ($1,repeat('a',64))", [projectA]);

  await as("anon");
  assert.equal((await db.query("select * from public.platform_settings")).rows.length, 3);
  await denied("select * from public.projects");

  await as("authenticated", alice);

  await db.query("insert into public.pages(project_id,path,ui_tree) values ($1,'/', '{\"nodes\":[]}'::jsonb)", [projectA]);
  assert.equal((await db.query("select id,project_id from public.api_keys")).rows.length, 1);
  await denied("select key_hash from public.api_keys");
  await denied("insert into public.api_keys(project_id,key_hash) values ($1,repeat('b',64))", [projectA]);
  await denied("update public.profiles set role='admin' where id=$1", [alice]);
  await denied("select * from public.update_platform_settings('#112233','Unsafe',true)");
  assert.equal((await db.query("update public.platform_settings set value='true'::jsonb where key='enable_ai_build' returning id")).rows.length, 0);
  await denied("update public.projects set owner_id=$1 where id=$2", [bob, projectA]);
  await denied("insert into public.pages(project_id,path,ui_tree) values ($1,'/invalid','[]'::jsonb)", [projectA], "23514");

  await as("authenticated", bob);
  await db.query("insert into public.projects(id,name,type) values ($1,'Bob app','app')", [projectB]);
  assert.deepEqual((await db.query("select id from public.projects order by id")).rows.map((row) => row.id), [projectB]);
  assert.equal((await db.query("select * from public.pages where project_id=$1", [projectA])).rows.length, 0);
  assert.equal((await db.query("select id from public.api_keys")).rows.length, 0);
  await denied("insert into public.pages(project_id,path) values ($1,'/stolen')", [projectA]);
  assert.equal((await db.query("select * from public.profiles")).rows.length, 1);

  await as("authenticated", founder);
  const saved = await db.query("select key,value from public.update_platform_settings('#0A1B2C','Đã lưu',true) order by key");
  assert.equal(saved.rows.length, 3);
  assert.equal(saved.rows.find((row) => row.key === "hero_title").value, "Đã lưu");
  await denied("select * from public.update_platform_settings('red','/invalid',false)", [], "22023");
  assert.equal((await db.query("select value from public.platform_settings where key='hero_title'")).rows[0].value, "Đã lưu");

  await db.exec("reset role");
  await db.exec(migration);
  assert.equal((await db.query("select value from public.platform_settings where key='hero_title'")).rows[0].value, "Đã lưu");
  assert.equal((await db.query("select role from public.profiles where id=$1", [founder])).rows[0].role, "admin");
  console.log("PASS: RLS ownership, privilege escalation, admin save, invalid data, migration rerun");
} finally {
  await db.close();
}
