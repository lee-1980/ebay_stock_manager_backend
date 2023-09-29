import express from "express";

import {
    getAllOrders,
    deleteOrder,
    deleteAllOrders
} from "../controllers/order.controller.js";

const router = express.Router();

router.route("/").get(getAllOrders);
router.route("/:id").delete(deleteOrder);
router.route("/deleteAll").post(deleteAllOrders);

export default router;