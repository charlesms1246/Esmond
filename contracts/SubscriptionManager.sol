// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IERC20.sol";

/**
 * @title SubscriptionManager
 * @notice Recurring subscription billing with subscriber-controlled caps.
 * @dev Providers create plans; subscribers opt in with an approvedCap ceiling.
 *      Anyone can trigger a charge when a subscription is due.
 */
contract SubscriptionManager is ReentrancyGuard {
    // ─────────────────────────────── Storage ──────────────────────────────────

    struct Plan {
        address provider;
        address token;           // Asset Hub ERC-20 precompile address
        uint256 chargeAmount;
        uint256 interval;        // Seconds between charges
        uint256 maxCharges;      // 0 = unlimited
        uint256 chargeCount;     // Internal counter
        uint256 expiry;          // 0 = never expires, else Unix timestamp
        bool    active;
    }

    struct Subscription {
        address subscriber;
        uint256 planId;
        uint256 approvedCap;     // Total the subscriber is willing to spend (hard ceiling)
        uint256 totalCharged;    // Running total charged so far
        uint256 nextChargeDue;   // Unix timestamp for next eligible charge
        bool    active;
    }

    mapping(uint256 => Plan) public plans;
    uint256 public planCount;

    mapping(uint256 => Subscription) public subscriptions;
    uint256 public subscriptionCount;

    // ─────────────────────────────── Events ───────────────────────────────────

    event PlanCreated(uint256 indexed planId, address indexed provider, address token, uint256 chargeAmount, uint256 interval);
    event Subscribed(uint256 indexed subscriptionId, address indexed subscriber, uint256 indexed planId, uint256 approvedCap);
    event Charged(uint256 indexed subscriptionId, address indexed provider, uint256 amount, uint256 nextChargeDue);
    event Revoked(uint256 indexed subscriptionId, address indexed subscriber);
    event PlanDeactivated(uint256 indexed planId);

    // ─────────────────────────────── Functions ────────────────────────────────

    /**
     * @notice Create a new subscription plan
     * @param token        Asset Hub ERC-20 precompile address
     * @param chargeAmount Amount charged per interval in token base units
     * @param interval     Seconds between charges
     * @param maxCharges   Maximum number of charges (0 = unlimited)
     * @param expiry       Unix timestamp when plan expires (0 = never)
     * @return planId      The new plan ID
     */
    function createPlan(
        address token,
        uint256 chargeAmount,
        uint256 interval,
        uint256 maxCharges,
        uint256 expiry
    ) external returns (uint256 planId) {
        require(token != address(0), "Invalid token");
        require(chargeAmount > 0, "chargeAmount must be > 0");
        require(interval > 0, "interval must be > 0");

        planId = planCount++;
        plans[planId] = Plan({
            provider:     msg.sender,
            token:        token,
            chargeAmount: chargeAmount,
            interval:     interval,
            maxCharges:   maxCharges,
            chargeCount:  0,
            expiry:       expiry,
            active:       true
        });

        emit PlanCreated(planId, msg.sender, token, chargeAmount, interval);
    }

    /**
     * @notice Subscribe to a plan with a total spend cap
     * @param planId      The plan to subscribe to
     * @param approvedCap Maximum total amount subscriber will allow to be charged
     * @return subscriptionId The new subscription ID
     */
    function subscribe(uint256 planId, uint256 approvedCap) external returns (uint256 subscriptionId) {
        Plan storage plan = plans[planId];
        require(plan.active, "Plan not active");
        require(approvedCap >= plan.chargeAmount, "approvedCap < chargeAmount");
        require(
            IERC20(plan.token).allowance(msg.sender, address(this)) >= plan.chargeAmount,
            "Insufficient allowance"
        );

        subscriptionId = subscriptionCount++;
        subscriptions[subscriptionId] = Subscription({
            subscriber:    msg.sender,
            planId:        planId,
            approvedCap:   approvedCap,
            totalCharged:  0,
            nextChargeDue: block.timestamp,
            active:        true
        });

        emit Subscribed(subscriptionId, msg.sender, planId, approvedCap);
    }

    /**
     * @notice Charge a subscription (callable by anyone when due)
     * @dev Transfers chargeAmount from subscriber to provider.
     *      Validates all conditions: active, due, within cap, within plan limits.
     */
    function charge(uint256 subscriptionId) external nonReentrant {
        Subscription storage sub = subscriptions[subscriptionId];
        Plan storage plan = plans[sub.planId];

        require(sub.active, "Subscription not active");
        require(plan.active, "Plan not active");
        require(block.timestamp >= sub.nextChargeDue, "Not due yet");
        require(plan.expiry == 0 || block.timestamp <= plan.expiry, "Plan expired");
        require(plan.maxCharges == 0 || plan.chargeCount < plan.maxCharges, "Max charges reached");
        require(sub.totalCharged + plan.chargeAmount <= sub.approvedCap, "Cap exceeded");
        require(
            IERC20(plan.token).allowance(sub.subscriber, address(this)) >= plan.chargeAmount,
            "Insufficient allowance"
        );

        IERC20(plan.token).transferFrom(sub.subscriber, plan.provider, plan.chargeAmount);

        sub.totalCharged   += plan.chargeAmount;
        sub.nextChargeDue  += plan.interval;
        plan.chargeCount++;

        emit Charged(subscriptionId, plan.provider, plan.chargeAmount, sub.nextChargeDue);
    }

    /**
     * @notice Revoke a subscription (subscriber only)
     */
    function revoke(uint256 subscriptionId) external {
        Subscription storage sub = subscriptions[subscriptionId];
        require(sub.subscriber == msg.sender, "Not subscriber");
        require(sub.active, "Already inactive");

        sub.active = false;
        emit Revoked(subscriptionId, msg.sender);
    }

    /**
     * @notice Deactivate a plan (provider only)
     */
    function deactivatePlan(uint256 planId) external {
        require(plans[planId].provider == msg.sender, "Not provider");
        plans[planId].active = false;
        emit PlanDeactivated(planId);
    }
}
