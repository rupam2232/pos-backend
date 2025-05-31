import { User } from "../models/user.model.js";
import { SecurityEvent } from "../models/securityEvent.model.js";
import { DeviceSession } from "../models/deviceSession.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { NextFunction, Request, Response } from "express";
import { startSession } from "mongoose";
import requestIp from "request-ip"
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

export const signup = async (req: Request, res: Response, next: NextFunction)=> {
    const session = await startSession();
    session.startTransaction();
    try {
        const { email, password, oauthProvider, oauthId } = req.body;

        const isUserExists = await User.findOne({email}).session(session);

        if(isUserExists){
            throw new ApiError(400, "User already exists");
        }

        const user = await User.create([{email, password, oauthProvider, oauthId}], {session});

        await DeviceSession.create([{
            userId: user[0]._id,
            ipAddress: requestIp.getClientIp(req),
            userAgent: req.header("user-agent"),
        }], {session})

        await SecurityEvent.create([{
            userId: user[0]._id,
            eventType: "signup",
            ipAddress: requestIp.getClientIp(req),
            userAgent: req.header("user-agent"),
        }], {session})

        await session.abortTransaction();
        session.endSession();

        res.status(201).json(new ApiResponse(201, {
            _id: user[0]._id,
            email: user[0].email,
        }, "Signup successful"))
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        next(err)
    }
}