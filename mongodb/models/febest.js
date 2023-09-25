import mongoose from "mongoose";

const PropertySchema = new mongoose.Schema({
    item_number: { type: String, required: true },
    csku: { type: String, required: true },
    fsku: { type: String, required: true },
    combined: { type: Boolean, required: true },
});

const febestModel = mongoose.model("febest", PropertySchema);

export default febestModel;
