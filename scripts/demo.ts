import { network } from "hardhat";
import { formatEther, parseEther } from "viem";
import { writeFile } from "node:fs/promises";

const { viem } = await network.create();
const [client, freelancer] = await viem.getWalletClients();
const escrow = await viem.deployContract("FreelanceEscrow");
await writeFile("frontend/contract.json", JSON.stringify({
  address: escrow.address,
  abi: escrow.abi,
  chainId: 31337,
}, null, 2));
const deadline = (await (await viem.getPublicClient()).getBlock()).timestamp + 86400n;

await escrow.write.createEscrow(
  [freelancer.account.address, "Design and ship a responsive portfolio website", deadline],
  { account: client.account, value: parseEther("1") },
);
await escrow.write.createEscrow(
  [freelancer.account.address, "Write onboarding documentation for the product", deadline],
  { account: client.account, value: parseEther("0.25") },
);

console.log("\nFreelance Escrow demo data created");
console.log(`Contract:   ${escrow.address}`);
console.log(`Client:     ${client.account.address}`);
console.log(`Freelancer: ${freelancer.account.address}`);
console.log(`Escrows:    2 (${formatEther(parseEther("1.25"))} ETH total)`);
console.log("\nImport the accounts printed by `npm run node` into MetaMask, connect as the client,");
console.log("then switch to the freelancer account to submit work.");
