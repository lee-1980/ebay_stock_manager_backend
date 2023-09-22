// Import required packages
import axios from 'axios';
import schedule  from 'node-schedule';
import eBayApi from "ebay-api";
import * as dotenv from "dotenv";
import readline from "readline";

// Import Property model
import Property from "../mongodb/models/property.js";
import { writeLog } from "./log.controller.js";
import { initializeEbay, getAuthToken} from "../util/ebay.js";
import { timeConverter} from "../util/timeConverter.js";

// eBay API credentials

let eBayAutoParts = initializeEbay()

let eBayFeBest = initializeEbay()


// Function to fetch eBay orders
async function fetchEBayOrders() {
    try {
        // Get the last API call time
        let lastAPICallRecord = await Property.findOne({title: 'lastAPICallTime'});
        let lastAPICallTime;
        if (!lastAPICallRecord || lastAPICallRecord.description == null) {
            let date = new Date();
            date.setMinutes(date.getMinutes() - 3000);
            lastAPICallTime = date;
        } else {
            lastAPICallTime = lastAPICallRecord.description
        }

        writeLog({
            type: 'info',
            description : 'Trying to fetch eBay orders',
            date: new Date().toISOString()
        })

        // --- Start FeBest Store Area ---

        // writeLog({
        //     type: 'info',
        //     description : ` New ${result.orders.length} ebay orders from AutoParts store`,
        //     date: new Date().toISOString()
        // })

        // --- End FeBest Store Area ---

        // --- Start AutoParts Store Area ---c

        // Authenticate and obtain anc access token
        let eBayAutoPartsAccessToken = await getAuthToken('AutoParts');

        eBayAutoParts.OAuth2.setCredentials(eBayAutoPartsAccessToken);

        console.log(lastAPICallTime)
        // Handle and process the fetched orders (parse response.data)
        // const result = await eBayAutoParts.sell.fulfillment.getOrders({
        //     filter: 'creationdate:[' + new Date(lastAPICallTime).toISOString() + '..]',
        // });
        const result = await eBayAutoParts.sell.fulfillment.getOrders({
            filter: 'creationdate:[2023-09-20T11:47:05.000Z..2023-09-21T11:47:05.000Z]',
        });

        // Implement order processing logic here
        console.log(`Fetched ${result.orders.length} eBay orders From AutoParts Store.`);

        console.log(result.orders[0]);

        writeLog({
            type: 'info',
            description : ` New ${result.orders.length} ebay orders from AutoParts store`,
            date: new Date().toISOString()
        })
        // --- End AutoParts Store Area ---

        //save the last API call time
        lastAPICallTime = new Date();
        lastAPICallTime.setDate(lastAPICallTime.getDate() - 1);
        await Property.updateOne({title: 'lastAPICallTime'}, {description: lastAPICallTime.toISOString()}, {upsert: true});

    } catch (error) {
        console.error('Error fetching eBay orders:', error.message);

        writeLog({
            type: 'Error',
            description : 'Error fetching eBay orders:' + error.message,
            date: new Date().toISOString()
        })
    }
}

// Function to post new orders of ebay to Datapel WMS

const postNewOrdersToWMS = async () => {
    console.log('post new orders to WMS');
}

// Function to sync Stock changes of DataPel WMS to eBay

const stockSync =  () => {
    console.log('stock sync');
}


// test function
const testfunction = () => {
    // console.log(new Date());
}

// Schedule order fetching (e.g., every 30 minutes)
const run_scheduler = async () => {
    // test the schedule:


    let time_at = '00:00:01';

    // Get the Run Time from Database Setting
    let runTime = await Property.findOne({title: 'runTime'});
    if (runTime && runTime.description !== null) {
        time_at = runTime.description;
    }
    console.log(time_at);
    schedule.scheduleJob(timeConverter(time_at), postNewOrdersToWMS);
    schedule.scheduleJob(timeConverter(time_at), stockSync);
}


export default run_scheduler;

// Example: Update item stock (replace with actual item numbers and quantities)
//updateItemStock('YOUR_ITEM_NUMBER', 50);
