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

// All super admin routes require authentication
router.use(authenticate);

// 1. Dashboard, statistics, directory & read operations (accessible to SUPERADMIN, ADMIN, and SUBADMIN)
router.get("/verify", requireRoles("SUPERADMIN", "ADMIN", "SUBADMIN"), verifySuperAdminStatus);
router.get("/sub-admins", requireRoles("SUPERADMIN", "ADMIN", "SUBADMIN"), getSubAdmins);
router.post("/sub-admins", requireRoles("SUPERADMIN", "ADMIN", "SUBADMIN"), createSubAdmin);
router.put("/sub-admins/:id/module", requireRoles("SUPERADMIN", "ADMIN", "SUBADMIN"), updateSubAdminModule);

router.get("/overview", requireRoles("SUPERADMIN", "ADMIN", "SUBADMIN"), getOverview);
router.get("/models", requireRoles("SUPERADMIN", "ADMIN", "SUBADMIN"), listModels);
router.get("/data/:model", requireRoles("SUPERADMIN", "ADMIN", "SUBADMIN"), getModelData);
router.get("/data/:model/:id", requireRoles("SUPERADMIN", "ADMIN", "SUBADMIN"), getModelRecordById);
router.get("/sports/pricing", requireRoles("SUPERADMIN", "ADMIN", "SUBADMIN"), getSportsPricing);
router.get("/sports/config", requireRoles("SUPERADMIN", "ADMIN", "SUBADMIN"), getSportsConfig);

// 2. Core database modifications, raw SQL queries, and role elevations strictly require SUPERADMIN or ADMIN
const superAdminOnly = requireRoles("SUPERADMIN", "ADMIN");

// User role management (assign SUPERADMIN, ADMIN, SUBADMIN, STAFF, MEMBER)
router.put("/users/:id/role", superAdminOnly, changeUserRole);

// Universal Write CRUD endpoints
router.post("/data/:model", superAdminOnly, createModelRecord);
router.put("/data/:model/:id", superAdminOnly, updateModelRecord);
router.delete("/data/:model/:id", superAdminOnly, deleteModelRecord);

// Safe read-only SQL diagnostic query runner
router.post("/query", superAdminOnly, executeQuery);

// Sports Pricing and Configuration updates
router.put("/sports/pricing", superAdminOnly, updateSportsPricing);
router.put("/sports/config", superAdminOnly, updateSportsConfig);

export default router;
