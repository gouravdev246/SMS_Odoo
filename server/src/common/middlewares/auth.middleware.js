import jwt from "jsonwebtoken";
import prisma from "../../config/prisma.js";

const JWT_SECRET = process.env.JWT_SECRET || "sms_odoo_jwt_secret_super_secure_key";

/**
 * Authentication Middleware:
 * Verifies JWT token from httpOnly cookie or Authorization header.
 * Attaches the authenticated user object with role and module to req.user.
 */
export const authenticate = async (req, res, next) => {
  try {
    let token = req.cookies?.token;

    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }
    
    if (!token) {
      return res.status(401).json({ message: "Authentication required. Please login." });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        membership: true,
        amount: true,
      },
    });

    if (!user) {
      return res.status(401).json({ message: "User not found or token invalid." });
    }

    // Check staff table for assigned module if sub-admin or staff
    const staff = await prisma.staff.findUnique({ where: { email: user.email } });

    // Determine effective role: user.role is authoritative if not default MEMBER,
    // otherwise fallback to Staff table role or decoded token role
    const effectiveRole =
      user.role && user.role !== "MEMBER"
        ? user.role
        : staff?.role || user.role || decoded.role || "MEMBER";

    req.user = {
      ...user,
      amount: Number(user.amount || 0),
      role: effectiveRole,
      module: staff?.designation || decoded.module || null,
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Session expired. Please login again." });
    }
    return res.status(401).json({ message: "Invalid authentication token." });
  }
};

/**
 * Helper to check whether a role string represents Super Admin
 */
export const isSuperAdminRole = (role) => {
  const r = (role || "").toUpperCase();
  return r === "SUPERADMIN" || r === "ADMIN";
};

/**
 * Role-Based Access Control Middleware:
 * Verifies that the authenticated user possesses one of the allowed roles.
 * Allowed roles: 'SUPERADMIN', 'ADMIN', 'SUBADMIN', 'STAFF', 'MEMBER'
 */
export const requireRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required." });
    }

    const userRole = (req.user.role || "MEMBER").toUpperCase();
    const allowed = allowedRoles.map((r) => r.toUpperCase());

    // Both SUPERADMIN and ADMIN satisfy super admin requirements
    const isSuperAdminAuthorized =
      (allowed.includes("SUPERADMIN") || allowed.includes("ADMIN")) &&
      isSuperAdminRole(userRole);

    if (allowed.includes(userRole) || isSuperAdminAuthorized) {
      return next();
    }

    return res.status(403).json({
      message: `Forbidden. Requires one of the following roles: ${allowedRoles.join(", ")}`,
    });
  };
};

/**
 * Module Access Control Middleware:
 * - Super Admin can see and manage all modules.
 * - Sub-admin can only access data belonging to their assigned module (e.g., 'staff', 'sports').
 * - Members have access if explicitly allowed or handled per module logic.
 */
export const authorizeModule = (requiredModule) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required." });
    }

    // Super Admin has full access to all modules
    if (isSuperAdminRole(req.user.role)) {
      return next();
    }

    // Sub-admin has access only to their assigned module
    if (req.user.role === "SUBADMIN") {
      const userModule = (req.user.module || "").trim().toLowerCase();
      const targetModule = (requiredModule || "").trim().toLowerCase();

      if (userModule === targetModule) {
        return next();
      }

      return res.status(403).json({
        message: `Access denied. Sub-admin is assigned to '${req.user.module}' module, not '${requiredModule}'.`,
      });
    }

    // Members or other roles do not have subadmin module administrative privileges
    return res.status(403).json({
      message: `Access denied for role '${req.user.role}' on '${requiredModule}' module.`,
    });
  };
};
