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

test("accepts only the approved OIDC authorization origin and path", () => {
  const approved = "https://idp.example.test/oauth2/authorize";
  assert.equal(
    isApprovedOidcRedirect(
      "https://idp.example.test/oauth2/authorize?client_id=x&state=y",
      approved,
    ),
    true,
  );
  assert.equal(
    isApprovedOidcRedirect(
      "https://wrong.example.test/oauth2/authorize?state=y",
      approved,
    ),
    false,
  );
  assert.equal(
    isApprovedOidcRedirect(
      "https://idp.example.test/internal/authorize?state=y",
      approved,
    ),
    false,
  );
  assert.equal(
    isApprovedOidcRedirect(
      "https://127.0.0.1:8090/oauth2/authorize?state=y",
      approved,
    ),
    false,
  );
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
