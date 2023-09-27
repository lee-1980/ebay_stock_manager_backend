import eBayApi from "ebay-api";
import * as dotenv from "dotenv";
import Property from "../mongodb/models/property.js";
import Autoplus from "../mongodb/models/autoplus.js";
import Febest from "../mongodb/models/febest.js";
import readline from "readline";
import { writeLog } from "../controllers/log.controller.js";
import { storeList } from "./constant.js";
import {postSalesOrder} from "./datapel.js";

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

// Prepare SalesLine
const getSaleLinesPerOrder = (lineItems, saleReference) => {
    return new Promise((resolve) => {
        let saleLines = [];
        if (!Array.isArray(lineItems) || lineItems.length === 0) resolve(saleLines);
        lineItems.forEach( (item, index) => {
            try{
                saleLines.push({
                    "SKU": item.sku,
                    "SaleUnitQty": item.quantity,
                    "SaleTaxByHost": "N",
                    "SalePriceByHost": "N",
                    "SaleTaxCode": "GST",
                    "SaleUnitAmountIncTax": item.lineItemCost.value,
                    "SaleTaxRate": 10.00,
                    // need to get the price without tax, so divide by 1.1 and get the value until decimal digit 2
                    "SaleUnitAmountExcTax": (parseFloat(item.lineItemCost.value) / 1.1).toFixed(2),
                    "SaleTaxUnitAmount": (parseFloat(item.lineItemCost.value) - (parseFloat(item.lineItemCost.value) / 1.1)).toFixed(2),
                    "SKUDescription": saleReference,
                });

                if(lineItems.length - 1 === index) {
                    resolve(saleLines);
                }
            }
            catch (e) {
                console.log(e.message)
            }
        });
    })
}

const addFreightLine = (saleLines) => {
    return new Promise ((resolve) => {
        let freightSaleIncTax = 0;
        let freightSaleExcTax = 0;
        saleLines.forEach( (item, index) => {
            freightSaleIncTax += parseFloat(item.SaleUnitAmountIncTax) * item.SaleUnitQty;
            freightSaleExcTax += parseFloat(item.SaleUnitAmountExcTax) * item.SaleUnitQty;
            if (index === saleLines.length - 1) {
                saleLines.push({
                    "SKU": "FREIGHT",
                    "SaleUnitQty": 1,
                    "SaleTaxByHost": "N",
                    "SalePriceByHost": "N",
                    "SaleTaxCode": "GST",
                    "SaleUnitAmountIncTax": freightSaleIncTax.toFixed(2),
                    "SaleTaxRate": 10.00,
                    "SaleUnitAmountExcTax": freightSaleExcTax.toFixed(2),
                    "SaleTaxUnitAmount": (freightSaleIncTax - freightSaleExcTax).toFixed(2),
                    "SKUDescription": "Combined Freight",
                });
                resolve(saleLines);
            }
        })
    })
}

const getSaleLines = (orderList) => {
    return new Promise(async (resolve) =>{

        let saleLines = [];
        if(Array.isArray(orderList) && orderList.length === 0) resolve(saleLines);

        for (let i = 0; i < orderList.length; i++) {
            try {
                let saleLinesPerOrder = await getSaleLinesPerOrder(orderList[i].lineItems, orderList[i].salesRecordReference);
                saleLines = saleLines.concat(saleLinesPerOrder);
                if (orderList.length - 1 === i) {
                    saleLines = await addFreightLine(saleLines);
                    resolve(saleLines);
                }
            } catch (e) {
                console.log(e.message)
            }
        }

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
            console.log(error.message, 'getAuthToken')
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
                lastAPICallTime = lastAPICallRecord.description;
            }

            let ebayStores = {};
            let ebayOrders = {}
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
                    limit: 200
                });


                // Implement order processing logic here
                ebayOrders[store.title] = ebayStores[store.title].result.orders;
                if(ebayStores[store.title].result.total > 200 ){
                    let loop = Math.ceil(ebayStores[store.title].result.total / 200);
                    for(let i = 2; i <= loop; i++){
                        let orders = await ebayStores[store.title].instance.sell.fulfillment.getOrders({
                            filter: 'creationdate:[' + new Date(lastAPICallTime).toISOString() + '..]',
                            limit: 200,
                            offset: (i-1) * 200,
                            sort: 'creationdate:asc',
                        });

                        ebayOrders[store.title] = ebayOrders[store.title].concat(orders.orders);
                    }
                }

                console.log(`Fetched ${ebayOrders[store.title].length} eBay orders From ${store.title} Store.`);

                writeLog({
                    type: 'info',
                    description : ` New ${ebayOrders[store.title].length} ebay orders from ${store.title} store`,
                    date: new Date().toISOString()
                })

            }

            //save the last API call time

            await Property.updateOne({title: 'lastAPICallTime'}, {description: new Date().toISOString()}, {upsert: true});

            resolve(ebayOrders);

        } catch (error) {
            console.log(error.message, 'fetchEBayOrders')
            reject('Error fetching eBay orders:', error.message)
        }
    })
}

export const postOrders = (orders) => {
    return new Promise(async (resolve, reject)=>{
        try{
            const currentDateTime = new Date();
            const formattedDate = currentDateTime.toLocaleString("en-US", {month: 'short'}) + '-' + currentDateTime.getDate()  + '-' + currentDateTime.getFullYear()

            for (const store of storeList) {
                let storeOrders = orders[store.title];
                // filter orders with Payment status as PAID
                storeOrders = storeOrders.filter(order => order.orderPaymentStatus === 'PAID');

                // get the saleLines from the orders
                let saleLines = await getSaleLines(storeOrders);
                //configure the ebay sales order data object
                let uniqueSerialNumber = Math.round(Date.now()/1000 * 60);
                let ebaySalesOrderData = {
                    NewDataSet : {
                        tREMOTETransHeader : {
                            RevisionNumber: '1',
                            Company_ID : 'DATAPEL',
                            ShippingMethod : 'Best Way',
                            StoreCode: 'MELB',
                            PostingDate: currentDateTime.toISOString(),
                            Status: 'O',
                            MYOBCardName: store.myOBName,
                            Special2: `${formattedDate}-${store.purchaseOrderName}-${uniqueSerialNumber}`,
                            Notes: `We appreciate your business.`,
                            ShipNote: `We appreciate your business.`,
                            ShippingNote: `We appreciate your business.`,
                            Salesperson: 'Zdraveski, Steven',
                            Priority: 'NORMAL',
                        },
                        tREMOTETransSaleLines: saleLines
                    }
                }
                // console.log(ebaySalesOrderData, store.title)
                let response = await postSalesOrder(ebaySalesOrderData)
                console.log(response.data, store.title)
            }
            resolve()
        }
        catch(error){
            console.log(error.message, 'postOrders')
            reject(error.message)
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

