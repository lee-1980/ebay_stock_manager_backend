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

import run_scheduler from "./controllers/scheduler.js";
dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
console.log(__dirname)

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static(path.join(__dirname, 'build')));

app.get('/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.use("/api/v1/users", userRouter);
app.use("/api/v1/home", propertyRouter);
app.use("/api/v1/Febest", febestRouter);
app.use("/api/v1/Autoplus", autoplusRouter);
app.use("/api/v1/logs", LogsRouter);

const startServer = async () => {
    try {

        connectDB(process.env.MONGODB_URL, run_scheduler);
        app.listen(8000, () =>{
            console.log("Server started on port http://localhost:8000");
        });

    } catch (error) {
        console.log(error);
    }
};

startServer();
