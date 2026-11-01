// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract FreelanceEscrow is ReentrancyGuard {
    enum Status {
        Funded,
        Submitted,
        Released,
        Refunded
    }

    struct Escrow {
        uint256 id;
        address client;
        address freelancer;
        string description;
        uint256 amount;
        uint256 deadline;
        Status status;
    }

    uint256 private _nextEscrowId;
    mapping(uint256 => Escrow) private _escrows;

    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed client,
        address indexed freelancer,
        uint256 amount,
        uint256 deadline
    );
    event WorkSubmitted(uint256 indexed escrowId);
    event PaymentReleased(uint256 indexed escrowId, address indexed freelancer, uint256 amount);
    event RefundIssued(uint256 indexed escrowId, address indexed client, uint256 amount);

    function createEscrow(
        address freelancer,
        string calldata description,
        uint256 deadline
    ) external payable returns (uint256 escrowId) {
        require(msg.value > 0, "Payment must be greater than zero");
        require(freelancer != address(0), "Invalid freelancer");
        require(freelancer != msg.sender, "Client and freelancer must differ");
        require(deadline > block.timestamp, "Deadline must be in the future");

        escrowId = _nextEscrowId++;
        _escrows[escrowId] = Escrow({
            id: escrowId,
            client: msg.sender,
            freelancer: freelancer,
            description: description,
            amount: msg.value,
            deadline: deadline,
            status: Status.Funded
        });

        emit EscrowCreated(escrowId, msg.sender, freelancer, msg.value, deadline);
    }

    function submitWork(uint256 escrowId) external {
        Escrow storage escrow = _escrow(escrowId);
        require(msg.sender == escrow.freelancer, "Only the freelancer can submit");
        require(escrow.status == Status.Funded, "Escrow is not funded");
        require(block.timestamp <= escrow.deadline, "Deadline has passed");

        escrow.status = Status.Submitted;
        emit WorkSubmitted(escrowId);
    }

    function approveAndRelease(uint256 escrowId) external nonReentrant {
        Escrow storage escrow = _escrow(escrowId);
        require(msg.sender == escrow.client, "Only the client can approve");
        require(escrow.status == Status.Submitted, "Work has not been submitted");

        uint256 amount = escrow.amount;
        escrow.status = Status.Released;
        (bool sent, ) = payable(escrow.freelancer).call{value: amount}("");
        require(sent, "Payment transfer failed");
        emit PaymentReleased(escrowId, escrow.freelancer, amount);
    }

    function refundIfNotSubmitted(uint256 escrowId) external nonReentrant {
        Escrow storage escrow = _escrow(escrowId);
        require(msg.sender == escrow.client, "Only the client can refund");
        require(escrow.status == Status.Funded, "Escrow is not refundable");
        require(block.timestamp > escrow.deadline, "Deadline has not passed");

        uint256 amount = escrow.amount;
        escrow.status = Status.Refunded;
        (bool sent, ) = payable(escrow.client).call{value: amount}("");
        require(sent, "Refund transfer failed");
        emit RefundIssued(escrowId, escrow.client, amount);
    }

    function getEscrow(uint256 escrowId) external view returns (Escrow memory) {
        return _escrow(escrowId);
    }

    function getEscrowCount() external view returns (uint256) {
        return _nextEscrowId;
    }

    function _escrow(uint256 escrowId) private view returns (Escrow storage escrow) {
        escrow = _escrows[escrowId];
        require(escrow.client != address(0), "Escrow does not exist");
    }
}
