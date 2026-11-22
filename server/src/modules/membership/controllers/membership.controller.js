import {
  findUsersExpiringSoon,
  processExpiringMemberships,
  getMembershipPlans,
  getMemberMembershipStatus,
  renewMembership,
  upgradeMembership,
  purchaseMembership,
} from "../services/membership.service.js";

/**
 * GET /api/membership/plans
 * Returns list of official membership tiers, pricing, and perks.
 */
export const getMembershipPlansHandler = async (req, res) => {
  try {
    const plans = getMembershipPlans();
    return res.status(200).json({
      success: true,
      plans,
    });
  } catch (error) {
    console.error("getMembershipPlansHandler error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve membership plans",
      error: error.message,
    });
  }
};

/**
 * GET /api/membership/status
 * Returns current authenticated member's membership status, days remaining, active perks.
 */
export const getMembershipStatusHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const data = await getMemberMembershipStatus(userId);
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("getMembershipStatusHandler error:", error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to retrieve membership status",
    });
  }
};

/**
 * POST /api/membership/renew
 * Renews current member's tier for +365 days, debits virtual card if selected.
 */
export const renewMembershipHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { paymentMethod = "VIRTUAL_CARD" } = req.body;
    const result = await renewMembership({ userId, paymentMethod });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("renewMembershipHandler error:", error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to renew membership",
    });
  }
};

/**
 * POST /api/membership/upgrade
 * Upgrades member tier to targetTier, debits prorated difference, resets expiry to +365 days.
 */
export const upgradeMembershipHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { targetTier, paymentMethod = "VIRTUAL_CARD" } = req.body;
    if (!targetTier) {
      return res.status(400).json({ success: false, message: "targetTier is required (GOLD, SILVER, JUNIOR)" });
    }

    const result = await upgradeMembership({ userId, targetTier, paymentMethod });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("upgradeMembershipHandler error:", error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to upgrade membership",
    });
  }
};

/**
 * POST /api/membership/purchase (and /subscribe)
 * Allows member to purchase / subscribe to ANY tier (GOLD, SILVER, JUNIOR) directly.
 */
export const purchaseMembershipHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { tier, targetTier, paymentMethod = "VIRTUAL_CARD" } = req.body;
    const selectedTier = tier || targetTier;

    if (!selectedTier) {
      return res.status(400).json({
        success: false,
        message: "Subscription tier is required (GOLD, SILVER, JUNIOR)",
      });
    }

    const result = await purchaseMembership({
      userId,
      tier: selectedTier,
      paymentMethod,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("purchaseMembershipHandler error:", error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to purchase membership subscription",
    });
  }
};

/**
 * GET /api/membership/expiring
 * List members whose membership will expire within the upcoming window (default: 2 days).
 */
export const getExpiringMembers = async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 2;
    const expiringUsers = await findUsersExpiringSoon(days);

    return res.status(200).json({
      daysThreshold: days,
      count: expiringUsers.length,
      members: expiringUsers,
    });
  } catch (error) {
    console.error("getExpiringMembers error:", error);
    return res.status(500).json({
      message: "Failed to retrieve expiring memberships",
      error: error.message,
    });
  }
};

/**
 * POST /api/membership/trigger-expiry-check
 * Manually trigger scanning and automated email reminder sending.
 * Useful for admin console, cron jobs, and integration tests.
 */
export const triggerExpiryCheck = async (req, res) => {
  try {
    const days = parseInt(req.body.days, 10) || 2;
    const report = await processExpiringMemberships(days);

    return res.status(200).json({
      message: `Membership expiry check triggered successfully for a ${days}-day threshold.`,
      report,
    });
  } catch (error) {
    console.error("triggerExpiryCheck error:", error);
    return res.status(500).json({
      message: "Failed to process membership expiry check",
      error: error.message,
    });
  }
};
