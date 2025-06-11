import { ApiError } from "../utils/ApiError.js";
import { Table } from "../models/table.model.js";
import type { Subscription as SubscriptionType } from "../models/subscription.model.js";

export async function canCreateTable(subscription: SubscriptionType, restaurantId: string) {
const totalTableCount = await Table.countDocuments({ restaurantId });

  let maxTables = 4;
  if (subscription.plan === "medium") maxTables = 10;
  if (subscription.plan === "pro") maxTables = 100000; // Unlimited for pro plan

  if (totalTableCount >= maxTables) {
    throw new ApiError(403, `Your plan allows to create max ${maxTables} tables per restaurant`);
  }
}