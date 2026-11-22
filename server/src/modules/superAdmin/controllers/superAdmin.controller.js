import * as superAdminService from "../services/superAdmin.service.js";
import { getAllSportPricing, updateSportPricing } from "../../sports/services/pricing.service.js";

/**
 * GET /api/super-admin/overview
 * Returns multi-module overview, live counts, revenue, and system statistics.
 */
export const getOverview = async (req, res) => {
  try {
    const overview = await superAdminService.getDatabaseOverview();
    return res.status(200).json(overview);
  } catch (error) {
    console.error("Super Admin getOverview error:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Failed to retrieve database overview",
    });
  }
};

/**
 * GET /api/super-admin/models
 * Returns all models in the database with their fields, types, relations, and counts.
 */
export const listModels = async (req, res) => {
  try {
    const models = await superAdminService.getAllModelsMetadata();
    return res.status(200).json({
      totalModels: models.length,
      models,
    });
  } catch (error) {
    console.error("Super Admin listModels error:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Failed to list database models",
    });
  }
};

/**
 * GET /api/super-admin/data/:model
 * Generic data query for ANY database table/model.
 * Supports pagination, search across string fields, column filtering, and sorting.
 */
export const getModelData = async (req, res) => {
  try {
    const { model } = req.params;
    const result = await superAdminService.getModelRecords(model, req.query);
    return res.status(200).json(result);
  } catch (error) {
    console.error(`Super Admin getModelData for '${req.params.model}' error:`, error);
    return res.status(error.statusCode || 500).json({
      message: error.message,
      availableModels: error.availableModels,
    });
  }
};

/**
 * GET /api/super-admin/data/:model/:id
 * Retrieve a specific record from any table with its relations populated.
 */
export const getModelRecordById = async (req, res) => {
  try {
    const { model, id } = req.params;
    const record = await superAdminService.getModelRecordById(model, id, req.query);
    return res.status(200).json({ data: record });
  } catch (error) {
    console.error(`Super Admin getModelRecordById for '${req.params.model}' id '${req.params.id}' error:`, error);
    return res.status(error.statusCode || 500).json({
      message: error.message,
      availableModels: error.availableModels,
    });
  }
};

/**
 * POST /api/super-admin/data/:model
 * Insert a new record into any database table.
 */
export const createModelRecord = async (req, res) => {
  try {
    const { model } = req.params;
    const created = await superAdminService.createModelRecord(model, req.body);
    return res.status(201).json({
      message: `Record successfully created in '${model}'`,
      data: created,
    });
  } catch (error) {
    console.error(`Super Admin createModelRecord for '${req.params.model}' error:`, error);
    return res.status(error.statusCode || 400).json({
      message: error.message,
    });
  }
};

/**
 * PUT /api/super-admin/data/:model/:id
 * Update an existing record in any database table.
 */
export const updateModelRecord = async (req, res) => {
  try {
    const { model, id } = req.params;
    const updated = await superAdminService.updateModelRecord(model, id, req.body);
    return res.status(200).json({
      message: `Record with id '${id}' updated successfully in '${model}'`,
      data: updated,
    });
  } catch (error) {
    console.error(`Super Admin updateModelRecord for '${req.params.model}' id '${req.params.id}' error:`, error);
    return res.status(error.statusCode || 400).json({
      message: error.message,
    });
  }
};

/**
 * DELETE /api/super-admin/data/:model/:id
 * Delete a record from any database table.
 */
export const deleteModelRecord = async (req, res) => {
  try {
    const { model, id } = req.params;
    const result = await superAdminService.deleteModelRecord(model, id);
    return res.status(200).json(result);
  } catch (error) {
    console.error(`Super Admin deleteModelRecord for '${req.params.model}' id '${req.params.id}' error:`, error);
    return res.status(error.statusCode || 400).json({
      message: error.message,
    });
  }
};

/**
 * POST /api/super-admin/query
 * Safe read-only SQL query runner for deep database diagnostics.
 */
export const executeQuery = async (req, res) => {
  try {
    const { query } = req.body;
    const rows = await superAdminService.executeSafeQuery(query);
    return res.status(200).json({
      query,
      rowCount: rows.length,
      rows,
    });
  } catch (error) {
    console.error("Super Admin executeQuery error:", error);
    return res.status(error.statusCode || 400).json({
      message: error.message,
    });
  }
};

/**
 * GET /api/super-admin/sub-admins
 * Returns all staff members and their module assignments.
 */
export const getSubAdmins = async (req, res) => {
  try {
    const staff = await superAdminService.getAllSubAdmins();
    return res.status(200).json({
      total: staff.length,
      subAdmins: staff,
    });
  } catch (error) {
    console.error("Super Admin getSubAdmins error:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message,
    });
  }
};

/**
 * POST /api/super-admin/sub-admins
 * Creates a new sub-admin with authentication credentials and module assignment.
 */
export const createSubAdmin = async (req, res) => {
  try {
    const { name, email, phone, password, role, module, salary } = req.body;
    const subAdmin = await superAdminService.createSubAdmin({
      name,
      email,
      phone,
      password,
      role,
      module,
      salary,
    });
    return res.status(201).json({
      message: `Sub-admin '${subAdmin.name}' created successfully with module '${subAdmin.designation}'`,
      subAdmin,
    });
  } catch (error) {
    console.error("Super Admin createSubAdmin error:", error);
    return res.status(error.statusCode || 400).json({
      message: error.message || "Failed to create sub-admin",
    });
  }
};

/**
 * PUT /api/super-admin/sub-admins/:id/module
 * Reassigns or assigns a module to a sub-admin.
 */
export const updateSubAdminModule = async (req, res) => {
  try {
    const { id } = req.params;
    const { module } = req.body;
    const updated = await superAdminService.updateSubAdminModule(id, module);
    return res.status(200).json({
      message: `Sub-admin assigned to module '${module}' successfully`,
      subAdmin: updated,
    });
  } catch (error) {
    console.error(`Super Admin updateSubAdminModule for id '${req.params.id}' error:`, error);
    return res.status(error.statusCode || 400).json({
      message: error.message,
    });
  }
};

/**
 * GET /sports/pricing
 * Super Admin: Get all sport pricing configurations.
 */
export const getSportsPricing = async (req, res) => {
  try {
    const pricing = await getAllSportPricing();
    return res.status(200).json({ pricing });
  } catch (error) {
    console.error("Super Admin get sports pricing error:", error);
    return res.status(500).json({ message: "Failed to retrieve pricing", error: error.message });
  }
};

/**
 * PUT /sports/pricing
 * Super Admin: Update pricing and discounts for a sport.
 */
export const updateSportsPricing = async (req, res) => {
  try {
    const { sport, basePrice, goldDiscount, silverDiscount, juniorDiscount } = req.body;

    if (!sport) {
      return res.status(400).json({ message: "Sport is required" });
    }

    const updated = await updateSportPricing(sport, {
      basePrice,
      goldDiscount,
      silverDiscount,
      juniorDiscount,
    });

    return res.status(200).json({
      message: `Pricing for ${sport} updated successfully`,
      pricing: updated,
    });
  } catch (error) {
    console.error("Super Admin update sports pricing error:", error);
    return res.status(400).json({ message: error.message });
  }
};

/**
 * GET /sports/config
 * Super Admin: Get operating hours and court capacities.
 */
export const getSportsConfig = async (req, res) => {
  try {
    const configs = await getAllSportPricing();
    const result = configs.map((c) => ({
      sport: c.sport,
      capacity: c.capacity,
      openTime: c.openTime,
      closeTime: c.closeTime,
      isActive: c.isActive,
    }));
    return res.status(200).json({ configs: result });
  } catch (error) {
    console.error("Super Admin get sports config error:", error);
    return res.status(500).json({ message: "Failed to retrieve config", error: error.message });
  }
};

/**
 * PUT /sports/config
 * Super Admin: Update operating hours and court capacity for a sport.
 */
export const updateSportsConfig = async (req, res) => {
  try {
    const { sport, capacity, openTime, closeTime, isActive } = req.body;

    if (!sport) {
      return res.status(400).json({ message: "Sport is required" });
    }

    const updated = await updateSportPricing(sport, {
      capacity,
      openTime,
      closeTime,
      isActive,
    });

    return res.status(200).json({
      message: `Configuration for ${sport} updated successfully`,
      config: {
        sport: updated.sport,
        capacity: updated.capacity,
        openTime: updated.openTime,
        closeTime: updated.closeTime,
        isActive: updated.isActive,
      },
    });
  } catch (error) {
    console.error("Super Admin update sports config error:", error);
    return res.status(400).json({ message: error.message });
  }
};

/**
 * GET /api/super-admin/verify
 * Confirms that the caller is authenticated and holds verified super admin privileges.
 */
export const verifySuperAdminStatus = async (req, res) => {
  return res.status(200).json({
    success: true,
    isSuperAdmin: true,
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
  });
};

/**
 * PUT /api/super-admin/users/:id/role
 * Assigns or updates a user's role (SUPERADMIN, ADMIN, SUBADMIN, STAFF, MEMBER).
 */
export const changeUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({
        message: "Role is required (SUPERADMIN, ADMIN, SUBADMIN, STAFF, MEMBER)",
      });
    }

    const updatedUser = await superAdminService.updateUserRole(id, role);
    return res.status(200).json({
      message: `User role updated successfully to '${updatedUser.role}'`,
      user: updatedUser,
    });
  } catch (error) {
    console.error("Super Admin changeUserRole error:", error);
    return res.status(error.statusCode || 400).json({
      message: error.message,
    });
  }
};
