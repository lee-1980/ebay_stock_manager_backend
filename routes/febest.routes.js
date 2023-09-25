import express from "express";

import {
    createFebest,
    deleteFebest,
    deleteAllFebests,
    getAllFebests,
    getFebestDetail,
    updateFebest,
} from "../controllers/febest.controller.js";

const router = express.Router();

router.route("/").get(getAllFebests);
router.route("/:id").get(getFebestDetail);
router.route("/").post(createFebest);
router.route("/:id").patch(updateFebest);
router.route("/:id").delete(deleteFebest);
router.route("/deleteAll").post(deleteAllFebests);

export default router;
