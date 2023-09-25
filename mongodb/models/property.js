import mongoose from "mongoose";

const PropertySchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    updated_at: { type: Date, default: Date.now },
});

const propertyModel = mongoose.model("Setting", PropertySchema);

export default propertyModel;
