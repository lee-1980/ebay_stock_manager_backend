import Property from "../mongodb/models/property.js";
import febest from "../mongodb/models/febest.js";
import autoplus from "../mongodb/models/autoplus.js";
import dayjs from "dayjs";

import * as dotenv from "dotenv";
import schedule from "node-schedule";
import {timeConverter} from "../util/timeConverter.js";

dotenv.config();


const getAllProperties = async (req, res) => {

    try {
        const febestCount = await febest.countDocuments();
        const autoplusCount = await autoplus.countDocuments();
        const settingSystemOnOff = await Property.findOne({ title : "systemOnOff" });
        const settingRunTime = await Property.findOne({ title : "runTime" });
        const lastSync = await Property.findOne({ title : "lastAPICallTime" });
        const serverOn = settingSystemOnOff ? (settingSystemOnOff.description == 'false' ? false : true) : false;
        const runTime = settingRunTime ? settingRunTime.description : '00:00:01';
        const lastSyncTime = lastSync ?dayjs(lastSync.description).format("YYYY-MM-DD HH:mm:ss") : '1970-01-01 00:00:01';

        res.status(200).json({
            febestCount,
            autoplusCount,
            serverOn,
            runTime,
            lastSyncTime
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateSetting = async (req, res) => {
    try {
        const { key, keyValue, verify } = req.body;

        if( verify !== process.env.KEY ) throw new Error("Invalid Request");

        const setting = await Property.findOne({ title : key });

        if(!setting) {
            Property.create({ title : key, description : keyValue});
        }
        else{
            setting.description = keyValue;
            setting.updated_at = Date.now();
            await setting.save();

            if (key === 'runTime') {
                Object.entries(schedule.scheduledJobs).forEach(([key, value]) => {
                    value.reschedule(timeConverter(keyValue));
                })
            }
        }

        res.status(200).json(keyValue);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}


export {
    getAllProperties,
    updateSetting
};
