import express from "express";
import { signup, login, logout } from "../controllers/authController.js";
import { protectRoute } from "../middleware/auth.js";
import { ownUser } from "../utils/users.js";

const router = express.Router();
router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", protectRoute, (req, res) =>
  res.json({ success: true, user: ownUser(req.user) }),
);
export default router;
