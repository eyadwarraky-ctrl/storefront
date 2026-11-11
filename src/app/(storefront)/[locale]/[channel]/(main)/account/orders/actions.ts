"use server";

import { refresh } from "next/cache";
import { CheckoutLinesAddManyDocument } from "@/gql/graphql";
import { hasAuthSession } from "@/lib/auth/has-auth-session";
import { getBuyAgainOrders } from "@/lib/account/buy-again";
import { toBuyAgainCartLines, type BuyAgainCartLine } from "@/lib/account/buy-again-plan";
import { emitCommerceEvent } from "@/lib/analytics/emit.server";
import { mutate } from "@/lib/saleor";
import * as Checkout from "@/lib/checkout";

export type BuyAgainResult =
	| { status: "added"; addedUnits: number; addedItems: number; skippedItems: number }
	| { status: "nothing-available" }
	| { status: "signed-out" }
	| { status: "error" };

type BuyAgainInput = {
	channel: string;
	localeSlug: string;
	/** The past order to re-add. */
	orderNumber: string;
	/** Restrict to these variants. Omit to add every available item. */
	variantIds?: string[];
};

/**
 * Put a previous order's available items back in the channel cart.
 *
 * Quantities and availability are re-resolved on the server from the customer's own
 * orders — the client only says *which* items, never how many or at what price.
 */
export async function buyAgain(input: BuyAgainInput): Promise<BuyAgainResult> {
	if (!(await hasAuthSession())) {
		return { status: "signed-out" };
	}

	const orders = await getBuyAgainOrders(input.localeSlug, input.channel);
	if (!orders) {
		return { status: "error" };
	}

	const items = orders.find((order) => order.number === input.orderNumber)?.items ?? [];
	const requested = input.variantIds ?? items.flatMap((item) => (item.variantId ? [item.variantId] : []));
	let lines = toBuyAgainCartLines(items, requested);

	if (lines.length === 0) {
		return { status: "nothing-available" };
	}

	const checkout = await Checkout.findOrCreate({
		checkoutId: await Checkout.getIdFromCookies(input.channel),
		channel: input.channel,
		localeSlug: input.localeSlug,
	});
	if (!checkout) {
		return { status: "error" };
	}
	await Checkout.saveIdToCookie(input.channel, checkout.id);

	// Stock can move between render and click, and the cart may already hold units.
	// Saleor rejects the whole batch on a stock error, so drop the named variants and retry once.
	for (let attempt = 0; attempt < 2 && lines.length > 0; attempt++) {
		const result = await mutate(CheckoutLinesAddManyDocument, {
			variables: { id: checkout.id, lines: lines satisfies BuyAgainCartLine[] },
		});
		if (!result.ok) {
			console.error("Buy again failed:", result.error.message);
			return { status: "error" };
		}

		const errors = result.data.checkoutLinesAdd?.errors ?? [];
		if (errors.length === 0) {
			const addedUnits = lines.reduce((sum, line) => sum + line.quantity, 0);
			const prices = new Map(items.map((item) => [item.variantId, item.unitPrice]));
			emitCommerceEvent({
				name: "product_added_to_cart",
				channel: input.channel,
				value: lines.reduce(
					(sum, line) => sum + (prices.get(line.variantId)?.amount ?? 0) * line.quantity,
					0,
				),
				currency: prices.get(lines[0].variantId)?.currency ?? "",
			});
			refresh();
			return {
				status: "added",
				addedUnits,
				addedItems: lines.length,
				skippedItems: Math.max(0, requested.length - lines.length),
			};
		}

		const rejected = new Set(errors.flatMap((error) => error.variants ?? []));
		if (rejected.size === 0) {
			console.error("Buy again failed:", errors);
			return { status: "error" };
		}
		lines = lines.filter((line) => !rejected.has(line.variantId));
	}

	return { status: "nothing-available" };
}
