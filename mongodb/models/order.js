import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema({
    orderId: { type: String, required: true },
    store: { type: String, required: true },
    date : { type: Date, required: true }
});

const orderModel = mongoose.model("Order", OrderSchema);

export default orderModel;