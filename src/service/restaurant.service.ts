import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import type { Subscription as SubscriptionType } from "../models/subscription.model.js";
import { Restaurant } from "../models/restaurant.models.js";

export async function canCreateRestaurant(user: User, subscription: SubscriptionType) {
  const restaurantCount = await Restaurant.countDocuments({ ownerId: user._id });

  let maxRestaurants = 1;
  if (subscription.plan === "medium") maxRestaurants = 2;
  if (subscription.plan === "pro") maxRestaurants = 4;

  if (restaurantCount >= maxRestaurants) {
    throw new ApiError(403, `Your plan allows to create max ${maxRestaurants} restaurants`);
  }
}