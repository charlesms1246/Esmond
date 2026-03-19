// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IERC20.sol";

/**
 * @title ConditionalEscrow
 * @notice Milestone-based conditional payment escrow.
 * @dev Funds are locked by payer and released to payee when enough approvers sign off.
 *      Payer can reclaim funds after disputeDeadline if not released.
 */
contract ConditionalEscrow is ReentrancyGuard {
    // ─────────────────────────────── Storage ──────────────────────────────────

    struct Milestone {
        address   payer;
        address   payee;
        address   token;               // Asset Hub ERC-20 precompile address
        uint256   amount;
        address[] approvers;
        uint256   approvalsRequired;   // Min approvals to release (1 or more)
        uint256   approvalCount;
        mapping(address => bool) hasApproved;   // prevent double-approval
        uint256   disputeDeadline;     // Unix timestamp — payer can reclaim after this
        bool      released;
        bool      reclaimed;
    }

    mapping(uint256 => Milestone) public milestones;
    uint256 public milestoneCount;

    // ─────────────────────────────── Events ───────────────────────────────────

    event MilestoneCreated(uint256 indexed id, address indexed payer, address indexed payee, uint256 amount);
    event MilestoneApproved(uint256 indexed id, address indexed approver, uint256 approvalCount);
    event MilestoneReleased(uint256 indexed id, address indexed payee, uint256 amount);
    event MilestoneReclaimed(uint256 indexed id, address indexed payer, uint256 amount);

    // ─────────────────────────────── Modifiers ────────────────────────────────

    modifier onlyApprover(uint256 id) {
        bool found = false;
        address[] storage approvers = milestones[id].approvers;
        for (uint256 i = 0; i < approvers.length; i++) {
            if (approvers[i] == msg.sender) { found = true; break; }
        }
        require(found, "Not an approver");
        _;
    }

    // ─────────────────────────────── Functions ────────────────────────────────

    /**
     * @notice Create a new milestone and lock funds
     * @param payee              Recipient of funds on release
     * @param token              Asset Hub ERC-20 precompile address
     * @param amount             Amount to lock in token base units
     * @param approvers          List of addresses that can approve release
     * @param approvalsRequired  Minimum approvals needed for release
     * @param disputeDeadline    Unix timestamp after which payer can reclaim
     * @return id                The new milestone ID
     */
    function createMilestone(
        address payee,
        address token,
        uint256 amount,
        address[] calldata approvers,
        uint256 approvalsRequired,
        uint256 disputeDeadline
    ) external returns (uint256 id) {
        require(payee != address(0), "Invalid payee");
        require(token != address(0), "Invalid token");
        require(amount > 0, "Amount must be > 0");
        require(approvers.length > 0, "Need at least one approver");
        require(approvalsRequired > 0 && approvalsRequired <= approvers.length, "Invalid approvalsRequired");
        require(disputeDeadline > block.timestamp, "Deadline must be in future");
        require(IERC20(token).allowance(msg.sender, address(this)) >= amount, "Insufficient allowance");

        IERC20(token).transferFrom(msg.sender, address(this), amount);

        id = milestoneCount++;
        Milestone storage m = milestones[id];
        m.payer              = msg.sender;
        m.payee              = payee;
        m.token              = token;
        m.amount             = amount;
        m.approvers          = approvers;
        m.approvalsRequired  = approvalsRequired;
        m.approvalCount      = 0;
        m.disputeDeadline    = disputeDeadline;
        m.released           = false;
        m.reclaimed          = false;

        emit MilestoneCreated(id, msg.sender, payee, amount);
    }

    /**
     * @notice Approve a milestone release
     * @dev When approvalCount reaches approvalsRequired, funds are released to payee.
     */
    function approveMilestone(uint256 id) external nonReentrant onlyApprover(id) {
        Milestone storage m = milestones[id];
        require(!m.released && !m.reclaimed, "Already settled");
        require(!m.hasApproved[msg.sender], "Already approved");

        m.hasApproved[msg.sender] = true;
        m.approvalCount++;

        emit MilestoneApproved(id, msg.sender, m.approvalCount);

        if (m.approvalCount >= m.approvalsRequired) {
            m.released = true;
            IERC20(m.token).transfer(m.payee, m.amount);
            emit MilestoneReleased(id, m.payee, m.amount);
        }
    }

    /**
     * @notice Reclaim funds after dispute deadline passes without release
     */
    function reclaimExpired(uint256 id) external nonReentrant {
        Milestone storage m = milestones[id];
        require(msg.sender == m.payer, "Not payer");
        require(block.timestamp > m.disputeDeadline, "Deadline not passed");
        require(!m.released && !m.reclaimed, "Already settled");

        m.reclaimed = true;
        IERC20(m.token).transfer(m.payer, m.amount);
        emit MilestoneReclaimed(id, m.payer, m.amount);
    }

    // ─────────────────────────────── View Functions ───────────────────────────

    /**
     * @notice Get milestone fields (excludes hasApproved mapping)
     */
    function getMilestone(uint256 id) external view returns (
        address payer,
        address payee,
        address token,
        uint256 amount,
        address[] memory approvers,
        uint256 approvalsRequired,
        uint256 approvalCount,
        uint256 disputeDeadline,
        bool released,
        bool reclaimed
    ) {
        Milestone storage m = milestones[id];
        return (
            m.payer,
            m.payee,
            m.token,
            m.amount,
            m.approvers,
            m.approvalsRequired,
            m.approvalCount,
            m.disputeDeadline,
            m.released,
            m.reclaimed
        );
    }

    /**
     * @notice Check whether a specific approver has already approved a milestone
     */
    function getApprovalStatus(uint256 id, address approver) external view returns (bool) {
        return milestones[id].hasApproved[approver];
    }
}
