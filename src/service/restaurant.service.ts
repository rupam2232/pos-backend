import { Subscription } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";

export async function canCreateRestaurant(user: User) {
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

  const restaurantCount = user.restaurantIds?.length || 0;

  let maxRestaurants = 1;
  if (subscription.plan === "medium") maxRestaurants = 2;
  if (subscription.plan === "pro") maxRestaurants = 4;

  if (restaurantCount >= maxRestaurants) {
    throw new ApiError(403, `Your plan allows only ${maxRestaurants} restaurants`);
  }
}