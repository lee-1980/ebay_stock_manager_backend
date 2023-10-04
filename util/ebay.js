import eBayApi from "ebay-api";
import * as dotenv from "dotenv";
import Property from "../mongodb/models/property.js";
import Autoplus from "../mongodb/models/autoplus.js";
import Febest from "../mongodb/models/febest.js";
import Order from "../mongodb/models/order.js";
import readline from "readline";
import { writeLog } from "../controllers/log.controller.js";
import { storeList } from "./constant.js";
import {postSalesOrder} from "./datapel.js";
import {testItemList} from "../log/request1.js";

dotenv.config();

let ebayCustomKits = {
    AutoParts: {},
    FeBest: {},
}
let ebayOrdersFilter = {
    AutoParts: [],
    FeBest: [],
}

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
            if (rows === undefined|| rows.length === 0) resolve([]);

            let autoPartsData = [];
            rows.forEach( (item, index) => {
                autoPartsData.push({
                    qty: reference[item.csku],
                    sku: item.csku,
                    item_number: item.item_number,
                });
                if (index === rows.length - 1) resolve(autoPartsData);
            });

        })
    })
}

// Prepare SalesLine
const getSaleLinesPerOrder = (lineItems, saleReference, store) => {
    return new Promise((resolve) => {
        let saleLines = [];
        if (!Array.isArray(lineItems) || lineItems.length === 0) resolve(saleLines);
        lineItems.forEach( async (item, index) => {
            try{
                let shippingCost = item.deliveryCost && item.deliveryCost.hasOwnProperty('shippingCost')? parseFloat(item.deliveryCost.shippingCost.value) : 0;
                let handlingCost = item.deliveryCost && item.deliveryCost.hasOwnProperty('handlingCost')? parseFloat(item.deliveryCost.handlingCost.value) : 0;

                if(ebayCustomKits[store].hasOwnProperty(item.sku)) {
                    let subItemPriceInc = parseFloat(item.lineItemCost.value) / ebayCustomKits[store][item.sku]['qty'];
                    let subItemPostage = (shippingCost + handlingCost) / ebayCustomKits[store][item.sku]['qty'];
                    for (const [key, value] of Object.entries(ebayCustomKits[store][item.sku])) {
                        if (key === 'qty') continue;
                        saleLines.push({
                            "SKU": key,
                            "SaleUnitQty": value * item.quantity,
                            "SaleTaxByHost": "N",
                            "SalePriceByHost": "N",
                            "SaleTaxCode": "GST",
                            "SaleUnitAmountIncTax": subItemPriceInc.toFixed(2),
                            "SaleTaxRate": 10.00,
                            // need to get the price without tax, so divide by 1.1 and get the value until decimal digit 2
                            "SaleUnitAmountExcTax": (subItemPriceInc / 1.1).toFixed(2),
                            "SaleTaxUnitAmount": (subItemPriceInc - (subItemPriceInc / 1.1)).toFixed(2),
                            "SKUDescription": saleReference,
                            "PostageAmount": (subItemPostage * value).toFixed(2)
                        });
                    }
                }
                else{
                    let subItemPostage = shippingCost + handlingCost;
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
                        "PostageAmount": subItemPostage
                    });
                }

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

const getEbayCustomKits = (store) => {
    return new Promise(async (resolve)=>{
        try {
            // Get the Custom SKU combination from the database
            let customSkus = [];
            let storeKitData = {};

            if(store === 'FeBest') {
                customSkus = await Febest.find({combined: true});
            }
            else{
                customSkus = await Autoplus.find({combined: true});
            }

            if(customSkus.length === 0) resolve({});

            customSkus.forEach((item, index) => {

                storeKitData[item.csku] = {};
                storeKitData[item.csku]['qty'] = 0;
                try {
                    item.fsku.split('|').forEach((subItem) => {
                        if(subItem){
                            storeKitData[item.csku][subItem.split(';')[0]] = parseInt(subItem.split(';')[1]);
                            storeKitData[item.csku]['qty'] += parseInt(subItem.split(';')[1]);
                        }
                    });
                }
                catch (e) {
                    console.log(e.message, 'getEbayCustomKits')
                }

                if(index === customSkus.length - 1) resolve(storeKitData);
            })

        }
        catch (e) {
            console.log(e.message, 'getEbayCustomKits')
            resolve({})
        }
    })
}

const addFreightLine = (saleLines) => {
    return new Promise ((resolve) => {
        let freightSaleIncTax = 0;
        let freightSaleExcTax = 0;
        saleLines.forEach( (item, index) => {
            freightSaleIncTax += parseFloat(item.PostageAmount);
            delete item.PostageAmount;
            if (index === saleLines.length - 1) {
                freightSaleExcTax = (freightSaleIncTax / 1.1).toFixed(2);
                saleLines.push({
                    "SKU": "FREIGHT",
                    "SaleUnitQty": 1,
                    "SaleTaxByHost": "N",
                    "SalePriceByHost": "N",
                    "SaleTaxCode": "GST",
                    "SaleUnitAmountIncTax": freightSaleIncTax.toFixed(2),
                    "SaleTaxRate": 10.00,
                    "SaleUnitAmountExcTax": freightSaleExcTax,
                    "SaleTaxUnitAmount": (freightSaleIncTax - freightSaleExcTax).toFixed(2),
                    "SKUDescription": "Combined Freight",
                });
                resolve(saleLines);
            }
        })
    })
}

const getSaleLines = (orderList, store) => {
    return new Promise(async (resolve) =>{

        let saleLines = [];
        if(Array.isArray(orderList) && orderList.length === 0) resolve(saleLines);

        for (let i = 0; i < orderList.length; i++) {
            try {
                let saleLinesPerOrder = await getSaleLinesPerOrder(orderList[i].lineItems, orderList[i].salesRecordReference, store);
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
                // lastAPICallTime = '2023-10-03 03:00:11';
            }
            // Get all orders from database which are latest 2 months ago
            let d = new Date();
            d.setMonth(d.getMonth() - 3);
            let orders = await Order.find({date: {$gte: d}})

            // put orders into ebayOrdersFilter based on store
            orders.forEach(order => {
                if(!ebayOrdersFilter[order.store]) ebayOrdersFilter[order.store] = [];
                ebayOrdersFilter[order.store].push(order.orderId);
            })

            let ebayStores = {};
            let ebayOrders = {};
            // Loop ebay stores

            for (const store of storeList) {

                ebayStores[store.title] = {
                    instance: initializeEbay(),
                    token: '',
                    result: []
                };

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

                });

                // Handle and process the fetched orders (parse response.data)
                ebayStores[store.title].result = await ebayStores[store.title].instance.sell.fulfillment.getOrders({
                    filter: 'lastmodifieddate:[' + new Date(lastAPICallTime).toISOString() + '..],orderfulfillmentstatus:{FULFILLED|IN_PROGRESS}',
                    limit: 200
                });


                // Implement order processing logic here
                ebayOrders[store.title] = ebayStores[store.title].result.orders;
                // ebayOrders[store.title] = store.title === 'AutoParts' ?testItemList : [];

                if(ebayStores[store.title].result.total > 200 ){
                    let loop = Math.ceil(ebayStores[store.title].result.total / 200);
                    for(let i = 2; i <= loop; i++) {
                        let orders = await ebayStores[store.title].instance.sell.fulfillment.getOrders({
                            filter: 'lastmodifieddate:[' + new Date(lastAPICallTime).toISOString() + '..],orderfulfillmentstatus:{FULFILLED|IN_PROGRESS}',
                            limit: 200,
                            offset: (i-1) * 200,
                            sort: 'lastmodifieddate:asc',
                        });
                        ebayOrders[store.title] = ebayOrders[store.title].concat(orders.orders);
                    }
                }

                let newOrders = [];
                // remove orders which are already in database
                await new Promise((resolve, reject)=>{
                    resolve()
                })

                let filteredOrders = ebayOrders[store.title].filter(order => {
                    if (!ebayOrdersFilter[store.title].includes(order.orderId)){
                        newOrders.push({
                            orderId: order.orderId,
                            store: store.title,
                            saleReference: order.salesRecordReference,
                            date: order.lastModifiedDate,
                        });
                        return true
                    }
                    return false;
                })

                ebayOrders[store.title] = filteredOrders;
                // insert new orders into order database
                if(newOrders.length) await Order.insertMany(newOrders);

                console.log(`Fetched  ${ebayOrders[store.title].length} new eBay orders From ${store.title} Store.`);

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
                // let storeOrders = testItemList;
                // filter orders with Payment status as PAID
                // storeOrders = storeOrders.filter(order => order.orderPaymentStatus === 'PAID');
                if(storeOrders.length)
                    ebayCustomKits[store.title] = await getEbayCustomKits(store.title);

                // get the saleLines from the orders
                let saleLines = await getSaleLines(storeOrders, store.title);
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
                console.log(ebaySalesOrderData.NewDataSet.tREMOTETransSaleLines, store.title)
                if(saleLines.length > 0){
                    // let response = await postSalesOrder(ebaySalesOrderData)
                    // console.log(response.data, store.title)
                } else {
                    console.log('No orders to post', store.title)
                }
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
            let autoPartsData = stockChanges.length? await getRows(Autoplus, { $or : SKUList }, stockObj) : []

            // Febest
            let febestData = stockChanges.length? await getRows(Febest, { $or : SKUList }, stockObj): []

            console.log(stockChanges.length, autoPartsData.length, febestData.length, 'UpToDate Stock Data')
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
                let dataLength = dataSource.length;
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
                console.log(`Posted ${dataLength} Items' stock Change To ${store.title} Store.`);

                writeLog({
                    type: 'info',
                    description : ` Posted ${dataLength} Items' stock Change to ${store.title} store.`,
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

