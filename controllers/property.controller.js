import Property from "../mongodb/models/property.js";
import febest from "../mongodb/models/febest.js";
import autoplus from "../mongodb/models/autoplus.js";

import * as dotenv from "dotenv";

dotenv.config();


const getAllProperties = async (req, res) => {

    try {
        const febestCount = await febest.countDocuments();
        const autoplusCount = await autoplus.countDocuments();
        const setting = await Property.findOne({ title : "systemOnOff" });

        const serverOn = setting ? (setting.description == 0 ? false : true) : false;

        res.status(200).json({
            febestCount,
            autoplusCount,
            serverOn
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const serverOnAndOff = async (req, res) => {
    try {
        const { serverOn, verify } = req.body;

        if(verify !== process.env.KEY) throw new Error("Invalid Request");

        const setting = await Property.findOne({ title : "systemOnOff" });
        if(!setting) {
            Property.create({ title : "systemOnOff", description : serverOn ? 0 : 1 });
        }
        else{
            setting.description = serverOn ? 0 : 1;
            await setting.save();
        }

        res.status(200).json(serverOn);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

export {
    getAllProperties,
    serverOnAndOff
};
