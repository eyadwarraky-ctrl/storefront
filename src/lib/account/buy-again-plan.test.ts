import { describe, expect, it } from "vitest";
import type { BuyAgainOrdersQuery } from "@/gql/graphql";
import { planBuyAgainOrder, planBuyAgainOrders, toBuyAgainCartLines } from "./buy-again-plan";

type OrderNode = NonNullable<NonNullable<BuyAgainOrdersQuery["me"]>["orders"]>["edges"][number]["node"];
type Line = OrderNode["lines"][number];

function line(
	id: string,
	quantity: number,
	variant: Partial<NonNullable<Line["variant"]>> | null = {},
): Line {
	return {
		id: `line-${id}`,
		quantity,
		productName: `Product ${id}`,
		variantName: "M",
		variant:
			variant === null
				? null
				: {
						id: `variant-${id}`,
						name: "M",
						translation: null,
						quantityAvailable: 50,
						quantityLimitPerCustomer: null,
						pricing: { price: { gross: { amount: 10, currency: "USD" } } },
						product: {
							id: `product-${id}`,
							name: `Product ${id}`,
							slug: `product-${id}`,
							isAvailableForPurchase: true,
							translation: null,
							thumbnail: null,
						},
						...variant,
					},
	};
}

function order(
	number: string,
	lines: Line[],
	created = "2026-01-01T00:00:00Z",
	channel = "default-channel",
): OrderNode {
	return { id: `order-${number}`, number, created, channel: { slug: channel }, lines };
}

describe("planBuyAgainOrder", () => {
	it("adds the full quantity when stock allows", () => {
		const plan = planBuyAgainOrder(order("1", [line("a", 3)]));

		expect(plan.items[0]).toMatchObject({ status: "available", addQuantity: 3, reason: null });
		expect(plan.availableCount).toBe(1);
		expect(plan.availableUnits).toBe(3);
	});

	it("caps the quantity at stock and the per-customer limit", () => {
		const plan = planBuyAgainOrder(
			order("1", [line("a", 5, { quantityAvailable: 2 }), line("b", 4, { quantityLimitPerCustomer: 1 })]),
		);

		expect(plan.items.map((item) => [item.status, item.addQuantity])).toEqual([
			["limited", 2],
			["limited", 1],
		]);
	});

	it("marks out-of-stock, unpurchasable, and deleted variants unavailable", () => {
		const plan = planBuyAgainOrder(
			order("1", [
				line("a", 1, { quantityAvailable: 0 }),
				line("b", 1, {
					product: { ...line("b", 1).variant!.product, isAvailableForPurchase: false },
				}),
				line("c", 1, null),
			]),
		);

		expect(plan.items.map((item) => item.reason)).toEqual(["out-of-stock", "not-for-sale", "discontinued"]);
		expect(plan.availableCount).toBe(0);
	});

	it("merges repeated lines for the same variant", () => {
		const plan = planBuyAgainOrder(order("1", [line("a", 2), { ...line("a", 3), id: "line-a2" }]));

		expect(plan.items).toHaveLength(1);
		expect(plan.items[0].orderedQuantity).toBe(5);
	});
});

describe("planBuyAgainOrders", () => {
	it("keeps only orders from the current channel", () => {
		const data: BuyAgainOrdersQuery = {
			me: {
				id: "user",
				orders: {
					edges: [
						{ node: order("1", [line("a", 1)]) },
						{ node: order("2", [line("b", 1)], undefined, "channel-pln") },
					],
				},
			},
		};

		expect(planBuyAgainOrders(data, "default-channel").map((o) => o.number)).toEqual(["1"]);
	});
});

describe("toBuyAgainCartLines", () => {
	it("returns only addable selected items with server-planned quantities", () => {
		const plan = planBuyAgainOrder(
			order("1", [
				line("a", 3),
				line("b", 2, { quantityAvailable: 0 }),
				line("c", 5, { quantityAvailable: 1 }),
			]),
		);

		expect(toBuyAgainCartLines(plan.items)).toEqual([
			{ variantId: "variant-a", quantity: 3 },
			{ variantId: "variant-c", quantity: 1 },
		]);
		expect(toBuyAgainCartLines(plan.items, ["variant-b", "variant-c"])).toEqual([
			{ variantId: "variant-c", quantity: 1 },
		]);
	});
});
