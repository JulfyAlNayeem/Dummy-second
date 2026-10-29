
import express from "express";
import { checkSiteVerification, createSiteSecurityMessage, getSiteSecurityMessages, verifySiteSecurityMessage } from "./siteSecurity.controller.js";
import { requireAdmin, requireSuperAdmin } from "../../../middlewares/adminAuth.js"
import { authLimiter } from "../../../middlewares/rateLimiter.js";

const siteSecurityRouter = express.Router()

siteSecurityRouter.post('/create-site-security-messages',requireAdmin, createSiteSecurityMessage);
siteSecurityRouter.get('/get-site-security-messages',requireAdmin, getSiteSecurityMessages);
siteSecurityRouter.post('/verify-site-security-messages', authLimiter, verifySiteSecurityMessage);
siteSecurityRouter.get('/check-site-verification', checkSiteVerification);

export default siteSecurityRouter;
