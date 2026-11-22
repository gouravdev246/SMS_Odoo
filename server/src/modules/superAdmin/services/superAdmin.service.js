import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import prisma from "../../../config/prisma.js";

/**
 * Normalizes a model name or URL slug into camelCase, kebab-case, and lower-case variants.
 */
const toKebabCase = (str) =>
  str
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();

/**
 * Cache and dynamic lookup map for all Prisma models.
 * Dynamically generated from Prisma.dmmf.datamodel.models.
 */
export const getModelRegistry = () => {
  const models = Prisma.dmmf?.datamodel?.models || [];
  const registry = new Map();

  for (const model of models) {
    const delegate = model.name.charAt(0).toLowerCase() + model.name.slice(1);
    const slug = toKebabCase(model.name);
    const pluralSlug = `${slug}s`;
    const lowercaseName = model.name.toLowerCase();
    const lowercasePlural = `${lowercaseName}s`;

    const modelInfo = {
      name: model.name,
      delegate,
      slug,
      pluralSlug,
      primaryKey: model.primaryKey?.name || "id",
      fields: model.fields,
      scalarFields: model.fields.filter((f) => f.kind === "scalar" || f.kind === "enum"),
      relationFields: model.fields.filter((f) => f.kind === "object"),
    };

    // Index by multiple alias formats for effortless client access
    registry.set(model.name, modelInfo);
    registry.set(delegate, modelInfo);
    registry.set(lowercaseName, modelInfo);
    registry.set(lowercasePlural, modelInfo);
    registry.set(slug, modelInfo);
    registry.set(pluralSlug, modelInfo);
  }

  return registry;
};

/**
 * Resolves a model name/slug from request parameter to its Prisma model metadata and delegate.
 * Supports any case, plural/singular, or kebab/camel-case (e.g. 'users', 'User', 'sports-bookings', 'cafe_orders').
 */
export const resolveModel = (modelIdentifier) => {
  if (!modelIdentifier || typeof modelIdentifier !== "string") {
    throw new Error("Model identifier is required");
  }

  const registry = getModelRegistry();
  const cleanKey = modelIdentifier.trim();

  // Try direct lookup
  let resolved = registry.get(cleanKey) || registry.get(cleanKey.toLowerCase());

  // Try normalizing kebab / snake / plural
  if (!resolved) {
    const normalized = cleanKey.replace(/[-_]/g, "").toLowerCase();
    for (const [key, info] of registry.entries()) {
      if (key.replace(/[-_]/g, "").toLowerCase() === normalized) {
        resolved = info;
        break;
      }
    }
  }

  if (!resolved) {
    const available = Array.from(new Set(Array.from(registry.values()).map((v) => v.name)));
    const error = new Error(`Model '${modelIdentifier}' not found in database schema.`);
    error.statusCode = 404;
    error.availableModels = available;
    throw error;
  }

  // Ensure delegate exists on current prisma client instance
  if (!prisma[resolved.delegate]) {
    const error = new Error(`Prisma delegate '${resolved.delegate}' is not available.`);
    error.statusCode = 500;
    throw error;
  }

  return resolved;
};

/**
 * Sanitizes an object or array of objects by stripping sensitive fields like password.
 */
export const sanitizeData = (data, includeSensitive = false) => {
  if (includeSensitive || !data) return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item, false));
  }

  if (typeof data === "object") {
    const sanitized = { ...data };
    if ("password" in sanitized) {
      delete sanitized.password;
    }

    // Sanitize nested relations if any
    for (const key of Object.keys(sanitized)) {
      if (sanitized[key] && typeof sanitized[key] === "object") {
        sanitized[key] = sanitizeData(sanitized[key], false);
      }
    }

    return sanitized;
  }

  return data;
};

/**
 * Type-casts scalar input values according to the Prisma schema field definitions.
 */
export const castFieldValue = (field, value) => {
  if (value === undefined || value === null) return null;

  switch (field.type) {
    case "Int":
      return parseInt(value, 10);
    case "Float":
      return parseFloat(value);
    case "Decimal":
      return value.toString();
    case "Boolean":
      return value === true || value === "true" || value === 1 || value === "1";
    case "DateTime":
      return new Date(value);
    case "String":
      return String(value);
    default:
      return value;
  }
};

/**
 * GET ALL MODELS METADATA:
 * Returns schema metadata and live record counts for all models in the database.
 */
export const getAllModelsMetadata = async () => {
  const models = Prisma.dmmf?.datamodel?.models || [];
  const results = [];

  for (const model of models) {
    const delegate = model.name.charAt(0).toLowerCase() + model.name.slice(1);
    const slug = toKebabCase(model.name);

    let count = 0;
    try {
      if (prisma[delegate]?.count) {
        count = await prisma[delegate].count();
      }
    } catch (err) {
      console.warn(`Could not count records for model ${model.name}:`, err.message);
    }

    results.push({
      name: model.name,
      delegate,
      slug,
      recordCount: count,
      primaryKey: model.primaryKey?.name || "id",
      fields: model.fields.map((f) => ({
        name: f.name,
        type: f.type,
        kind: f.kind,
        isRequired: f.isRequired,
        isId: f.isId,
        isUnique: f.isUnique,
        isList: f.isList,
        relationName: f.relationName || null,
      })),
    });
  }

  return results;
};

/**
 * SYSTEM & MULTI-MODULE OVERVIEW:
 * Aggregates live system-wide statistics across all database tables and modules.
 */
export const getDatabaseOverview = async () => {
  const models = Prisma.dmmf?.datamodel?.models || [];
  const counts = {};

  // Fetch record counts for all models in parallel
  await Promise.all(
    models.map(async (model) => {
      const delegate = model.name.charAt(0).toLowerCase() + model.name.slice(1);
      try {
        if (prisma[delegate]?.count) {
          counts[model.name] = await prisma[delegate].count();
        }
      } catch {
        counts[model.name] = 0;
      }
    })
  );

  // Module 1: Users & Memberships
  let usersOverview = {
    total: counts.User || 0,
    byMembership: { GOLD: 0, SILVER: 0, JUNIOR: 0 },
    byRole: { SUPERADMIN: 0, ADMIN: 0, SUBADMIN: 0, STAFF: 0, MEMBER: 0 },
    totalBalance: "0.00",
  };
  try {
    const membershipStats = await prisma.user.groupBy({
      by: ["membership"],
      _count: { _all: true },
    });
    for (const stat of membershipStats) {
      usersOverview.byMembership[stat.membership] = stat._count._all;
    }
    const roleStats = await prisma.user.groupBy({
      by: ["role"],
      _count: { _all: true },
    });
    for (const stat of roleStats) {
      if (stat.role) {
        usersOverview.byRole[stat.role] = stat._count._all;
      }
    }
    const balanceAgg = await prisma.user.aggregate({
      _sum: { amount: true },
    });
    usersOverview.totalBalance = (balanceAgg._sum.amount || 0).toString();
  } catch (err) {
    console.warn("User stats error:", err.message);
  }

  // Module 2: Sports Bookings & Courts
  let sportsOverview = {
    totalBookings: counts.SportsBooking || 0,
    byStatus: { HELD: 0, CONFIRMED: 0, EXPIRED: 0, CANCELLED: 0 },
    totalBookingRevenue: "0.00",
    activePricingConfigs: counts.SportPricing || 0,
    totalSlots: counts.Slot || 0,
  };
  try {
    const bookingStats = await prisma.sportsBooking.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    for (const stat of bookingStats) {
      sportsOverview.byStatus[stat.status] = stat._count._all;
    }
    const revenueAgg = await prisma.sportsBooking.aggregate({
      where: { status: "CONFIRMED" },
      _sum: { totalAmount: true },
    });
    sportsOverview.totalBookingRevenue = (revenueAgg._sum.totalAmount || 0).toString();
  } catch (err) {
    console.warn("Sports stats error:", err.message);
  }

  // Module 3: Cafe Orders
  let cafeOverview = {
    totalOrders: counts.CafeOrder || 0,
    totalRevenue: "0.00",
  };
  try {
    const cafeRevenueAgg = await prisma.cafeOrder.aggregate({
      _sum: { totalAmount: true },
    });
    cafeOverview.totalRevenue = (cafeRevenueAgg._sum.totalAmount || 0).toString();
  } catch (err) {
    console.warn("Cafe stats error:", err.message);
  }

  // Module 4: Sport Shop Purchases
  let shopOverview = {
    totalPurchases: counts.SportShopPurchase || 0,
    totalRevenue: "0.00",
  };
  try {
    const shopRevenueAgg = await prisma.sportShopPurchase.aggregate({
      _sum: { totalAmount: true },
    });
    shopOverview.totalRevenue = (shopRevenueAgg._sum.totalAmount || 0).toString();
  } catch (err) {
    console.warn("Shop stats error:", err.message);
  }

  // Module 5: Inventory & Products
  let productOverview = {
    totalProducts: counts.Product || 0,
    totalStockCount: 0,
  };
  try {
    const stockAgg = await prisma.product.aggregate({
      _sum: { inStock: true },
    });
    productOverview.totalStockCount = stockAgg._sum.inStock || 0;
  } catch (err) {
    console.warn("Product stats error:", err.message);
  }

  // Module 6: Staff & Sub-Admins
  let staffOverview = {
    totalStaff: counts.Staff || 0,
    byRole: {},
    byModule: {},
  };
  try {
    const staffRecords = await prisma.staff.findMany({
      select: { role: true, designation: true },
    });
    for (const s of staffRecords) {
      staffOverview.byRole[s.role] = (staffOverview.byRole[s.role] || 0) + 1;
      const mod = s.designation || "unassigned";
      staffOverview.byModule[mod] = (staffOverview.byModule[mod] || 0) + 1;
    }
  } catch (err) {
    console.warn("Staff stats error:", err.message);
  }

  // Recent system-wide activity logs across modules
  let recentActivity = {
    recentBookings: [],
    recentUsers: [],
    recentOrders: [],
    recentPurchases: [],
  };
  try {
    const [bookings, users, orders, purchases] = await Promise.all([
      prisma.sportsBooking.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true, email: true, phone: true } } },
      }),
      prisma.user.findMany({
        take: 5,
        orderBy: { id: "desc" },
        select: { id: true, name: true, email: true, membership: true, amount: true },
      }),
      prisma.cafeOrder.findMany({
        take: 5,
        orderBy: { dateTime: "desc" },
        include: { user: { select: { name: true, email: true } } },
      }),
      prisma.sportShopPurchase.findMany({
        take: 5,
        orderBy: { purchaseDate: "desc" },
        include: { user: { select: { name: true, email: true } } },
      }),
    ]);
    recentActivity = {
      recentBookings: sanitizeData(bookings),
      recentUsers: sanitizeData(users),
      recentOrders: sanitizeData(orders),
      recentPurchases: sanitizeData(purchases),
    };
  } catch (err) {
    console.warn("Recent activity query error:", err.message);
  }

  return {
    database: {
      status: "connected",
      provider: "postgresql",
      timestamp: new Date().toISOString(),
      modelsCount: models.length,
    },
    counts,
    modules: {
      users: usersOverview,
      sports: sportsOverview,
      cafe: cafeOverview,
      shop: shopOverview,
      inventory: productOverview,
      staff: staffOverview,
    },
    recentActivity,
  };
};

/**
 * GENERAL DATA RETRIEVAL (PAGINATED, SORTED, FILTERED, SEARCHABLE):
 * Super Admin can access data from ANY table in the database.
 */
export const getModelRecords = async (modelIdentifier, query = {}) => {
  const modelInfo = resolveModel(modelIdentifier);
  const delegate = prisma[modelInfo.delegate];

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const where = {};
  const scalarFieldNames = new Set(modelInfo.scalarFields.map((f) => f.name));

  // 1. Text Search across String fields
  if (query.search && typeof query.search === "string" && query.search.trim()) {
    const searchTerm = query.search.trim();
    const stringFields = modelInfo.scalarFields.filter(
      (f) => f.type === "String" && f.name !== "password"
    );

    if (stringFields.length > 0) {
      where.OR = stringFields.map((f) => ({
        [f.name]: { contains: searchTerm, mode: "insensitive" },
      }));
    }
  }

  // 2. Specific Field Filters passed as query parameters (e.g. status=CONFIRMED, whichCourt=TENNIS)
  const reservedQueryKeys = new Set([
    "page",
    "limit",
    "sortBy",
    "sortOrder",
    "search",
    "includeRelations",
    "includeSensitive",
  ]);

  for (const [key, value] of Object.entries(query)) {
    if (reservedQueryKeys.has(key)) continue;

    if (scalarFieldNames.has(key)) {
      const fieldDef = modelInfo.scalarFields.find((f) => f.name === key);
      where[key] = castFieldValue(fieldDef, value);
    }
  }

  // 3. Sorting
  let orderBy = undefined;
  if (query.sortBy && scalarFieldNames.has(query.sortBy)) {
    const sortOrder = query.sortOrder?.toLowerCase() === "asc" ? "asc" : "desc";
    orderBy = { [query.sortBy]: sortOrder };
  } else if (scalarFieldNames.has("createdAt")) {
    orderBy = { createdAt: "desc" };
  } else if (scalarFieldNames.has("id")) {
    orderBy = { id: "desc" };
  }

  // 4. Relations inclusion
  let include = undefined;
  if (query.includeRelations === "true") {
    include = {};
    for (const rel of modelInfo.relationFields) {
      include[rel.name] = true;
    }
  } else if (typeof query.includeRelations === "string" && query.includeRelations.trim()) {
    include = {};
    const requested = query.includeRelations.split(",").map((s) => s.trim());
    for (const relName of requested) {
      if (modelInfo.relationFields.some((r) => r.name === relName)) {
        include[relName] = true;
      }
    }
  }

  const findOptions = {
    where,
    skip,
    take: limit,
  };
  if (orderBy) findOptions.orderBy = orderBy;
  if (include && Object.keys(include).length > 0) findOptions.include = include;

  const [records, total] = await Promise.all([
    delegate.findMany(findOptions),
    delegate.count({ where }),
  ]);

  const includeSensitive = query.includeSensitive === "true";
  const sanitizedRecords = sanitizeData(records, includeSensitive);
  const totalPages = Math.ceil(total / limit) || 1;

  return {
    model: {
      name: modelInfo.name,
      slug: modelInfo.slug,
      delegate: modelInfo.delegate,
    },
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    data: sanitizedRecords,
  };
};

/**
 * GET RECORD BY ID:
 * Retrieves a single record with relations populated.
 */
export const getModelRecordById = async (modelIdentifier, id, query = {}) => {
  const modelInfo = resolveModel(modelIdentifier);
  const delegate = prisma[modelInfo.delegate];

  let include = undefined;
  if (query.includeRelations !== "false") {
    include = {};
    for (const rel of modelInfo.relationFields) {
      include[rel.name] = true;
    }
  }

  const findOptions = {
    where: { id },
  };
  if (include && Object.keys(include).length > 0) {
    findOptions.include = include;
  }

  const record = await delegate.findUnique(findOptions);

  if (!record) {
    const error = new Error(`Record with id '${id}' not found in model '${modelInfo.name}'`);
    error.statusCode = 404;
    throw error;
  }

  const includeSensitive = query.includeSensitive === "true";
  return sanitizeData(record, includeSensitive);
};

/**
 * CREATE RECORD IN ANY TABLE:
 * Validates, type-casts, hashes password if needed, and inserts.
 */
export const createModelRecord = async (modelIdentifier, payload = {}) => {
  const modelInfo = resolveModel(modelIdentifier);
  const delegate = prisma[modelInfo.delegate];

  const data = {};
  for (const field of modelInfo.scalarFields) {
    if (field.name in payload) {
      if (field.name === "password" && payload.password) {
        data.password = await bcrypt.hash(payload.password, 10);
      } else {
        data[field.name] = castFieldValue(field, payload[field.name]);
      }
    }
  }

  const created = await delegate.create({ data });
  return sanitizeData(created);
};

/**
 * UPDATE RECORD IN ANY TABLE:
 * Validates existence, type-casts updates, hashes password if changed, and saves.
 */
export const updateModelRecord = async (modelIdentifier, id, payload = {}) => {
  const modelInfo = resolveModel(modelIdentifier);
  const delegate = prisma[modelInfo.delegate];

  // Verify existence
  const existing = await delegate.findUnique({ where: { id } });
  if (!existing) {
    const error = new Error(`Record with id '${id}' not found in model '${modelInfo.name}'`);
    error.statusCode = 404;
    throw error;
  }

  const data = {};
  for (const field of modelInfo.scalarFields) {
    if (field.name === "id") continue; // Never overwrite primary key

    if (field.name in payload) {
      if (field.name === "password") {
        if (payload.password) {
          data.password = await bcrypt.hash(payload.password, 10);
        }
      } else {
        data[field.name] = castFieldValue(field, payload[field.name]);
      }
    }
  }

  const updated = await delegate.update({
    where: { id },
    data,
  });

  return sanitizeData(updated);
};

/**
 * DELETE RECORD FROM ANY TABLE:
 * Verifies existence and deletes record.
 */
export const deleteModelRecord = async (modelIdentifier, id) => {
  const modelInfo = resolveModel(modelIdentifier);
  const delegate = prisma[modelInfo.delegate];

  const existing = await delegate.findUnique({ where: { id } });
  if (!existing) {
    const error = new Error(`Record with id '${id}' not found in model '${modelInfo.name}'`);
    error.statusCode = 404;
    throw error;
  }

  await delegate.delete({ where: { id } });

  return {
    success: true,
    message: `Record with id '${id}' successfully deleted from '${modelInfo.name}'`,
    id,
    model: modelInfo.name,
  };
};

/**
 * SAFE READ-ONLY SQL INSPECTION:
 * Allows super admin to run custom SELECT queries for database diagnostics.
 * Strictly blocks modifying/destructive SQL statements.
 */
export const executeSafeQuery = async (sqlQuery) => {
  if (!sqlQuery || typeof sqlQuery !== "string" || !sqlQuery.trim()) {
    throw new Error("SQL query string is required");
  }

  const trimmed = sqlQuery.trim();
  const lower = trimmed.toLowerCase();

  // Enforce read-only queries
  if (!lower.startsWith("select") && !lower.startsWith("with") && !lower.startsWith("explain")) {
    const error = new Error("Only read-only SELECT or EXPLAIN queries are permitted in this console.");
    error.statusCode = 400;
    throw error;
  }

  // Block destructive keywords
  const forbiddenPattern = /\b(insert|update|delete|drop|alter|truncate|grant|revoke|create|replace)\b/i;
  if (forbiddenPattern.test(trimmed)) {
    const error = new Error("Modification statements (INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE) are forbidden.");
    error.statusCode = 400;
    throw error;
  }

  const result = await prisma.$queryRawUnsafe(trimmed);
  return sanitizeData(result);
};

/**
 * SUB-ADMIN & STAFF ACCESS MANAGEMENT:
 * Fetches all administrative staff and sub-admins from both Staff and User tables.
 */
export const getAllSubAdmins = async () => {
  // 1. Fetch records from Staff table
  const staffRecords = await prisma.staff.findMany({
    orderBy: { createdAt: "desc" },
  });

  // 2. Fetch all users with administrative / staff roles from User table
  const administrativeUsers = await prisma.user.findMany({
    where: {
      role: { in: ["SUBADMIN", "STAFF", "ADMIN"] },
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
    },
    orderBy: { name: "asc" },
  });

  // Map staff by lower-cased email
  const staffByEmail = new Map();
  for (const s of staffRecords) {
    if (s.email) {
      staffByEmail.set(s.email.toLowerCase(), s);
    }
  }

  const combined = [];
  const processedEmails = new Set();

  for (const u of administrativeUsers) {
    const emailKey = u.email ? u.email.toLowerCase() : "";
    processedEmails.add(emailKey);
    const matchingStaff = staffByEmail.get(emailKey);

    combined.push({
      id: matchingStaff?.id || u.id,
      userId: u.id,
      staffId: matchingStaff?.id || null,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      designation: matchingStaff?.designation || (u.role === "SUBADMIN" ? "operations" : "front-desk"),
      salary: matchingStaff?.salary ? Number(matchingStaff.salary) : 35000,
    });
  }

  // Include any staff records not yet matched to User
  for (const s of staffRecords) {
    const emailKey = s.email ? s.email.toLowerCase() : "";
    if (!processedEmails.has(emailKey)) {
      combined.push({
        id: s.id,
        userId: null,
        staffId: s.id,
        name: s.name,
        email: s.email,
        phone: s.phone,
        role: s.role,
        designation: s.designation || "front-desk",
        salary: Number(s.salary || 35000),
      });
    }
  }

  return combined;
};

/**
 * ASSIGN MODULE TO SUB-ADMIN:
 * Updates the assigned module (stored in designation) of a staff member or user.
 */
export const updateSubAdminModule = async (identifier, moduleName) => {
  if (!moduleName) {
    throw new Error("Module name is required");
  }

  const cleanModule = moduleName.trim().toLowerCase();

  // 1. Try finding in Staff by id or email
  let staff = await prisma.staff.findFirst({
    where: {
      OR: [{ id: identifier }, { email: identifier }],
    },
  });

  if (!staff) {
    // 2. If identifier is a User id or email
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ id: identifier }, { email: identifier }],
      },
    });

    if (!user) {
      const error = new Error(`Staff or user with id '${identifier}' not found`);
      error.statusCode = 404;
      throw error;
    }

    // Create staff record for this user
    staff = await prisma.staff.create({
      data: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        designation: cleanModule,
        salary: 35000,
      },
    });
    return staff;
  }

  const updated = await prisma.staff.update({
    where: { id: staff.id },
    data: {
      designation: cleanModule,
    },
  });

  return updated;
};

/**
 * CREATE A NEW SUB-ADMIN:
 * Creates credentials in User table for login and manages department module assignment in Staff.
 */
export const createSubAdmin = async ({
  name,
  email,
  phone,
  password,
  role = "SUBADMIN",
  module = "front-desk",
  salary = 35000,
}) => {
  if (!name || !email || !phone || !password) {
    const error = new Error("Name, email, phone, and password are required to create a sub-admin.");
    error.statusCode = 400;
    throw error;
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanPhone = phone.trim();
  const cleanRole = (role || "SUBADMIN").trim().toUpperCase();
  const cleanModule = (module || "front-desk").trim().toLowerCase();
  const cleanSalary = Number(salary) || 35000;

  // Hash password for authentication
  const hashedPassword = await bcrypt.hash(password, 10);

  // Check if User already exists with email or phone
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: cleanEmail }, { phone: cleanPhone }],
    },
  });

  let userRecord;
  if (existingUser) {
    userRecord = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        name: name.trim(),
        role: cleanRole,
        password: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        membership: true,
      },
    });
  } else {
    userRecord = await prisma.user.create({
      data: {
        name: name.trim(),
        email: cleanEmail,
        phone: cleanPhone,
        password: hashedPassword,
        role: cleanRole,
        membership: "GOLD",
        amount: 0,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        membership: true,
      },
    });
  }

  // Upsert matching Staff record for schedule, department and payroll management
  const existingStaff = await prisma.staff.findUnique({
    where: { email: cleanEmail },
  });

  let staffRecord;
  if (existingStaff) {
    staffRecord = await prisma.staff.update({
      where: { id: existingStaff.id },
      data: {
        name: name.trim(),
        phone: cleanPhone,
        role: cleanRole,
        designation: cleanModule,
        salary: cleanSalary,
      },
    });
  } else {
    staffRecord = await prisma.staff.create({
      data: {
        name: name.trim(),
        email: cleanEmail,
        phone: cleanPhone,
        role: cleanRole,
        designation: cleanModule,
        salary: cleanSalary,
      },
    });
  }

  return {
    id: staffRecord.id,
    userId: userRecord.id,
    name: userRecord.name,
    email: userRecord.email,
    phone: userRecord.phone,
    role: userRecord.role,
    designation: staffRecord.designation,
    salary: Number(staffRecord.salary),
  };
};

/**
 * ASSIGN OR UPDATE USER ROLE:
 * Allows super admin to assign any role (SUPERADMIN, ADMIN, SUBADMIN, STAFF, MEMBER) to a user.
 */
export const updateUserRole = async (userId, newRole) => {
  const allowedRoles = ["SUPERADMIN", "ADMIN", "SUBADMIN", "STAFF", "MEMBER"];
  const cleanRole = (newRole || "").trim().toUpperCase();

  if (!allowedRoles.includes(cleanRole)) {
    const error = new Error(`Invalid role '${newRole}'. Allowed roles: ${allowedRoles.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }

  const existingUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!existingUser) {
    const error = new Error(`User with id '${userId}' not found`);
    error.statusCode = 404;
    throw error;
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { role: cleanRole },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      membership: true,
    },
  });

  // If role is set to SUBADMIN or STAFF, sync role on Staff table if matching record exists
  if (cleanRole === "SUBADMIN" || cleanRole === "STAFF") {
    const existingStaff = await prisma.staff.findUnique({ where: { email: updatedUser.email } });
    if (existingStaff) {
      await prisma.staff.update({
        where: { id: existingStaff.id },
        data: { role: cleanRole },
      });
    }
  }

  return updatedUser;
};
