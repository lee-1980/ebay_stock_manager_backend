import express from "express";

import {
    getAllProperties,
    serverOnAndOff
} from "../controllers/property.controller.js";

const router = express.Router();

router.route("/").get(getAllProperties);
router.route( "/serverOnAndOff" ).post(serverOnAndOff);

export default router;
