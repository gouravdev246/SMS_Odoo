import { Router } from "express";
import {
  getExpiringMembers,
  triggerExpiryCheck,
  getMembershipPlansHandler,
  getMembershipStatusHandler,
  renewMembershipHandler,
  upgradeMembershipHandler,
  purchaseMembershipHandler,
} from "../controllers/membership.controller.js";
import { authenticate, requireRoles } from "../../../common/middlewares/auth.middleware.js";

const router = Router();

// Public plans reference
router.get("/plans", getMembershipPlansHandler);

// Member self-service endpoints
router.get("/status", authenticate, getMembershipStatusHandler);
router.post("/renew", authenticate, renewMembershipHandler);
router.post("/upgrade", authenticate, upgradeMembershipHandler);
router.post("/purchase", authenticate, purchaseMembershipHandler);
router.post("/subscribe", authenticate, purchaseMembershipHandler);

// Staff / Admin endpoints
// Retrieve members whose membership is expiring in 2 days (or ?days=X)
router.get("/expiring", authenticate, requireRoles("ADMIN", "SUBADMIN"), getExpiringMembers);

// Manually trigger scanning and sending expiry reminder emails
router.post("/trigger-expiry-check", authenticate, requireRoles("ADMIN"), triggerExpiryCheck);

export default router;
