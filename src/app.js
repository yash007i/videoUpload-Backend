import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

const app = express()

//midleware
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

//Config
app.use(express.json({
    limit: "16kb"
}))

app.use(express.urlencoded({
    extended: true,
    limit: "16kb"
}))

app.use(express.static("public")) // public assest exes by ever one

// Handle user cookies and perform CURD ope ration
app.use(cookieParser()) // pass cookie in req, res field


//routes
import userRouter from "./routes/user.routes.js"

// router decalration
app.use("/api/v1/users", userRouter)


export { app }