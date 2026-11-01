import { createPublicClient, createWalletClient, custom, http, formatEther, parseEther, getAddress } from "viem";
import { localhost } from "viem/chains";
import deployment from "./contract.json";

const statusNames = ["Funded", "Submitted", "Released", "Refunded"];
let account;
let walletClient;
let allRecords = [];
let currentFilter = "all";
const publicClient = createPublicClient({ chain: localhost, transport: http("http://127.0.0.1:8545") });
const $ = (id) => document.getElementById(id);
const short = (value) => `${value.slice(0, 6)}...${value.slice(-4)}`;
const contract = () => ({ address: deployment.address, abi: deployment.abi });

function notice(message, error = false) {
  $("notice").textContent = message;
  $("notice").hidden = false;
  $("notice").className = error ? "notice error" : "notice";
}

function renderMetrics(records) {
  const pending = records.filter(([, , , , , , status]) => Number(status) < 2);
  const completed = records.length - pending.length;
  const total = records.reduce((sum, [, , , , amount]) => sum + amount, 0n);
  const roles = records.filter(([, client, freelancer]) =>
    [client, freelancer].some((address) => address.toLowerCase() === account?.toLowerCase()),
  );
  const isClient = roles.some(([, client]) => client.toLowerCase() === account?.toLowerCase());
  const isFreelancer = roles.some(([, , freelancer]) => freelancer.toLowerCase() === account?.toLowerCase());
  $("metric-total").textContent = `${formatEther(total)} ETH`;
  $("metric-pending").textContent = pending.length;
  $("metric-completed").textContent = completed;
  $("metric-role").textContent = isClient && isFreelancer ? "Both" : isClient ? "Client" : isFreelancer ? "Freelancer" : "Observer";
  $("metric-role-detail").textContent = roles.length ? `${roles.length} contract${roles.length === 1 ? "" : "s"} connected to you` : "No assigned contracts yet";
}

function renderRecords() {
  const filtered = allRecords.filter((record) => {
    const status = Number(record[6]);
    return currentFilter === "all" || (currentFilter === "active" ? status < 2 : status >= 2);
  });
  if (!filtered.length) {
    $("escrows").innerHTML = `<div class="empty-state"><span class="empty-icon">◈</span><h3>${allRecords.length ? "No contracts in this view" : "No contracts yet"}</h3><p>${allRecords.length ? "Try a different filter to see more records." : "Create your first escrow to see it appear here."}</p>${allRecords.length ? "" : '<button class="secondary-button" id="empty-connect">Connect wallet</button>'}</div>`;
    return;
  }
  $("escrows").innerHTML = filtered.map((record) => {
    const [escrowId, client, freelancer, description, amount, deadline, status] = record;
    const numericStatus = Number(status);
    const label = statusNames[numericStatus];
    const actions = [];
    if (client.toLowerCase() === account.toLowerCase() && numericStatus === 1) actions.push(`<button data-action="release" data-id="${escrowId}">Approve & release</button>`);
    if (client.toLowerCase() === account.toLowerCase() && numericStatus === 0 && Date.now() / 1000 > Number(deadline)) actions.push(`<button data-action="refund" data-id="${escrowId}" class="secondary">Request refund</button>`);
    if (freelancer.toLowerCase() === account.toLowerCase() && numericStatus === 0 && Date.now() / 1000 <= Number(deadline)) actions.push(`<button data-action="submit" data-id="${escrowId}">Submit work</button>`);
    return `<article class="escrow-card"><div class="card-top"><strong>Escrow #${escrowId}</strong><span class="status ${label.toLowerCase()}">${label}</span></div><p class="card-description">${description}</p><div class="detail"><span>Payment</span><strong>${formatEther(amount)} ETH</strong></div><div class="detail"><span>Client</span><span>${short(client)}</span></div><div class="detail"><span>Freelancer</span><span>${short(freelancer)}</span></div><div class="detail"><span>Deadline</span><span>${new Date(Number(deadline) * 1000).toLocaleString()}</span></div>${actions.length ? `<div class="actions">${actions.join("")}</div>` : ""}</article>`;
  }).join("");
}

async function loadEscrows() {
  if (!account || !deployment.address) return;
  try {
    const count = await publicClient.readContract({ ...contract(), functionName: "getEscrowCount" });
    allRecords = await Promise.all(Array.from({ length: Number(count) }, (_, id) => publicClient.readContract({ ...contract(), functionName: "getEscrow", args: [BigInt(id)] })));
    renderMetrics(allRecords);
    renderRecords();
  } catch (error) {
    notice(`Could not read the local contract. Is Hardhat running? ${error.shortMessage || error.message}`, true);
  }
}

async function connect() {
  if (!window.ethereum) {
    notice("MetaMask was not found. Install it and connect to Hardhat Local (chain ID 31337).", true);
    return;
  }
  try {
    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    if (chainId !== "0x7a69") {
      notice("Switch MetaMask to Hardhat Local (chain ID 31337) before continuing.", true);
      return;
    }
    walletClient = createWalletClient({ chain: localhost, transport: custom(window.ethereum) });
    [account] = await walletClient.requestAddresses();
    $("account").textContent = short(account);
    $("account-menu").hidden = false;
    $("connect").hidden = true;
    $("network").textContent = "Hardhat Local · 31337";
    await loadEscrows();
  } catch (error) {
    notice(error.shortMessage || error.message || "Wallet connection failed.", true);
  }
}

async function transact(action, success) {
  try {
    notice("Transaction submitted. Waiting for confirmation...");
    const hash = await action();
    await publicClient.waitForTransactionReceipt({ hash });
    notice(success);
    await loadEscrows();
  } catch (error) {
    notice(error.shortMessage || error.message || "Transaction failed.", true);
  }
}

$("connect").addEventListener("click", connect);
$("empty-connect").addEventListener("click", connect);
$("refresh").addEventListener("click", loadEscrows);
$("create-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!walletClient || !account) {
    notice("Connect MetaMask before creating an escrow.", true);
    return;
  }
  try {
    const timestamp = Math.floor(new Date($("deadline").value).getTime() / 1000);
    await transact(() => walletClient.writeContract({ ...contract(), account, functionName: "createEscrow", args: [getAddress($("freelancer").value), $("description").value, BigInt(timestamp)], value: parseEther($("amount").value) }), "Escrow created and confirmed.");
    event.target.reset();
  } catch (error) {
    notice(error.shortMessage || error.message || "Check the form values.", true);
  }
});

document.querySelectorAll(".filter-tab").forEach((tab) => tab.addEventListener("click", () => {
  currentFilter = tab.dataset.filter;
  document.querySelectorAll(".filter-tab").forEach((item) => item.classList.toggle("active", item === tab));
  renderRecords();
}));

$("escrows").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button || !walletClient) return;
  const actions = { submit: "submitWork", release: "approveAndRelease", refund: "refundIfNotSubmitted" };
  await transact(() => walletClient.writeContract({ ...contract(), account, functionName: actions[button.dataset.action], args: [BigInt(button.dataset.id)] }), "Transaction confirmed.");
});

if (window.ethereum) {
  window.ethereum.on("accountsChanged", (accounts) => accounts.length ? connect() : window.location.reload());
  window.ethereum.on("chainChanged", () => window.location.reload());
}
