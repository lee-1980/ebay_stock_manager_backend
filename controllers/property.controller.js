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
        const settingStockTime = await Property.findOne({ title: "stockTime" });
        const settingStockATime = await Property.findOne({ title: 'stockTimeA'});
        const stockAOnOff = await Property.findOne({ title : "stockTimeAOnOff" });
        const settingStockBTime = await Property.findOne({ title: "stockTimeB" });
        const stockBOnOff = await Property.findOne({ title : "stockTimeBOnOff" });
        const lastSync = await Property.findOne({ title : "lastAPICallTime" });
        const stockAOn = stockAOnOff ? (stockAOnOff.description == 'false' ? false : true) : false;
        const stockBOn = stockBOnOff ? (stockBOnOff.description == 'false' ? false : true) : false;
        const serverOn = settingSystemOnOff ? (settingSystemOnOff.description == 'false' ? false : true) : false;
        const runTime = settingRunTime ? settingRunTime.description : '00:00:01';
        const lastSyncTime = lastSync ?dayjs(lastSync.description).format("YYYY-MM-DD HH:mm:ss") : '1970-01-01 00:00:01';
        const StockTime = settingStockTime ? settingStockTime.description : '00:00:01';
        const StockATime = settingStockATime ? settingStockATime.description : '00:00:01';
        const StockBTime = settingStockBTime ? settingStockBTime.description : '00:00:01';

        res.status(200).json({
            febestCount,
            autoplusCount,
            serverOn,
            runTime,
            lastSyncTime,
            StockTime,
            StockATime,
            StockBTime,
            stockAOn,
            stockBOn
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
                    if(key === 'o_time')
                    value.reschedule(timeConverter(keyValue));
                })
            }
            else if( key === 'stockTime'){
                Object.entries(schedule.scheduledJobs).forEach(([key, value]) => {
                    if(key === 's_time')
                    value.reschedule(timeConverter(keyValue));
                })
            }
            else if( key === 'stockTimeA'){
                Object.entries(schedule.scheduledJobs).forEach(([key, value]) => {
                    if(key === 's_timea')
                        value.reschedule(timeConverter(keyValue));
                })
            }
            else if( key === 'stockTimeB'){
                Object.entries(schedule.scheduledJobs).forEach(([key, value]) => {
                    if(key === 's_timeb')
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
