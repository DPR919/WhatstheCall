import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const owner = "00000000-0000-4000-8000-000000000001";
let sequence = 0;
async function value(sql, params = []) { return Object.values((await db.query(sql, params)).rows[0])[0]; }
async function invite() {
  const code = `TEST-${++sequence}`;
  await db.query("insert into public.invite_codes(code,created_by_user_id) values ($1,$2)", [code, owner]);
  return code;
}
async function reserve(code, email, name) {
  return value("select public.reserve_member_registration($1,$2,$3)", [code, email, name]);
}

before(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table auth.users(id uuid primary key default gen_random_uuid(), email text unique, created_at timestamptz default clock_timestamp(), invited_at timestamptz, email_confirmed_at timestamptz);
    create table public.profiles(id uuid primary key references auth.users(id), email text not null, display_name text not null,
      invited_by_user_id uuid, invite_code_used_id uuid, referral_limit int default 5,
      referral_generated_count int default 0, referral_redeemed_count int default 0, status text default 'active', role text default 'user');
    create table public.invite_codes(id uuid primary key default gen_random_uuid(), code text unique not null, created_by_user_id uuid,
      max_uses int default 1, use_count int default 0, is_active boolean default true, expires_at timestamptz);
    create table public.invite_redemptions(id uuid primary key default gen_random_uuid(), invite_code_id uuid, redeemed_by_user_id uuid);
    create table public.clips(id uuid primary key default gen_random_uuid(), uploaded_by_user_id uuid);
    create table public.clip_responses(id uuid primary key default gen_random_uuid(), user_id uuid);
    insert into auth.users(id,email,email_confirmed_at) values ('${owner}','owner@example.test',now());
    insert into public.profiles(id,email,display_name,role) values ('${owner}','owner@example.test','Existing Name','admin');
  `);
  for (const file of ["20260928020516_secure_public_tables_20260928.sql", "20260929054949_invitation_signup.sql", "20261022030026_security_hardening.sql"]) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
  }
});
after(() => db.close());

test("existing display names reject capitalization and whitespace collisions before email", async () => {
  const code = await invite();
  await assert.rejects(reserve(code, "new@example.test", "  EXISTING NAME  "), /unavailable/);
  assert.equal(await value("select use_count from public.invite_codes where code=$1", [code]), 0);
});

test("retries and competing requests authorize only one email per invitation", async () => {
  const code = await invite();
  const first = await reserve(code, "one@example.test", "One Name");
  const retry = await reserve(code, "ONE@example.test", "one name");
  assert.equal(first.send_email, true);
  assert.equal(retry.id, first.id);
  assert.equal(retry.send_email, false);
  await assert.rejects(reserve(code, "two@example.test", "Two Name"), /unavailable/);
  const otherCode = await invite();
  await assert.rejects(reserve(otherCode, "three@example.test", "ONE NAME"), /unavailable/);
  assert.equal(await value("select use_count from public.invite_codes where code=$1", [otherCode]), 0);
});

test("delivery failure never frees a code or permits another email", async () => {
  const code = await invite();
  const first = await reserve(code, "failed@example.test", "Failed Delivery");
  await db.query("select public.mark_registration_delivery_failed($1)", [first.id]);
  const retry = await reserve(code, "failed@example.test", "Failed Delivery");
  assert.equal(retry.send_email, false);
  assert.equal(retry.state, "delivery_failed");
  await db.query("select public.release_member_invite((select id from public.invite_codes where code=$1))", [code]);
  assert.equal(await value("select use_count from public.invite_codes where code=$1", [code]), 1);
});

test("process failure after Auth creation is recoverable and completion is idempotent", async () => {
  const code = await invite();
  const registration = await reserve(code, "recover@example.test", "Recover Name");
  assert.equal(await value("select public.finish_member_registration($1)", [registration.id]), false);
  await db.query("insert into auth.users(email,invited_at,email_confirmed_at) values ('recover@example.test',clock_timestamp(),clock_timestamp())");
  const userId = await value("select id from auth.users where email='recover@example.test'");
  assert.equal(await value("select public.finish_own_member_registration($1)", [userId]), true);
  assert.equal(await value("select public.finish_member_registration($1)", [registration.id]), true);
  assert.equal(await value("select count(*)::int from public.profiles where id=$1", [userId]), 1);
  assert.equal(await value("select count(*)::int from public.invite_redemptions where redeemed_by_user_id=$1", [userId]), 1);
  assert.equal(await value("select referral_redeemed_count from public.profiles where id=$1", [owner]), 1);
});

test("ordinary signup cannot be reconciled as an administrator invitation", async () => {
  const code = await invite();
  const registration = await reserve(code, "outsider@example.test", "Outsider Name");
  await db.query("insert into auth.users(email,email_confirmed_at) values ('outsider@example.test',clock_timestamp())");
  assert.equal(await value("select public.finish_member_registration($1)", [registration.id]), false);
});

test("existing Auth accounts and expired or suspended invitations cannot reserve codes", async () => {
  const code = await invite();
  await assert.rejects(reserve(code, "owner@example.test", "Different Name"), /unavailable/);
  assert.equal(await value("select use_count from public.invite_codes where code=$1", [code]), 0);
  await db.query("update public.invite_codes set expires_at=now()-interval '1 day' where code=$1", [code]);
  await assert.rejects(reserve(code, "expired@example.test", "Expired Name"), /unavailable/);
  const suspended = await invite();
  await db.query("update public.profiles set status='suspended' where id=$1", [owner]);
  try { await assert.rejects(reserve(suspended, "suspended@example.test", "Suspended Name"), /unavailable/); }
  finally { await db.query("update public.profiles set status='active' where id=$1", [owner]); }
});

test("database name enforcement also protects legacy server insertion paths", async () => {
  await db.query("insert into auth.users(email) values ('legacy@example.test')");
  await assert.rejects(db.query("insert into public.profiles(id,email,display_name) select id,email,'existing name' from auth.users where email='legacy@example.test'"), /unavailable/);
});

test("shared database limiter enforces quota and separates action keys", async () => {
  const key = "a".repeat(64);
  assert.equal(await value("select public.consume_request_limit($1,2,900)", [key]), true);
  assert.equal(await value("select public.consume_request_limit($1,2,900)", [key]), true);
  assert.equal(await value("select public.consume_request_limit($1,2,900)", [key]), false);
  assert.equal(await value("select public.consume_request_limit($1,2,900)", ["b".repeat(64)]), true);
});

test("anonymous and member roles cannot call privileged registration functions", async () => {
  for (const role of ["anon", "authenticated"]) {
    for (const signature of ["reserve_member_registration(text,text,text)", "finish_member_registration(uuid)", "finish_own_member_registration(uuid)", "consume_request_limit(text,integer,integer)"]) {
      assert.equal(await value("select has_function_privilege($1,$2,'EXECUTE')", [role, `public.${signature}`]), false);
    }
    assert.equal(await value("select has_schema_privilege($1,'app_private','USAGE')", [role]), false);
  }
  await db.exec(await readFile(new URL("../supabase/tests/public_table_access.sql", import.meta.url), "utf8"));
});

test("RLS prevents members reading another member's profile", async () => {
  const id = await value("select id from auth.users where email='recover@example.test'");
  await db.exec(`grant usage on schema auth to authenticated; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false)`);
  try {
    assert.equal(await value("select count(*)::int from public.profiles"), 1);
    assert.equal(await value("select count(*)::int from public.profiles where id=$1", [owner]), 0);
    await assert.rejects(db.query("update public.profiles set role='admin'"), /permission denied/);
  } finally { await db.exec("reset role"); }
});
