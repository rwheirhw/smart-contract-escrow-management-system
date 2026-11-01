import { network } from "hardhat";
import { writeFile } from "node:fs/promises";

const { viem } = await network.create();
const escrow = await viem.deployContract("FreelanceEscrow");
const deployment = {
  address: escrow.address,
  abi: escrow.abi,
  chainId: 31337,
};

await writeFile("frontend/contract.json", JSON.stringify(deployment, null, 2));
console.log(`FreelanceEscrow deployed to ${escrow.address}`);
