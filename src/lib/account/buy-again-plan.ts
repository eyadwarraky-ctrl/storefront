import type { BuyAgainOrdersQuery } from "@/gql/graphql";
import { pickTranslatedName } from "@/lib/saleor-translations";

type OrderNode = NonNullable<NonNullable<BuyAgainOrdersQuery["me"]>["orders"]>["edges"][number]["node"];
type OrderLine = OrderNode["lines"][number];

export type BuyAgainUnavailableReason = "discontinued" | "not-for-sale" | "out-of-stock";

/**
 * `available` — the full previous quantity can go back in the cart.
 * `limited` — some units can (stock or per-customer limit is lower than last time).
 * `unavailable` — nothing can be added; see `reason`.
 */
export type BuyAgainItemStatus = "available" | "limited" | "unavailable";

export type BuyAgainItem = {
	key: string;
	variantId: string | null;
	productName: string;
	variantName: string | null;
	productSlug: string | null;
	thumbnail: { url: string; alt: string | null } | null;
	orderedQuantity: number;
	addQuantity: number;
	status: BuyAgainItemStatus;
	reason: BuyAgainUnavailableReason | null;
	unitPrice: { amount: number; currency: string } | null;
};

export type BuyAgainOrder = {
	number: string;
	created: string;
	channelSlug: string;
	items: BuyAgainItem[];
	/** Distinct items that can be added (status `available` or `limited`). */
	availableCount: number;
	/** Units that would be added by "buy everything again". */
	availableUnits: number;
};

export type BuyAgainCartLine = { variantId: string; quantity: number };

function variantLabel(line: OrderLine): string | null {
	const variant = line.variant;
	if (!variant) {
		return line.variantName || null;
	}
	const name = pickTranslatedName(variant);
	// Saleor falls back to the variant ID when a variant has no name.
	return name && name !== variant.id ? name : null;
}

export function planBuyAgainItem(line: OrderLine, orderedQuantity = line.quantity): BuyAgainItem {
	const variant = line.variant;
	const base = {
		key: variant?.id ?? line.id,
		variantId: variant?.id ?? null,
		productName: variant ? pickTranslatedName(variant.product) : line.productName,
		variantName: variantLabel(line),
		productSlug: variant?.product.slug ?? null,
		thumbnail: variant?.product.thumbnail
			? { url: variant.product.thumbnail.url, alt: variant.product.thumbnail.alt ?? null }
			: null,
		orderedQuantity,
		unitPrice: variant?.pricing?.price?.gross
			? { amount: variant.pricing.price.gross.amount, currency: variant.pricing.price.gross.currency }
			: null,
	};

	if (!variant) {
		return { ...base, addQuantity: 0, status: "unavailable", reason: "discontinued" };
	}
	if (!variant.product.isAvailableForPurchase || !variant.pricing?.price) {
		return { ...base, addQuantity: 0, status: "unavailable", reason: "not-for-sale" };
	}

	const stock = Math.max(0, variant.quantityAvailable ?? 0);
	const limit = variant.quantityLimitPerCustomer ?? Number.POSITIVE_INFINITY;
	const addQuantity = Math.max(0, Math.min(orderedQuantity, stock, limit));

	if (addQuantity === 0) {
		return { ...base, addQuantity: 0, status: "unavailable", reason: "out-of-stock" };
	}
	return {
		...base,
		addQuantity,
		status: addQuantity < orderedQuantity ? "limited" : "available",
		reason: null,
	};
}

/** One order → items to re-add, merging repeated lines for the same variant. */
export function planBuyAgainOrder(order: OrderNode): BuyAgainOrder {
	const byKey = new Map<string, { line: OrderLine; quantity: number }>();
	for (const line of order.lines) {
		const key = line.variant?.id ?? line.id;
		const existing = byKey.get(key);
		byKey.set(key, { line: existing?.line ?? line, quantity: (existing?.quantity ?? 0) + line.quantity });
	}

	const items = [...byKey.values()].map(({ line, quantity }) => planBuyAgainItem(line, quantity));
	const addable = items.filter((item) => item.addQuantity > 0);

	return {
		number: order.number,
		created: order.created,
		channelSlug: order.channel.slug,
		items,
		availableCount: addable.length,
		availableUnits: addable.reduce((sum, item) => sum + item.addQuantity, 0),
	};
}

export function planBuyAgainOrders(data: BuyAgainOrdersQuery, channelSlug: string): BuyAgainOrder[] {
	return (data.me?.orders?.edges ?? [])
		.map(({ node }) => planBuyAgainOrder(node))
		.filter((order) => order.channelSlug === channelSlug);
}

/** Cart lines for the selected items (all addable items when `variantIds` is omitted). */
export function toBuyAgainCartLines(
	items: BuyAgainItem[],
	variantIds?: readonly string[],
): BuyAgainCartLine[] {
	const wanted = variantIds ? new Set(variantIds) : null;
	return items
		.filter((item) => item.variantId && item.addQuantity > 0 && (!wanted || wanted.has(item.variantId)))
		.map((item) => ({ variantId: item.variantId!, quantity: item.addQuantity }));
}
