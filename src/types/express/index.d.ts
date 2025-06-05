import * as express from 'express'
import type { User as UserType } from "../../models/user.model.js";

declare global {
	namespace Express {
		interface Request {
			user?: UserType;
		}
	}
}