
import axios from "axios";
import * as dotenv from "dotenv";
import Property from "../mongodb/models/property.js";
import Febest from "../mongodb/models/febest.js";
import Autoplus from "../mongodb/models/autoplus.js";
dotenv.config();

// this function is used to calculate the how many combined items we can make based on sub item's stock and  sub item count necessary per combined item.
// first parameter is the current stock array of sub items, second parameter is the array of sub item count necessary per combined item.
const calculateCombinedItemStock = (stock, subItemCount) => {
    let combinedItemStock = [];
    for (let i = 0; i < stock.length; i++) {
        combinedItemStock.push(Math.floor(stock[i] / subItemCount[i]));
    }
    return combinedItemStock.length? Math.min(...combinedItemStock) : 0;
}

const collectUniqueSKUs = (dataArray, stockObj) => {
    return new Promise((resolve) => {

        if(dataArray.length === 0) resolve({
            CustomSKUs: [],
            subItemStock: stockObj
        });

        let CustomSKUs = [];
        let subItemStock = stockObj;

        dataArray.forEach((item, index) => {

            let fSkuArray = {
                sku: [],
                stock: []
            };

            try {
                item.fsku.split('|').forEach((subItem) => {
                    if(subItem){
                        if(!subItemStock.hasOwnProperty(subItem.split(';')[0])) subItemStock[subItem.split(';')[0]] = 0
                        fSkuArray.sku.push(subItem.split(';')[0]);
                        fSkuArray.stock.push(subItem.split(';')[1]);
                    }
                });
            }
            catch (e) {
                console.log(e.message)
            }

            CustomSKUs.push({
                item_number: item.item_number,
                csku: item.csku,
                fsku: fSkuArray,
            });

            if(index === dataArray.length - 1) resolve({
                CustomSKUs,
                subItemStock
            });
        })
    })

}

const calculateCombinedItemStockChanges = (CustomSKUs, subItemCount) => {
    return new Promise((resolve, reject) => {
        try {
            let combinedItemStockChanges = [];

            CustomSKUs.forEach((item, index) => {
                let currentSubItemStock = [];
                item.fsku.sku.forEach((subItem) => {
                    currentSubItemStock.push(subItemCount[subItem]? subItemCount[subItem] : 0);
                });
                let itemCurrentStock = calculateCombinedItemStock(currentSubItemStock, item.fsku.stock);
                combinedItemStockChanges.push({
                    SKU: item.csku,
                    Name: item.csku,
                    QTY: itemCurrentStock
                })

                if(index === CustomSKUs.length - 1) resolve(combinedItemStockChanges)
            })
            if (CustomSKUs.length === 0) resolve(combinedItemStockChanges)
        }
        catch (e) {
            console.log(e.message, 'calculateCombinedItemStockChanges')
            reject(e.message)
        }
    })
}

export const getAuthTokenFromAPI = () => {
    return new Promise(async (resolve, reject)=>{
        try {

            const credential = new Buffer.from(process.env.DATEPEL_USERNAME + ':' + process.env.DATEPEL_PASSWORD).toString('base64');
            const response = await axios.get('https://febest.datapelapi.net/json/token', {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': credential
                }
            })
            resolve(response.data[0].token)
        }
        catch (e) {
            console.log(e.message, 'getAuthTokenFromAPI')
            reject(e.message)
        }
    })
}

export const getItemStockChanges = (url) => {
    return new Promise (async (resolve, reject) => {
        try {
            const credential = new Buffer.from(process.env.DATEPEL_USERNAME + ':' + process.env.DATEPEL_PASSWORD).toString('base64');

            const authToken = await getAuthToken();

            const response = await axios.get(url, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': credential,
                    'auth_token': authToken,
                }
            })
            resolve(response)
        }
        catch (e) {
            console.log(e.message, 'getItemStockChanges')
            reject(e.message)
        }
    })
}

export const postSalesOrder = (data) => {
    return new Promise(async (resolve, reject)=>{
        try{
            const credential = new Buffer.from(process.env.DATEPEL_USERNAME + ':' + process.env.DATEPEL_PASSWORD).toString('base64');

            const authToken = await getAuthToken();

            const response = await axios.post('https://febest.datapelapi.net/JSON/salesqueue?filter~',  JSON.stringify(data),{
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': credential,
                    'auth_token': authToken,
                }
            })
            resolve(response)
        }
        catch (e) {
            console.log(e.message, 'postSalesOrder')
            reject(e.message)
        }
    })
}

const getSubItemStocksFromAPI = (skuObj) => {
    return new Promise(async (resolve, reject)=>{
        try{

            let newSkuObj = {};
            let whereQuery = '';
            Object.entries(skuObj).forEach(([key, value], index ) => {
                whereQuery += `'${key}',`;
                newSkuObj[key] = value;
            });
            if (whereQuery) whereQuery = whereQuery.slice(0, -1);
            let stock = await getItemStockChanges(`https://febest.datapelapi.net/JSON/sql?filter~Select * from vOSS_ProductStock WHERE SKU IN (${whereQuery})`);

            if (stock.data.length === 0) throw new Error('No sub item stock qty data found in DataPel House');

            stock.data.forEach((item, index) => {
                newSkuObj[item.SKU] = item.QTY;
                if (index === stock.data.length - 1) resolve(newSkuObj);
            })
        }
        catch (e) {

            console.log(e.message, 'getSubItemStocksFromAPI')
            reject(e.message)

        }
    })
}

export const getAuthToken = () => {
    return new Promise (async ( resolve , reject ) => {
        try {

            let dataPel = await Property.findOne({title: 'datapelAccessToken'});

            // Token Time Validation
            if (dataPel && dataPel.description !== null) {
                let currentTime = new Date();
                let lastAPICallTime = new Date(dataPel.updated_at);
                let timeDiff = Math.abs(currentTime.getTime() - lastAPICallTime.getTime());
                let diffHours = Math.ceil(timeDiff / (1000 * 60 * 60));
                if (diffHours < 1) {
                    resolve(dataPel.description);
                    return  ;
                }
            }

            // Get New Token
            let datapelAccessToken = await getAuthTokenFromAPI();

            // Save New Token
            Property.updateOne({title: 'datapelAccessToken'}, { description: datapelAccessToken, updated_at: new Date() }, {upsert: true}, (err, res) => {
                if (err) {
                    reject(err.message);
                    return ;
                }
                resolve(datapelAccessToken);
            })

        }
        catch (e) {
            console.log(e.message, 'getAuthToken DataPel')
            reject(e.message)
        }
    })
}

export const getAvailableStock = (skuChangeList) => {
    return new Promise(async (resolve, reject)=>{

        const credential = new Buffer.from(process.env.DATEPEL_USERNAME + ':' + process.env.DATEPEL_PASSWORD).toString('base64');
        const authToken = await getAuthToken();
        let availableStockChanges = [];
        let url = 'https://febest.datapelapi.net/JSON/inventorylist?filter~itemnumber='

        for(let i = 0 ; i < skuChangeList.length; i ++){
            try{
                const response = await axios.get(`${url}'${skuChangeList[i].SKU}'`, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': credential,
                        'auth_token': authToken,
                    }
                })
                const data = response.data.inventorylist ? response.data.inventorylist : [];
                availableStockChanges.push(
                    {
                        SKU: skuChangeList[i].SKU,
                        QTY: data[0].availqty && data[0].availqty > 0? data[0].availqty : 0,
                    }
                )
            }
            catch (e) {
                console.log(e.message, 'getAvailableStock')
                continue;
            }
        }

        // console.log(availableStockChanges, 'availableChanges');
        resolve(availableStockChanges)
    })
}

export const calculateStockChanges = (stockChanges) => {
    return new Promise(async (resolve, reject) => {
        try {
            if(stockChanges.length === 0) resolve([]);
            let updatedStockChanges = await getAvailableStock(stockChanges);

            // Get the Custom SKU combination from the database
            // 1) From Febest
            let feBestCustomSKUs = await Febest.find({combined: true});
            // 2) From Autoplus
            let autoPlusCustomSKUs = await Autoplus.find({combined: true});
            autoPlusCustomSKUs = feBestCustomSKUs.concat(autoPlusCustomSKUs);

            // Collect the unique SKU of Sub Items which are used to make combined items
            let subItemStock = {}

            if(autoPlusCustomSKUs.length > 0) {
                let autoPlusMData = await collectUniqueSKUs(autoPlusCustomSKUs, subItemStock);
                subItemStock = autoPlusMData.subItemStock;
                autoPlusCustomSKUs = autoPlusMData.CustomSKUs;
            }

            // Check any stock changes of sub item
            let hasChanged = false;

            await new Promise((resolve) => {
                for (let i = 0; i < updatedStockChanges.length; i++) {
                    if(subItemStock.hasOwnProperty(updatedStockChanges[i].SKU)) {
                        hasChanged = true;
                        resolve();
                        break;
                    }
                    if (i === updatedStockChanges.length - 1) resolve();
                }
            })

            if(hasChanged){
                // Fill the stock changes of the combined items
                subItemStock = await getSubItemStocksFromAPI(subItemStock);

                // Calculate the stock changes of the combined items
                let additionalStockChanges = await calculateCombinedItemStockChanges(autoPlusCustomSKUs, subItemStock);

                // Merge the stock changes of the combined items with the stock changes of the single items
                updatedStockChanges = updatedStockChanges.concat(additionalStockChanges);
            }

            // resolve(stockChanges);
            resolve(updatedStockChanges);
        }
        catch (e) {
            console.log(e.message, 'calculateStockChanges')
            reject(e.message)
        }
    })
}

export const getStockChanges = () => {
    return new Promise (async ( resolve , reject) => {
        try {
            // Get the Datapel Cache ID
            let dataPel = await Property.findOne({title: 'datapelCacheID'});
            let url;

            if (dataPel && dataPel.description !== null) {
                let cacheID = dataPel.description;
                url = `https://febest.datapelapi.net/JSON/SQL?filter~Select%20*%20from%20vOSS_ProductStock%20WITH%20DIFF%20ON%20${cacheID}`;
            }
            else {
                url = `https://febest.datapelapi.net/JSON/SQL?filter~Select%20*%20from%20vOSS_ProductStock%20WITH%20CACHE`;
            }

            // Get the stock changes
            let stockChanges = await getItemStockChanges(url);
            // console.log(stockChanges.data, 'Chached data')
            let cacheObject = stockChanges.data.pop();
            // console.log(cacheObject)
            if(cacheObject.cacheid){
                // Update the Datapel Cache ID
                Property.updateOne({title: 'datapelCacheID'}, { description: cacheObject.cacheid, updated_at: new Date() }, {upsert: true}, (err, res) => {
                    if (err) {
                        reject(err.message);
                        return ;
                    }
                    resolve(stockChanges.data);
                })

            } else{
                console.log("No Cache ID")
                reject("No Cache ID")
            }
        }
        catch (e) {
            console.log(e.message, 'getStockChanges')
            reject(e.message)
        }
    })
}
