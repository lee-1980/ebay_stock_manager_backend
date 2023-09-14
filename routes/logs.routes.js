import express from "express";

import {
    readLog,
    deleteLog
} from "../controllers/log.controller.js";

const router = express.Router();

router.route("/").get(readLog);
router.route("/:id").delete(deleteLog);

export default router;
