import express from "express";
import * as dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from 'url';

import connectDB from "./mongodb/connect.js";
import userRouter from "./routes/user.routes.js";
import propertyRouter from "./routes/property.routes.js";
import febestRouter from "./routes/febest.routes.js";
import autoplusRouter from "./routes/autoplus.routes.js";
import LogsRouter from "./routes/logs.routes.js";
import orderRouter from "./routes/order.routes.js";

import run_scheduler from "./controllers/scheduler.js";
import { configureSocket } from "./util/socket.js";
dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


app.use(cors());
app.use(express.json({ limit: "50mb" }));


app.use("/api/v1/users", userRouter);
app.use("/api/v1/home", propertyRouter);
app.use("/api/v1/Febest", febestRouter);
app.use("/api/v1/Autoplus", autoplusRouter);
app.use("/api/v1/logs", LogsRouter);
app.use("/api/v1/orders", orderRouter);

app.use(express.static(path.join(__dirname, 'build')));

app.get('/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});


const startServer = async () => {
    try {

        connectDB(process.env.MONGODB_URL, run_scheduler);
        const expressServer = app.listen(8000, () =>{
            console.log("Server started on port http://localhost:8000");
        });
        configureSocket(expressServer);

    } catch (error) {
        console.log(error);
    }
};

startServer();
