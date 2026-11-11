import "server-only";

import { BuyAgainOrdersDocument } from "@/gql/graphql";
import { sessionQuery } from "@/lib/saleor";
import { graphqlLanguageCodeVariables } from "@/lib/graphql-locale";
import { planBuyAgainOrders } from "./buy-again-plan";

/** Recent orders considered for "Buy again" (shelf + per-order actions). */
export const BUY_AGAIN_ORDER_WINDOW = 20;

/**
 * Live, per-request "Buy again" view of the signed-in customer's recent orders in
 * this channel, with current stock and purchasability. Never shared-cached.
 */
export async function getBuyAgainOrders(localeSlug: string, channelSlug: string) {
	const result = await sessionQuery(BuyAgainOrdersDocument, {
		variables: {
			first: BUY_AGAIN_ORDER_WINDOW,
			...graphqlLanguageCodeVariables(localeSlug),
		},
	});
	if (!result.ok || !result.data.me) {
		return null;
	}
	return planBuyAgainOrders(result.data, channelSlug);
}
