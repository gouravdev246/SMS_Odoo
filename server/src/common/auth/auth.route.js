import { Router } from "express";
import {
  sendRegisterOtp,
  register,
  verifyRegisterOtp,
  login,
  verifyLoginOtp,
  createSubAdmin,
  forgotPassword,
  resetPassword,
  updateProfile,
  logout,
  getMe,
  verifyRole,
} from "./auth.controller.js";
import { authenticate, requireRoles } from "../middlewares/auth.middleware.js";

const router = Router();

// Public Authentication Endpoints
// Step 1: User clicks "Send OTP" button
router.post("/send-register-otp", sendRegisterOtp);
router.post("/send-otp", sendRegisterOtp); // Convenience alias

// Step 2: User enters OTP with details and registers
router.post("/register", register);
router.post("/verify-register", verifyRegisterOtp);

// Login endpoints (public - credentials and OTP are submitted here)
router.post("/login", login);
router.post("/verify-login", verifyLoginOtp);

// Password recovery endpoints
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Logout
router.post("/logout", logout);

// Protected Endpoints
router.get("/me", authenticate, getMe);
router.get("/verify-role", authenticate, verifyRole);
router.get("/verify-superadmin", authenticate, requireRoles("SUPERADMIN", "ADMIN"), (req, res) => {
  return res.status(200).json({
    success: true,
    message: "User is a verified Super Admin",
    user: req.user,
  });
});
router.put("/profile", authenticate, updateProfile);

// Admin / Super Admin / Sub-Admin: Create Sub-Admin with assigned module
router.post("/create-subadmin", authenticate, requireRoles("SUPERADMIN", "ADMIN", "SUBADMIN"), createSubAdmin);

export default router;
