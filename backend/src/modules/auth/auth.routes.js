import express from "express"
import { requireAuth } from "../../../middlewares/roleMiddleware.js"
import { authLimiter } from "../../../middlewares/rateLimiter.js"
import {
  register,
  login,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
} from "./auth.controller.js"

const router = express.Router()

// Public routes
router.post("/register", authLimiter, register)
router.post("/login", authLimiter, login)
router.post("/refresh-token", refreshToken)
router.post("/forgot-password", authLimiter, forgotPassword)
router.post("/reset-password", authLimiter, resetPassword)
router.post("/verify-email", authLimiter, verifyEmail)
router.post("/resend-verification", authLimiter, resendVerification)

// Protected routes
router.post("/logout", requireAuth, logout)
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user })
})

export default router
