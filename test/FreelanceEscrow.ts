import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseEther } from "viem";

describe("FreelanceEscrow", async function () {
  const { viem, networkHelpers } = await network.create();
  const publicClient = await viem.getPublicClient();
  const [client, freelancer, stranger] = await viem.getWalletClients();
  const escrow = await viem.deployContract("FreelanceEscrow");
  const amount = parseEther("1");
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

  async function create() {
    await escrow.write.createEscrow([freelancer.account.address, "Build a website", deadline], { value: amount, account: client.account });
  }

  it("creates an escrow and records the deposit", async function () {
    await create();
    const record = await escrow.read.getEscrow([0n]);
    assert.equal(record.amount, amount);
    assert.equal(record.client.toLowerCase(), client.account.address.toLowerCase());
    assert.equal(record.status, 0);
  });

  it("allows submission and release, paying the freelancer", async function () {
    await escrow.write.submitWork([0n], { account: freelancer.account });
    await escrow.write.approveAndRelease([0n], { account: client.account });
    assert.equal(await publicClient.getBalance({ address: escrow.address }), 0n);
    assert.equal((await escrow.read.getEscrow([0n])).status, 2);
  });

  it("rejects unauthorised actions and duplicate release", async function () {
    await assert.rejects(() =>
      escrow.write.submitWork([0n], { account: stranger.account }),
    );
    await assert.rejects(() =>
      escrow.write.approveAndRelease([0n], { account: client.account }),
    );
  });

  it("rejects early refunds, then refunds after the deadline", async function () {
    const shortDeadline = (await publicClient.getBlock()).timestamp + 10n;
    await escrow.write.createEscrow([freelancer.account.address, "Short job", shortDeadline], { value: amount, account: client.account });
    await assert.rejects(() => escrow.write.refundIfNotSubmitted([1n], { account: client.account }));
    await networkHelpers.time.increase(12);
    await escrow.write.refundIfNotSubmitted([1n], { account: client.account });
    assert.equal((await escrow.read.getEscrow([1n])).status, 3);
  });

  it("rejects zero-value escrows and late submissions", async function () {
    await assert.rejects(() => escrow.write.createEscrow([freelancer.account.address, "Invalid", deadline], { value: 0n, account: client.account }));
    await assert.rejects(() => escrow.write.submitWork([1n], { account: freelancer.account }));
  });
});
