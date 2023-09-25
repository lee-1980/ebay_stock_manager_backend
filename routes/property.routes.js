import express from "express";

import {
    getAllProperties,
    updateSetting,
} from "../controllers/property.controller.js";

const router = express.Router();

router.route("/").get(getAllProperties);
router.route("/updateSetting" ).post(updateSetting);
export default router;
