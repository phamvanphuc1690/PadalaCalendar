import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const deployment = JSON.parse(
  readFileSync(
    join(process.cwd(), "contracts/payment-proof/deployment.json"),
    "utf8",
  ),
);

describe("Mainnet deployment evidence", () => {
  it("records the live contract and functional flow", () => {
    expect(deployment.mainnet.contractId).toBe(
      "CDP7K67V3NABQ4OKSOQD7NICBUBEH472RD53DY2JQUI7TBJPX3MJXK5U",
    );
    expect(JSON.stringify(deployment)).toContain("dc2c1a014e9312e2efec4c38881ba77d1d40e667e5b32011c97c6bb0371627b0");
  });
});
