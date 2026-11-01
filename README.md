# Freelance Escrow

A beginner-friendly blockchain case study for freelance payments. A client locks test ETH in a Solidity escrow, a named freelancer submits work, and the client releases payment after approval. If work is not submitted by the deadline, the client can reclaim the deposit.

## Stack

- Solidity 0.8.24 and OpenZeppelin `ReentrancyGuard`
- Hardhat 3 with the Viem toolbox
- Viem and vanilla HTML/CSS/JavaScript
- Vite for the frontend
- MetaMask and the local Hardhat network (chain ID `31337`)

## Setup

Requires Node.js 22.13.0 or newer.

```powershell
npm install
npm run compile
npm test
```

In separate terminals:

```powershell
npm run node
npm run deploy:local
npm run demo:local
npm run frontend
```

Open the Vite URL, import one of the accounts printed by `npm run node` into MetaMask (never use those development keys with real funds), and add a custom network with RPC `http://127.0.0.1:8545`, chain ID `31337`, and currency symbol `ETH`.

The deployment script writes the address and ABI to `frontend/contract.json`. Run it again whenever the local node is restarted.

### One-command example

After starting the local node, `npm run demo:local` deploys a fresh contract and creates two real on-chain demo escrows (1 ETH and 0.25 ETH). Then run `npm run frontend`, connect the first Hardhat account as the client, and switch to the second account as the freelancer to submit work. `demo:local` intentionally deploys its own contract and prints the account addresses; the private keys printed by Hardhat are for local testing only.

## Contract workflow

`createEscrow` accepts the freelancer, description, future deadline, and ETH deposit. `submitWork` is restricted to that freelancer and is only valid while the escrow is funded and before the deadline. The client can then call `approveAndRelease`. A funded escrow can instead be refunded by its client after the deadline. State is updated before external ETH transfers, and OpenZeppelin's reentrancy guard protects both payment paths.

The client approval mechanism is intentionally simplified: a client who refuses to approve does not trigger an automatic dispute resolution. A production system could add an independent arbitrator, evidence, and dispute deadlines.

## Tests and demonstration

The test suite covers creation, deposits, authorization, submission, release, duplicate release, early and late refunds, late submission, and zero-value validation. To demonstrate the app, create a 1 ETH test job as the client, switch to the assigned account to submit, switch back to approve, and observe the `Released` status. For a refund, create a short-deadline job, wait or advance local time, refresh, and refund. All records and transactions are public; never put private documents or confidential personal data on-chain.

## Structure

```text
contracts/FreelanceEscrow.sol  Contract and state transitions
test/FreelanceEscrow.ts       Viem-backed Hardhat tests
scripts/deploy.ts              Local deployment and frontend artifact export
frontend/                      Vite static application
hardhat.config.ts              Hardhat 3 configuration
```

This is a local educational demonstration, not production escrow or legal dispute resolution.
