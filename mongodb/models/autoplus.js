import mongoose from "mongoose";

const PropertySchema = new mongoose.Schema({
    item_number: { type: String, required: true },
    csku: { type: String, required: true },
    fsku: { type: String, required: true },
    combined: { type: Boolean, required: true },
});

const propertyModel = mongoose.model("autoplus", PropertySchema);

export default propertyModel;
