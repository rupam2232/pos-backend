import { Subscription } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { Table } from "../models/table.model.js";

export async function canCreateTable(user: User, restaurantId: string) {
  const subscription = await Subscription.findOne({ userId: user._id });
  if (!subscription || !subscription.isSubscriptionActive) throw new ApiError(403, "No active subscription found");
  if(subscription.subscriptionEndDate && subscription.subscriptionEndDate < new Date()) {
    subscription.isSubscriptionActive = false;
    subscription.save({ validateBeforeSave: false });
    throw new ApiError(403, "Your subscription has expired. Please renew to create more restaurants.");
  }
  if (subscription.isTrial && subscription.trialExpiresAt && subscription.trialExpiresAt < new Date()) {
    subscription.isSubscriptionActive = false;
    subscription.save({ validateBeforeSave: false });
    throw new ApiError(403, "Your trial period has expired. Please subscribe to continue using the service.");
  }

const totalTableCount = await Table.countDocuments({ restaurantId });

  let maxTables = 4;
  if (subscription.plan === "medium") maxTables = 10;
  if (subscription.plan === "pro") maxTables = 100000; // Unlimited for pro plan

  if (totalTableCount >= maxTables) {
    throw new ApiError(403, `Your plan allows to create max ${maxTables} tables per restaurant`);
  }
}