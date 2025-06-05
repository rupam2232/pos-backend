import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import jwt from "jsonwebtoken"
import { User } from "../models/user.model.js"
import type { accessTokenUser } from "../utils/jwt.js"
import type { User as UserType } from "../models/user.model.js";

// Extend Express Request interface to include 'user'
declare module "express-serve-static-core" {
  interface Request {
    user?: UserType;
  }
}

export const verifyJWT = asyncHandler( async( req, res, next)=>{
    try {
        const accessToken = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")
        const refreshToken = req.cookies?.refreshToken
        
        if(!refreshToken) throw new ApiError(401, "Unauthorized request")
        if(!accessToken) throw new ApiError(401, "Invalid Access Token")
    
        const decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET as string)
        if (typeof decoded !== "object" || decoded === null) {
            throw new ApiError(401, "Invalid Access Token");
        }
        const decodedToken = decoded as accessTokenUser;

        const user = await User.findById(decodedToken._id).select("-password")
    
        if(!user){ 
            throw new ApiError(401,"Invalid Access Token")
        }
    
        req.user = user
        next();
    } catch (error) {
        if( error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError){
        throw new ApiError(401, error?.message || "Invalid access token")
        }
        next(error);
    }
})