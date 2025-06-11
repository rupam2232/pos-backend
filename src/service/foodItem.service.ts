import { ApiError } from "../utils/ApiError.js";
import { FoodItem } from "../models/foodItem.model.js";
import type { Subscription as SubscriptionType } from "../models/subscription.model.js";

export async function canCreateFoodItem(subscription: SubscriptionType, restaurantId: string) {
const totalFoodItemCount = await FoodItem.countDocuments({ restaurantId });

  let maxFoodItem = 10;
  if (subscription.plan === "medium") maxFoodItem = 25;
  if (subscription.plan === "pro") maxFoodItem = 100000; // Unlimited for pro plan

  if (totalFoodItemCount >= maxFoodItem) {
    throw new ApiError(403, `Your plan allows to create max ${maxFoodItem} food items per restaurant`);
  }
}