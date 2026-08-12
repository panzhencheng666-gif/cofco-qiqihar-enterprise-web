import assert from "node:assert/strict";
import test from "node:test";

import {
  addressesBoundToCloudTarget,
  cidrWithinBoundary,
  isApprovedOidcRedirect,
  liveVswitchMatches,
  renderGatewayTemplate,
} from "./preproduction-runtime.mjs";

test("accepts only CIDRs contained by the live vSwitch boundary", () => {
  assert.equal(cidrWithinBoundary("10.40.10.10/32", "10.40.10.0/24"), true);
  assert.equal(cidrWithinBoundary("10.40.11.0/24", "10.40.10.0/24"), false);
  assert.equal(cidrWithinBoundary("10.40.0.0/16", "10.40.10.0/24"), false);
});

test("rejects declared vSwitch CIDR or zone drift from live cloud state", () => {
  const actual = {
    id: "vsw-preproduction",
    vpcId: "vpc-preproduction",
    zoneId: "cn-beijing-a",
    cidr: "10.40.10.0/24",
  };

  assert.equal(liveVswitchMatches(actual, actual), true);
  assert.equal(
    liveVswitchMatches(actual, { ...actual, cidr: "10.40.0.0/16" }),
    false,
  );
  assert.equal(
    liveVswitchMatches(actual, { ...actual, zoneId: "cn-beijing-b" }),
    false,
  );
});

test("binds every resolved SSH address to the cloud-confirmed ECS target", () => {
  const cloudAddresses = ["10.40.10.10", "198.51.100.20"];
  assert.equal(
    addressesBoundToCloudTarget(["198.51.100.20"], cloudAddresses),
    true,
  );
  assert.equal(
    addressesBoundToCloudTarget(
      ["198.51.100.20", "198.51.100.21"],
      cloudAddresses,
    ),
    false,
  );
  assert.equal(addressesBoundToCloudTarget([], cloudAddresses), false);
});

test("accepts only the exact approved OIDC authorization request", () => {
  const approved = "https://idp.example.test/oauth2/authorize";
  const clientId = "cofco-preproduction";
  const redirectUri =
    "https://preprod.example.internal/login/oauth2/code/enterprise";
  const valid = `${approved}?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=openid%20profile&state=state-1&nonce=nonce-1`;
  assert.equal(
    isApprovedOidcRedirect(valid, approved, clientId, redirectUri),
    true,
  );

  for (const invalid of [
    valid.replace("idp.example.test", "wrong.example.test"),
    valid.replace("/oauth2/authorize", "/internal/authorize"),
    valid.replace(clientId, "wrong-client"),
    valid.replace(
      encodeURIComponent(redirectUri),
      encodeURIComponent("https://wrong.example.test/callback"),
    ),
    valid.replace("response_type=code&", ""),
    valid.replace("scope=openid%20profile&", "scope=profile&"),
    valid.replace("state=state-1&", ""),
    valid.replace("nonce=nonce-1", ""),
    `${valid}&error=access_denied`,
  ]) {
    assert.equal(
      isApprovedOidcRedirect(invalid, approved, clientId, redirectUri),
      false,
      invalid,
    );
  }
});

test("renders one approved TLS host without retaining the marker", () => {
  const rendered = renderGatewayTemplate(
    "server_name __COFCO_PREPROD_TLS_DOMAIN__;\nproxy_set_header Host __COFCO_PREPROD_TLS_DOMAIN__;",
    "preprod.example.internal",
  );
  assert.doesNotMatch(rendered, /__COFCO/u);
  assert.equal(
    (rendered.match(/preprod\.example\.internal/gu) ?? []).length,
    2,
  );
  assert.throws(
    () =>
      renderGatewayTemplate(
        "server_name __COFCO_PREPROD_TLS_DOMAIN__;",
        "bad host",
      ),
    /invalid approved TLS domain/u,
  );
});
