import {Server} from "socket.io";

let globalSocket;

export const configureSocket = (expressServer) => {
    const io = new Server(expressServer, {
        cors: {
            origin: "*",
        }
    })

    io.on("connection", (socket) => {
        console.log(`User ${socket.id} connected`)
        globalSocket = socket;
        socket.on("disconnect", () => {
            console.log("User disconnected");
        });
    })
}

export const getSocketInstance = () => {
    return globalSocket;
}
