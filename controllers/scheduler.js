// Import required packages
import schedule  from 'node-schedule';

import Property from "../mongodb/models/property.js";
import { writeLog } from "./log.controller.js";
import { fetchEBayOrders, postStockChangesToEbay, postOrders} from "../util/ebay.js";
import { timeConverter} from "../util/timeConverter.js";
import { getStockChanges , calculateStockChanges} from "../util/datapel.js";


// Function to post new orders of ebay to Datapel WMS

const postNewOrdersToWMS = () => {
    return new Promise(async (resolve)=> {
        try{
            // Get the eBay Orders
            let ebayOrders = await fetchEBayOrders();
            // Calculate the orders for Custom Label Kits to be posted to Datapel WMS
            // await postOrders(ebayOrders);
            // Post the orders to Datapel WMS
            resolve();
        }
        catch (e) {
            writeLog({
                type: 'Error',
                description : 'Error fetching eBay orders:' + e.message,
                date: new Date().toISOString()
            })
            resolve();
        }
    })
}

// Function to sync Stock changes of DataPel WMS to eBay

const stockSync =  () => {
    return new Promise(async (resolve)=>{
        try{
            console.log('stock sync');
            // Get the Stock Changes from Datapel WMS
            let stockChanges = await getStockChanges();

            // Calculate the Stock Changes to be posted to eBay
            let calculatedStockChanges = await calculateStockChanges(stockChanges);

            // Post the Stock Changes to eBay
            await postStockChangesToEbay(calculatedStockChanges);
            resolve();
        }
        catch (e) {
            writeLog({
                type: 'Error',
                description : 'ERROR in StockSync :' + e.message,
                date: new Date().toISOString()
            })
        }

    })
}

const runner = async () => {

    // get the Server Status

    const serverStatus = await Property.findOne({title: 'systemOnOff'});

    if (serverStatus && serverStatus.description == 'true') {

        await postNewOrdersToWMS();
        // await stockSync();
    }
}

// Schedule order fetching (e.g., every 30 minutes)
const run_scheduler = async () => {
    let time_at = '00:00:01';

    // Get the Run Time from Database Setting
    let runTime = await Property.findOne({title: 'runTime'});
    if (runTime && runTime.description !== null) {
        time_at = runTime.description;
    }
    console.log(time_at);
    schedule.scheduleJob(timeConverter(time_at), runner);
}


export default run_scheduler;

