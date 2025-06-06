import { Subscription } from "../models/subscription.model.js";
import { Restaurant } from "../models/restaurant.models.js";
import { ApiError } from "../utils/ApiError.js";

export async function canCreateRestaurant(userId: string) {
  const subscription = await Subscription.findOne({ userId });
  if (!subscription || !subscription.isSubscriptionActive) throw new ApiError(403, "No active subscription found");

  const restaurantCount = await Restaurant.countDocuments({ ownerId: userId });

  let maxRestaurants = 1;
  if (subscription.plan === "medium") maxRestaurants = 2;
  if (subscription.plan === "pro") maxRestaurants = 4;

  if (restaurantCount >= maxRestaurants) {
    throw new ApiError(403, `Your plan allows only ${maxRestaurants} restaurants`);
  }
}