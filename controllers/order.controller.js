import Order from "../mongodb/models/order.js";
import mongoose from "mongoose";

const getAllOrders = async (req, res) => {

    const {
        _end,
        _start,
        item_number_like = "",
    } = req.query;

    let query = {};


    if (item_number_like) {
        query = { orderId: {$regex: item_number_like, $options: "i"}}
    }

    try {
        const count = await Order.countDocuments({ query });
        const properties = await Order.find(query)
            .limit(_end - _start)
            .skip(_start)
            .sort({ ['date']: 'desc' });

        res.header("x-total-count", count);
        res.header("Access-Control-Expose-Headers", "x-total-count");

        res.status(200).json(properties);

    } catch (error) {

        res.status(500).json({ message: error.message });

    }
};

const deleteOrder = async (req, res) => {
    try {
        const { id } = req.params;

        const propertyToDelete = await Order.findById({ _id: id })

        if (!propertyToDelete) throw new Error("Order not found");

        propertyToDelete.remove();

        res.status(200).json({ message: "Order deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteAllOrders = async (req, res) => {
    try {
        const { verify } = req.body;

        if( verify !== process.env.KEY ) throw new Error("Invalid Request");
        await mongoose.connection.collection("orders").drop();
        res.status(200).json({ message: "All Orders deleted successfully" });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

export {
    getAllOrders,
    deleteOrder,
    deleteAllOrders
};
