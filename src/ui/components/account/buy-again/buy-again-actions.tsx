"use client";

import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import type { BuyAgainOrder } from "@/lib/account/buy-again-plan";
import { Button } from "@/ui/components/ui/button";
import { cn } from "@/lib/utils";
import { BuyAgainDialog } from "./buy-again-dialog";
import { BuyAgainResultMessage } from "./buy-again-result-message";
import { useBuyAgain } from "./use-buy-again";

/**
 * "Buy again" for one past order: one tap re-adds every available item, and
 * "Choose items" opens a review dialog for picking a subset.
 */
export function BuyAgainActions({
	order,
	intlLocale,
	size = "sm",
	align = "end",
}: {
	order: BuyAgainOrder;
	intlLocale: string;
	size?: "sm" | "default";
	align?: "start" | "end";
}) {
	const t = useTranslations("account.buyAgain");
	const buyAgain = useBuyAgain();
	const { run, pending, result } = buyAgain;
	const totalCount = order.items.length;
	const availableCount = order.availableCount;
	const disabled = availableCount === 0;

	return (
		<div className={cn("flex flex-col gap-1.5", align === "end" ? "items-end text-right" : "items-start")}>
			<Button
				type="button"
				size={size}
				variant="outline-solid"
				disabled={disabled || pending}
				aria-label={t("buttonForOrder", { number: order.number })}
				onClick={() => run({ orderNumber: order.number })}
			>
				<RotateCcw className={cn("h-4 w-4", pending && "animate-spin")} aria-hidden />
				{pending ? t("adding") : disabled ? t("allUnavailable") : t("button")}
			</Button>
			{!result && availableCount > 0 && (totalCount > 1 || availableCount < totalCount) && (
				<span className="flex flex-wrap items-center gap-x-2 text-[12px] text-muted-foreground">
					{availableCount < totalCount && (
						<span>{t("availableSummary", { available: availableCount, total: totalCount })}</span>
					)}
					{totalCount > 1 && <BuyAgainDialog order={order} intlLocale={intlLocale} buyAgain={buyAgain} />}
				</span>
			)}
			<BuyAgainResultMessage result={result} />
		</div>
	);
}
