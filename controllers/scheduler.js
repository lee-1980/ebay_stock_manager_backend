// Import required packages
import schedule  from 'node-schedule';

import Property from "../mongodb/models/property.js";
import { writeLog } from "./log.controller.js";
import { fetchEBayOrders, postStockChangesToEbay, postOrders} from "../util/ebay.js";
import { timeConverter} from "../util/timeConverter.js";
import { getStockChanges , calculateStockChanges} from "../util/datapel.js";
import {getSocketInstance}  from "../util/socket.js";
import { changes } from "../log/stockChanges.js";


// Function to post new orders of ebay to Datapel WMS

const postNewOrdersToWMS = () => {
    return new Promise(async (resolve)=> {
        try{
            let socketInstance = getSocketInstance();

            if(socketInstance) {
                socketInstance.emit('orderMessage', 'Start to fetch eBay Orders');
            }
            // Get the eBay Orders
            let ebayOrders = await fetchEBayOrders();
            // Calculate the orders for Custom Label Kits to be posted to Datapel WMS
            if(socketInstance) socketInstance.emit('orderMessage', 'Start to post eBay Orders to Datapel WMS');
            await postOrders(ebayOrders);
            // Post the orders to Datapel WMS
            if(socketInstance) socketInstance.emit('orderMessage', 'Finished posting eBay Orders to Datapel WMS');
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
            let socketInstance = getSocketInstance();

            if(socketInstance) {
                socketInstance.emit('stockMessage', 'Start to fetch Stock Changes from Datapel WMS');
            }
            // Get the Stock Changes from Datapel WMS
            let stockChanges = await getStockChanges();
            // let stockChanges = changes;
            // Calculate the Stock Changes to be posted to eBay
            let calculatedStockChanges = await calculateStockChanges(stockChanges);

            if(socketInstance) socketInstance.emit('stockMessage', 'Start to post Stock Changes to eBay');
            // Post the Stock Changes to eBay
            await postStockChangesToEbay(calculatedStockChanges);

            if(socketInstance) socketInstance.emit('stockMessage', 'Finished posting Stock Changes to eBay');
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

const o_runner = async () => {

    // get the Server Status

    const serverStatus = await Property.findOne({title: 'systemOnOff'});

    if (serverStatus && serverStatus.description == 'true') {
        console.log('PostOrder')
        await postNewOrdersToWMS();
    }
}

const s_runner = async () => {
    // get the Server Status

    const serverStatus = await Property.findOne({title: 'systemOnOff'});

    if (serverStatus && serverStatus.description == 'true') {
        console.log('StockSync')
        await stockSync();
    }
}


// Schedule order fetching (e.g., every 30 minutes)
const run_scheduler = async () => {
    let o_time_at = '00:00:01';
    let s_time_at = '00:00:01';
    // Get the Run Time from Database Setting
    let runTime = await Property.findOne({title: 'runTime'});
    let stockTime = await Property.findOne({title: 'stockTime'});
    if (runTime && runTime.description !== null) {
        o_time_at = runTime.description;
    }
    if (stockTime && stockTime.description !== null) {
        s_time_at = stockTime.description;
    }
    console.log(o_time_at, 'run time');
    console.log(s_time_at, 'stock time');
    schedule.scheduleJob('o_time', timeConverter(o_time_at), o_runner);
    schedule.scheduleJob('s_time', timeConverter(s_time_at), s_runner);
}


export default run_scheduler;

