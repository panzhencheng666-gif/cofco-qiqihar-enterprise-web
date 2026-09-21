import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const publicUrl = new URL("../public/", import.meta.url);

test("phone login exposes phone flow without an email verification link", async () => {
  const phone = await readFile(new URL("phone.html", publicUrl), "utf8");

  assert.match(phone, /短信验证码/);
  assert.doesNotMatch(phone, /<a href="\/email\.html">邮箱验证码<\/a>/);
});

test("retained email page still contains its public email API flow", async () => {
  const email = await readFile(new URL("email.html", publicUrl), "utf8");

  assert.match(email, /\/api\/v1\/identity\/email\/bootstrap/);
  assert.match(email, /api\("challenge", \{ email, purpose: "LOGIN" \}\)/);
});
