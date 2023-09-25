import eBayApi from "ebay-api";
import * as dotenv from "dotenv";
import Property from "../mongodb/models/property.js";
import Autoplus from "../mongodb/models/autoplus.js";
import Febest from "../mongodb/models/febest.js";
import readline from "readline";
import { writeLog } from "../controllers/log.controller.js";
import { storeList } from "./constant.js";

dotenv.config();


// this function is used to regroup the original array into a new array of sub arrays of 25 items each.
const regroupArray = (array) => {
    let regroupedArray = [];
    while (array.length > 0) {
        regroupedArray.push(array.splice(0, 4));
    }
    return regroupedArray;
}

// get the rows from database and return them as an array
const getRows = (model, condition, reference) => {
    return new Promise((resolve, reject) => {
        model.find(condition, (err, rows) => {
            if (err) reject(err);
            let autoPartsData = [];
            rows.forEach( (item, index) => {
                autoPartsData.push({
                    qty: reference[item.csku],
                    sku: item.csku,
                    item_number: item.item_number,
                });
                if (index === rows.length - 1) resolve(autoPartsData);
            });
            if (rows.length === 0) resolve([]);
        })
    })
}


// initialize ebay Instance
export const initializeEbay = () => {
    let ebayInstance = new eBayApi({
        appId: process.env.EBAY_APP_ID,
        certId: process.env.EBAY_CERT_ID,
        ruName: process.env.EBAY_RUNAME,
        devId: process.env.EBAY_DEV_ID,
        sandbox: false,
    });

    ebayInstance.OAuth2.setScope([
        'https://api.ebay.com/oauth/api_scope',
        'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly',
        'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
        'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
        'https://api.ebay.com/oauth/api_scope/sell.inventory',
    ])

    return ebayInstance;
}

// Get the access token from MongoDB database and return it, Else generate a new one
export const getAuthToken = (instance, tokenName, store) => {
    return new Promise(async (resolve, reject) => {
        try {
            // Step 1: Obtain a user access token from MongoDB database
            const property = await Property.findOne({title: tokenName});

            let token = null;

            if (property && property.description) {
                // Here need to check if the token is expired
                token = JSON.parse(property.description);
                resolve(token);
                return;
            }

            // Step 2: Obtain an Authorization URL and Code

            const url = await instance.OAuth2.generateAuthUrl();

            console.log(`Authorize this app by visiting this url for ${store} Store:`, url);

            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
            });

            rl.question('Enter the code from that page here (from the url query ?code=) : ', async (code) => {
                rl.close();
                code = decodeURIComponent(code);
                console.log('Enter code', code);
                const token = await instance.OAuth2.getToken(code);
                await Property.updateOne({title: tokenName}, {
                    description: JSON.stringify(token),
                    updated_at: new Date()
                }, {upsert: true});

                writeLog({
                    type: 'info',
                    description: `${tokenName} is regenerated!`,
                    date: new Date().toISOString()
                })

                resolve(token)
            });

        } catch (error) {
            reject(error.message)
        }
    })
}

// Function to fetch eBay orders

export const fetchEBayOrders = async () => {
    return new Promise(async (resolve, reject)=>{
        try {
            // Get the last API call time
            let lastAPICallRecord = await Property.findOne({title: 'lastAPICallTime'});
            let lastAPICallTime;

            if (!lastAPICallRecord || lastAPICallRecord.description == null) {
                let date = new Date();
                date.setDate(date.getDate() - 1);
                lastAPICallTime = date;
            } else {
                lastAPICallTime = lastAPICallRecord.description
            }

            let ebayStores = {};
            // Loop ebay stores

            for (const store of storeList) {

                ebayStores[store.title] = {
                    instance: initializeEbay(),
                    token: '',
                    result: []
                }
                // Authenticate and obtain anc access token
                ebayStores[store.title].token = await getAuthToken(ebayStores[store.title].instance, store.storeTokenName, store.title);

                ebayStores[store.title].instance.OAuth2.setCredentials(ebayStores[store.title].token);

                ebayStores[store.title].instance.OAuth2.on('refreshAuthToken', async (token) => {
                    await Property.updateOne({title: store.storeTokenName}, {
                        description: JSON.stringify(token),
                        updated_at: new Date()
                    }, {upsert: true});

                    writeLog({
                        type: 'info',
                        description: `eBay ${store.title} token refreshed!`,
                        date: new Date().toISOString()
                    })

                })

                // Handle and process the fetched orders (parse response.data)
                ebayStores[store.title].result = await ebayStores[store.title].instance.sell.fulfillment.getOrders({
                    filter: 'creationdate:[' + new Date(lastAPICallTime).toISOString() + '..]',
                });

                // Implement order processing logic here
                console.log(`Fetched ${ebayStores[store.title].result.orders.length} eBay orders From ${store.title} Store.`);

                writeLog({
                    type: 'info',
                    description : ` New ${ebayStores[store.title].result.orders.length} ebay orders from ${store.title} store`,
                    date: new Date().toISOString()
                })

            }

            //save the last API call time

            await Property.updateOne({title: 'lastAPICallTime'}, {description: new Date().toISOString()}, {upsert: true});

            resolve(ebayStores);

        } catch (error) {
            console.log(error.message)
            reject('Error fetching eBay orders:', error.message)
        }
    })
}



export const postStockChangesToEbay = (stockChanges) => {
    return new Promise (async ( resolve , reject) => {
        try {
            let stockObj = {};
            let ebayStores = {};

            let SKUList = stockChanges.map( item => {
                stockObj[item.SKU] = item.QTY;
                return { 'csku' : item.SKU }
            });
            // AutoParts
            let autoPartsData = await getRows(Autoplus, { $or : SKUList }, stockObj)

            // Febest
            let febestData = await getRows(Febest, { $or : SKUList }, stockObj)

            // Loop ebay stores

            for (const store of storeList) {

                ebayStores[store.title] = {
                    instance: initializeEbay(),
                    token: '',
                }
                // Authenticate and obtain anc access token
                ebayStores[store.title].token = await getAuthToken(ebayStores[store.title].instance, store.storeTokenName, store.title);

                ebayStores[store.title].instance.OAuth2.setCredentials(ebayStores[store.title].token);

                ebayStores[store.title].instance.OAuth2.on('refreshAuthToken', async (token) => {
                    await Property.updateOne({title: store.storeTokenName}, {
                        description: JSON.stringify(token),
                        updated_at: new Date()
                    }, {upsert: true});

                    writeLog({
                        type: 'info',
                        description: `eBay ${store.title} token refreshed!`,
                        date: new Date().toISOString()
                    })
                })
                // handle data and post to ebay
                let dataSource = store.title === 'AutoParts' ? autoPartsData : febestData;
                let rearrangedStockChanges = regroupArray(dataSource);

                for ( let i = 0 ; i < rearrangedStockChanges.length ; i++ ) {
                    let subGroup = rearrangedStockChanges[i];

                    try{
                        // Handle and process the fetched orders (parse response.data)
                        let result = await ebayStores[store.title].instance.trading.ReviseInventoryStatus({
                            InventoryStatus: subGroup.map((item)=>{
                                return {
                                    ItemID: item.item_number,
                                    Quantity: item.qty
                                }
                            })
                        });

                        console.log(result, store.title)
                    }
                    catch (e) {
                        console.log(e.message, store.title)
                    }
                }

                // Implement order processing logic here
                console.log(`Posted ${dataSource.length} eBay orders From ${store.title} Store.`);

                writeLog({
                    type: 'info',
                    description : ` Post ${dataSource.length} Items' stock Change to ${store.title} store`,
                    date: new Date().toISOString()
                })
            }
            resolve()
        }
        catch (e) {
            console.log(e.message)
            reject(e.message)
        }
    })
}

