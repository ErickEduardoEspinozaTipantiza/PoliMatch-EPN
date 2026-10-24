import express from "express";
import { protectRoute } from "../middleware/auth.js";
import { addPhoto, updateProfile } from "../controllers/userController.js";

const router = express.Router();

router.put("/update", protectRoute, updateProfile);
router.post("/photos", protectRoute, addPhoto);

export default router;
