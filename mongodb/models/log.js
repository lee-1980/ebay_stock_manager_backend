import mongoose from "mongoose";

const LogSchema = new mongoose.Schema({
    type: { type: String, required: true },
    description: { type: String, required: true },
    date : { type: String, required: true }
});

const logModel = mongoose.model("Log", LogSchema);

export default logModel;
