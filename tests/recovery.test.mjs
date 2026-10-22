import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { signRecoveryGrant, readRecoveryGrant, matchesRecoverySession, RECOVERY_SECONDS } from "../lib/security/recovery-grant.ts";
import { completeRecovery } from "../lib/security/recovery-flow.ts";

const userId = "00000000-0000-4000-8000-000000000001";
const sessionId = "00000000-0000-4000-8000-000000000002";
const now = Date.now();
const grant = { userId, sessionId, phase: "password", expires: now + RECOVERY_SECONDS * 1000 };
const body = { password: "new-test-password-only", confirmPassword: "new-test-password-only" };

test("recovery authorization rejects tampering, expiry, wrong key and session substitution", () => {
  const cookie = signRecoveryGrant("secret", grant);
  assert.deepEqual(readRecoveryGrant("secret", cookie, now), grant);
  assert.equal(readRecoveryGrant("other", cookie, now), null);
  assert.equal(readRecoveryGrant("secret", cookie + "x", now), null);
  assert.equal(readRecoveryGrant("secret", cookie, grant.expires), null);
  assert.equal(readRecoveryGrant("secret", undefined, now), null);
  assert.equal(readRecoveryGrant("secret", signRecoveryGrant("secret", { ...grant, phase: "other" }), now), null);
  assert.equal(matchesRecoverySession(grant, userId, sessionId), true);
  assert.equal(matchesRecoverySession(grant, sessionId, sessionId), false);
  assert.equal(matchesRecoverySession(grant, userId, userId), false);
});

function workflow({ updateError = null, revokeError = null } = {}) {
  const calls = [];
  return { calls, dependencies: {
    updatePassword: async () => { calls.push("update"); return { error: updateError }; },
    markChanged: async () => { calls.push("mark"); },
    revokeSessions: async () => { calls.push("revoke"); return { error: revokeError }; },
    clearSession: async () => { calls.push("clear"); },
  } };
}
test("recovery cannot update passwords or revoke sessions before required MFA", async () => {
  const { calls, dependencies } = workflow();
  assert.equal((await completeRecovery(grant, true, body, dependencies)).status, 403);
  assert.deepEqual(calls, []);
});
test("invalid passwords leave the recovery authorization usable for correction", async () => {
  for (const invalid of [undefined, {}, { ...body, password: "short" }, { ...body, confirmPassword: "different-password" },
    { password: "x".repeat(129), confirmPassword: "x".repeat(129) }]) {
    const { calls, dependencies } = workflow();
    assert.equal((await completeRecovery(grant, false, invalid, dependencies)).status, 400);
    assert.deepEqual(calls, []);
  }
  const { calls, dependencies } = workflow({ updateError: new Error("provider detail") });
  const result = await completeRecovery(grant, false, body, dependencies);
  assert.equal(result.status, 400); assert.doesNotMatch(JSON.stringify(result), /provider detail/);
  assert.deepEqual(calls, ["update"]);
});
test("successful recovery changes the password before revoking sessions and clearing cookies", async () => {
  const { calls, dependencies } = workflow();
  assert.equal((await completeRecovery(grant, false, body, dependencies)).status, 200);
  assert.deepEqual(calls, ["update", "mark", "revoke", "clear"]);
});
test("revocation failure is visible and retry completes signout without a second password change", async () => {
  const failed = workflow({ revokeError: new Error("offline") });
  const result = await completeRecovery(grant, false, body, failed.dependencies);
  assert.equal(result.status, 503); assert.equal(result.body.passwordChanged, true);
  assert.deepEqual(failed.calls, ["update", "mark", "revoke"]);
  const retry = workflow();
  assert.equal((await completeRecovery({ ...grant, phase: "signout" }, false, {}, retry.dependencies)).status, 200);
  assert.deepEqual(retry.calls, ["revoke", "clear"]);
  const interrupted = workflow();
  interrupted.dependencies.revokeSessions = async () => { throw new Error("connection interrupted"); };
  const networkFailure = await completeRecovery(grant, false, body, interrupted.dependencies);
  assert.equal(networkFailure.status, 503);
  assert.equal(networkFailure.body.passwordChanged, true);
});

const db = new PGlite();
async function value(sql, params = []) { return Object.values((await db.query(sql, params)).rows[0])[0]; }
before(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema app_private; revoke all on schema app_private from public;
    create schema auth;
    create table auth.sessions(id uuid primary key, user_id uuid not null, not_after timestamptz);
    create table public.profiles(id uuid primary key, status text);
    create table app_private.request_limits(key_hash text, bucket bigint, window_seconds int, attempts int, expires_at timestamptz,
      primary key(key_hash,bucket,window_seconds));
    insert into public.profiles values ('${userId}','active');
    insert into auth.sessions values ('${sessionId}','${userId}',null);
  `);
  const security = await readFile(new URL("../supabase/migrations/20261022030026_security_hardening.sql", import.meta.url), "utf8");
  const consume = security.slice(security.indexOf("create function public.consume_request_limit"), security.indexOf("create function public.reserve_member_registration"));
  await db.exec(consume);
  await db.exec(await readFile(new URL("../supabase/migrations/20261022050421_password_recovery.sql", import.meta.url), "utf8"));
});
after(() => db.close());

test("recovery email claims have an atomic cooldown and hourly quota with only hashed identities", async () => {
  const hash = "a".repeat(64);
  const claim = () => value("select public.claim_password_recovery_email($1)", [hash]);
  assert.equal(await claim(), true);
  assert.equal(await claim(), false);
  assert.equal(await value("select attempts from app_private.request_limits where key_hash=$1", [hash]), 1);
  for (let i = 0; i < 2; i++) {
    await db.query("update app_private.recovery_email_cooldowns set next_allowed_at=now()-interval '1 second' where key_hash=$1", [hash]);
    assert.equal(await claim(), true);
  }
  await db.query("update app_private.recovery_email_cooldowns set next_allowed_at=now()-interval '1 second' where key_hash=$1", [hash]);
  assert.equal(await claim(), false);
  assert.equal(await value("select public.claim_password_recovery_email('raw@example.com')"), false);
});
test("recovery authorization rejects revoked, expired, mismatched and suspended sessions", async () => {
  const active = () => value("select public.password_recovery_session_is_active($1,$2)", [userId, sessionId]);
  assert.equal(await active(), true);
  assert.equal(await value("select public.password_recovery_session_is_active($1,$2)", [sessionId, sessionId]), false);
  await db.exec("update public.profiles set status='suspended'");
  assert.equal(await active(), false);
  await db.exec("update public.profiles set status='active'; update auth.sessions set not_after=now()-interval '1 second'");
  assert.equal(await active(), false);
  await db.exec("delete from auth.sessions");
  assert.equal(await active(), false);
});
test("anonymous and member roles cannot inspect sessions, claim email quotas or access coordination data", async () => {
  for (const role of ["anon", "authenticated"]) {
    assert.equal(await value("select has_function_privilege($1,'public.claim_password_recovery_email(text)','execute')", [role]), false);
    assert.equal(await value("select has_function_privilege($1,'public.password_recovery_session_is_active(uuid,uuid)','execute')", [role]), false);
    assert.equal(await value("select has_table_privilege($1,'app_private.recovery_email_cooldowns','select')", [role]), false);
  }
  assert.equal(await value("select relrowsecurity from pg_class where oid='app_private.recovery_email_cooldowns'::regclass"), true);
});
