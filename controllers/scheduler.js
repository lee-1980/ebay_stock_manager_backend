// Import required packages
import axios from 'axios';
import schedule  from 'node-schedule';
import eBayApi from "ebay-api";
import * as dotenv from "dotenv";
import readline from "readline";

// Import Property model
import Property from "../mongodb/models/property.js";
import { writeLog } from "./log.controller.js";


dotenv.config();
// eBay API credentials
let eBayAutoParts = new eBayApi({
    appId: process.env.EBAY_APP_ID,
    certId: process.env.EBAY_CERT_ID,
    ruName: process.env.EBAY_RUNAME,
    sandbox: false,
})

let eBayFeBest = new eBayApi({
    appId: process.env.EBAY_APP_ID,
    certId: process.env.EBAY_CERT_ID,
    ruName: process.env.EBAY_RUNAME,
    sandbox: false,
})


eBayAutoParts.OAuth2.setScope([
    'https://api.ebay.com/oauth/api_scope',
    'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly',
    'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
    'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
    'https://api.ebay.com/oauth/api_scope/sell.inventory',
])

eBayFeBest.OAuth2.setScope([
    'https://api.ebay.com/oauth/api_scope',
    'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly',
    'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
    'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
    'https://api.ebay.com/oauth/api_scope/sell.inventory',
])


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
            filter: 'creationdate:[2023-09-10T11:47:05.000Z..2023-09-10T11:47:05.000Z]',
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

// Function to update eBay item stock based on item number
async function updateItemStock(itemNumber, newQuantity) {
    try {
        // Make API request to update item stock using eBay Inventory API
        const response = await axios.put(
            `${eBayApiBaseUrl}/sell/inventory/v1/inventory_item/${itemNumber}`,
            {
                quantity: newQuantity,
            },
            {
                headers: {
                    'Authorization': `Bearer ${eBayAccessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        // Handle and process the response (check for success)

        console.log(`Updated stock for eBay item ${itemNumber} to ${newQuantity}.`);
    } catch (error) {
        console.error(`Error updating stock for eBay item ${itemNumber}:`, error);
    }
}


const getAuthToken =  (store) => {
    return new Promise(async (resolve, reject)=>{
        try {

            if( store == 'AutoParts' ) {
                // Step 1: Obtain a user access token from MongoDB database
                const property = await Property.findOne({title: 'eBayProAutoPartsAccessToken'});

                let token = null;

                if (property && property.description) {
                    // Here need to check if the token is expired
                    token = JSON.parse(property.description);
                    resolve(token);
                    return;
                }

                // Step 2: Obtain an Authorization URL and Code

                const url = await eBayAutoParts.OAuth2.generateAuthUrl();

                console.log('Authorize this app by visiting this url for AutoParts Store:', url);

                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout,
                });

                rl.question('Enter the code from that page here (from the url query ?code=) : ', async (code) => {
                    rl.close();
                    code = decodeURIComponent(code);
                    console.log('Enter code', code);
                    const token = await eBayAutoParts.OAuth2.getToken(code);
                    await Property.updateOne({title: 'eBayProAutoPartsAccessToken'}, {description: JSON.stringify(token)}, {upsert: true});
                    resolve(token)
                });

                writeLog({
                    type: 'info',
                    description : 'eBayProAutoPartsAccessToken is regenerated!',
                    date: new Date().toISOString()
                })

            } else{

                // Step 1: Obtain a user access token from MongoDB database
                const property = await Property.findOne({title: 'eBayProFeBestAccessToken'});
                let token = null;

                if (property && property.description) {
                    // Here need to check if the token is expired
                    token = JSON.parse(property.description);
                    resolve(token);
                    return;
                }

                // Step 2: Obtain an Authorization URL and Code

                const url = await eBayFeBest.OAuth2.generateAuthUrl();
                console.log('Authorize this app by visiting this url for FeBest Store:', url);

                const rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout,
                });

                rl.question('Enter the code from that page here (from the url query ?code=) : ', async (code) => {
                    rl.close();
                    code = decodeURIComponent(code);
                    console.log('Enter code', code);
                    const token = await eBayFeBest.OAuth2.getToken(code);
                    await Property.updateOne({title: 'eBayProFeBestAccessToken'}, {description: JSON.stringify(token)}, {upsert: true});
                    resolve(token)
                });

                writeLog({
                    type: 'info',
                    description : 'eBayProFeBestAccessToken is regenerated!',
                    date: new Date().toISOString()
                })
            }
        } catch (error) {
            reject(error.message)
        }
    })

}

// test function
const testfunction = () => {
    // console.log(new Date());
}

// Schedule order fetching (e.g., every 30 minutes)
const run_scheduler = () => {
    // test the schedule:
    // console.log('run scheduler');
    // schedule.scheduleJob('*/30 * * * * *', testfunction);
    // schedule.scheduleJob('*/30 * * * * *', fetchEBayOrders);
    // fetchEBayOrders();
}


export default run_scheduler;

// Example: Update item stock (replace with actual item numbers and quantities)
//updateItemStock('YOUR_ITEM_NUMBER', 50);
