import Febest from "../mongodb/models/febest.js";
import mongoose from "mongoose";

const getAllFebests = async (req, res) => {

    const {
        _end,
        _order,
        _start,
        _sort,
        item_number_like = "",
    } = req.query;

    let query = {};


    if (item_number_like) {

        query = {
            $or: [
                {
                    csku: {$regex: item_number_like, $options: "i"}
                },
                {
                    item_number: {$regex: item_number_like, $options: "i"}
                }
            ]
        }
    }

    try {
        const count = await Febest.countDocuments({ query });
        const properties = await Febest.find(query)
            .limit(_end - _start)
            .skip(_start)
            .sort({ ['item_number']: 'asc' });

        res.header("x-total-count", count);
        res.header("Access-Control-Expose-Headers", "x-total-count");

        res.status(200).json(properties);

    } catch (error) {

        res.status(500).json({ message: error.message });

    }
};

const getFebestDetail = async (req, res) => {

    const { id } = req.params;
    const propertyExists = await Febest.findOne({ _id: id })

    if (propertyExists) {
        res.status(200).json(propertyExists);
    } else {
        res.status(404).json({ message: "Febest not found" });
    }

};

const createFebest = async (req, res) => {
    try {
        const {
            item_number,
            csku,
            fsku,
            combined
        } = req.body;


        await Febest.create({
            item_number,
            csku,
            fsku,
            combined
        });

        res.status(200).json({ message: "Febest created successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateFebest = async (req, res) => {
    try {
        const { id } = req.params;
        const { item_number, csku, fsku, combined} =
            req.body;

        await Febest.findByIdAndUpdate(
            { _id: id },
            {
                item_number,
                csku,
                fsku,
                combined
            },
        );

        res.status(200).json({ message: "Febest updated successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteFebest = async (req, res) => {
    try {
        const { id } = req.params;

        const propertyToDelete = await Febest.findById({ _id: id })

        if (!propertyToDelete) throw new Error("Febest not found");

        propertyToDelete.remove();

        res.status(200).json({ message: "Febest deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteAllFebests = async (req, res) => {
    try {
        const { verify } = req.body;

        if( verify !== process.env.KEY ) throw new Error("Invalid Request");
        await mongoose.connection.collection("febests").drop();
        res.status(200).json({ message: "All Febests deleted successfully" });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

export {
    getAllFebests,
    getFebestDetail,
    createFebest,
    updateFebest,
    deleteFebest,
    deleteAllFebests
};
