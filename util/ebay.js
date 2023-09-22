import eBayApi from "ebay-api";
import * as dotenv from "dotenv";
import Property from "../mongodb/models/property.js";
import readline from "readline";
import {writeLog} from "../controllers/log.controller.js";

dotenv.config();

// initialize ebay Instance
export const initializeEbay = () => {
    let ebayInstance = new eBayApi({
        appId: process.env.EBAY_APP_ID,
        certId: process.env.EBAY_CERT_ID,
        ruName: process.env.EBAY_RUNAME,
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
export const getAuthToken =  (store) => {
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
                    await Property.updateOne({title: 'eBayProAutoPartsAccessToken'}, {description: JSON.stringify(token), updated_at: new Date().toISOString()}, {upsert: true});
                    resolve(token)
                });

                writeLog({
                    type: 'info',
                    description : 'eBayProAutoPartsAccessToken is regenerated!',
                    date: new Date().toISOString()
                })

            } else {

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
                    await Property.updateOne({title: 'eBayProFeBestAccessToken'}, {description: JSON.stringify(token), updated_at: new Date().toISOString()}, {upsert: true});
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

//

