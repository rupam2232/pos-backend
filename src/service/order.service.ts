import { Subscription } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import type { Restaurant as RestaurantType } from "../models/restaurant.models.js";

export const canRestaurantRecieveOrders = async (restaurant: RestaurantType) => {
const subscription = await Subscription.findOne({
  userId: restaurant.ownerId,
});

if (!subscription || subscription.isSubscriptionActive === false) {
  restaurant.isCurrentlyOpen = false;
  restaurant.save({ validateBeforeSave: false });
  throw new ApiError(
    403,
    "This restaurant does not have an active subscription. we cannot process your order at this time. Please contact the restaurant owner for more information"
  );
}

if (
  subscription.subscriptionEndDate &&
  subscription.subscriptionEndDate < new Date()
) {
  restaurant.isCurrentlyOpen = false;
  restaurant.save({ validateBeforeSave: false });
  subscription.isSubscriptionActive = false;
  subscription.save({ validateBeforeSave: false });
  throw new ApiError(
    403,
    "This restaurant's subscription has expired. Please contact the restaurant owner to renew the subscription"
  );
}
if (
  subscription.isTrial &&
  subscription.trialExpiresAt &&
  subscription.trialExpiresAt < new Date()
) {
  restaurant.isCurrentlyOpen = false;
  restaurant.save({ validateBeforeSave: false });
  subscription.isSubscriptionActive = false;
  subscription.save({ validateBeforeSave: false });
  throw new ApiError(
    403,
    "This restaurant's trial period has expired. Please contact the restaurant owner to subscribe"
  );
}
if (
  !subscription.isTrial &&
  !subscription.trialExpiresAt &&
  !subscription.subscriptionEndDate
) {
  restaurant.isCurrentlyOpen = false;
  restaurant.save({ validateBeforeSave: false });
  subscription.isSubscriptionActive = false;
  subscription.save({ validateBeforeSave: false });
  throw new ApiError(
    403,
    "This restaurant's subscription is not active. Please contact the restaurant owner to subscribe"
  );
}
}