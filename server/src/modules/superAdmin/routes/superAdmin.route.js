import { Router } from "express";
import {
  getOverview,
  listModels,
  getModelData,
  getModelRecordById,
  createModelRecord,
  updateModelRecord,
  deleteModelRecord,
  executeQuery,
  getSubAdmins,
  createSubAdmin,
  updateSubAdminModule,
  getSportsPricing,
  updateSportsPricing,
  getSportsConfig,
  updateSportsConfig,
  verifySuperAdminStatus,
  changeUserRole,
} from "../controllers/superAdmin.controller.js";
import { authenticate, requireRoles } from "../../../common/middlewares/auth.middleware.js";

const router = Router();

// All super admin routes require authentication and SUPERADMIN / ADMIN role
router.use(authenticate, requireRoles("SUPERADMIN", "ADMIN"));

// Super admin status verification
router.get("/verify", verifySuperAdminStatus);

// User role management (assign SUPERADMIN, ADMIN, SUBADMIN, STAFF, MEMBER)
router.put("/users/:id/role", changeUserRole);

// Multi-module system overview and statistics
router.get("/overview", getOverview);

// Database schema explorer - list all models and field types
router.get("/models", listModels);

// Universal CRUD endpoints for ANY table in the database
router.get("/data/:model", getModelData);
router.get("/data/:model/:id", getModelRecordById);
router.post("/data/:model", createModelRecord);
router.put("/data/:model/:id", updateModelRecord);
router.delete("/data/:model/:id", deleteModelRecord);

// Safe read-only SQL diagnostic query runner
router.post("/query", executeQuery);

// Sub-admin directory, creation, and module assignment
router.get("/sub-admins", getSubAdmins);
router.post("/sub-admins", createSubAdmin);
router.put("/sub-admins/:id/module", updateSubAdminModule);

// Sports Pricing and Configuration
router.get("/sports/pricing", getSportsPricing);
router.put("/sports/pricing", updateSportsPricing);
router.get("/sports/config", getSportsConfig);
router.put("/sports/config", updateSportsConfig);

export default router;
