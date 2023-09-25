import express from "express";

import {
    createAutoplus,
    deleteAutoplus,
    deleteAllAutoplus,
    getAllAutopluses,
    getAutoplusDetail,
    updateAutoplus,
} from "../controllers/auto.controller.js";

const router = express.Router();

router.route("/").get(getAllAutopluses);
router.route("/:id").get(getAutoplusDetail);
router.route("/").post(createAutoplus);
router.route("/:id").patch(updateAutoplus);
router.route("/:id").delete(deleteAutoplus);
router.route("/deleteAll").post(deleteAllAutoplus);

export default router;
