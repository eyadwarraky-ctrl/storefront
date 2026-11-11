"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { SaleorImage } from "@/ui/atoms/saleor-image";
import type { BuyAgainOrder } from "@/lib/account/buy-again-plan";
import { Button } from "@/ui/components/ui/button";
import { Checkbox } from "@/ui/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/ui/components/ui/dialog";
import { cn, formatMoney } from "@/lib/utils";
import { BuyAgainItemStatus } from "./buy-again-item-status";
import { BuyAgainResultMessage } from "./buy-again-result-message";
import type { useBuyAgain } from "./use-buy-again";

/** Review stock and choose which items from a past order go back in the cart. */
export function BuyAgainDialog({
	order,
	intlLocale,
	buyAgain,
}: {
	order: BuyAgainOrder;
	intlLocale: string;
	/** Shared with the one-tap button so both report into the same result message. */
	buyAgain: ReturnType<typeof useBuyAgain>;
}) {
	const t = useTranslations("account.buyAgain");
	const { run, pending, result } = buyAgain;
	const [open, setOpen] = useState(false);
	const addable = useMemo(
		() => order.items.filter((item) => item.variantId && item.addQuantity > 0),
		[order.items],
	);
	const [selected, setSelected] = useState<Set<string>>(() => new Set(addable.map((i) => i.variantId!)));

	const selectedUnits = addable
		.filter((item) => selected.has(item.variantId!))
		.reduce((sum, item) => sum + item.addQuantity, 0);
	const allSelected = addable.length > 0 && addable.every((item) => selected.has(item.variantId!));

	function toggle(variantId: string, checked: boolean) {
		setSelected((current) => {
			const next = new Set(current);
			if (checked) next.add(variantId);
			else next.delete(variantId);
			return next;
		});
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (next) setSelected(new Set(addable.map((i) => i.variantId!)));
			}}
		>
			<DialogTrigger asChild>
				<button
					type="button"
					disabled={pending}
					aria-label={t("chooseItemsForOrder", { number: order.number })}
					className="font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground disabled:pointer-events-none disabled:opacity-50"
				>
					{t("chooseItems")}
				</button>
			</DialogTrigger>
			<DialogContent className="inset-auto left-1/2 top-1/2 max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border bg-background p-6 shadow-lg">
				<DialogHeader>
					<DialogTitle>{t("dialogTitle")}</DialogTitle>
					<DialogDescription>{t("dialogDescription", { number: order.number })}</DialogDescription>
				</DialogHeader>

				<label className="flex items-center gap-3 border-b pb-3 text-sm font-medium">
					<Checkbox
						checked={allSelected}
						onCheckedChange={(checked) =>
							setSelected(checked ? new Set(addable.map((i) => i.variantId!)) : new Set())
						}
					/>
					{t("selectAll")}
				</label>

				<ul className="-mx-1 max-h-[50vh] divide-y overflow-y-auto px-1">
					{order.items.map((item) => {
						const canAdd = Boolean(item.variantId) && item.addQuantity > 0;
						return (
							<li key={item.key}>
								<label
									className={cn(
										"flex items-center gap-3 py-3",
										canAdd ? "cursor-pointer" : "cursor-not-allowed opacity-60",
									)}
								>
									<Checkbox
										disabled={!canAdd}
										checked={canAdd && selected.has(item.variantId!)}
										onCheckedChange={(checked) => item.variantId && toggle(item.variantId, checked)}
										aria-label={item.productName}
									/>
									<div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border bg-secondary/30">
										{item.thumbnail && (
											<SaleorImage
												src={item.thumbnail.url}
												alt={item.thumbnail.alt ?? ""}
												sizes="48px"
												className="object-contain"
											/>
										)}
									</div>
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-medium">{item.productName}</p>
										<p className="text-[12px] text-muted-foreground">
											{[
												item.variantName,
												item.status === "limited"
													? t("qtyLimited", { count: item.addQuantity, ordered: item.orderedQuantity })
													: t("qty", { count: item.orderedQuantity }),
											]
												.filter(Boolean)
												.join(" · ")}
										</p>
										<BuyAgainItemStatus item={item} />
									</div>
									{item.unitPrice && canAdd && (
										<span className="text-sm font-medium tabular-nums">
											{formatMoney(
												item.unitPrice.amount * item.addQuantity,
												item.unitPrice.currency,
												intlLocale,
											)}
										</span>
									)}
								</label>
							</li>
						);
					})}
				</ul>

				<DialogFooter className="gap-2 sm:gap-2">
					<Button type="button" variant="ghost" onClick={() => setOpen(false)}>
						{t("cancel")}
					</Button>
					<Button
						type="button"
						disabled={selectedUnits === 0 || pending}
						onClick={() =>
							run({ orderNumber: order.number, variantIds: [...selected] }, (next) => {
								if (next.status === "added") setOpen(false);
							})
						}
					>
						{pending ? t("adding") : t("addSelected", { count: selectedUnits })}
					</Button>
				</DialogFooter>
				{result && result.status !== "added" && <BuyAgainResultMessage result={result} />}
			</DialogContent>
		</Dialog>
	);
}
