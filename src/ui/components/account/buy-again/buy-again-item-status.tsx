"use client";

import { useTranslations } from "next-intl";
import type { BuyAgainItem } from "@/lib/account/buy-again-plan";
import { cn } from "@/lib/utils";

export function BuyAgainItemStatus({ item, className }: { item: BuyAgainItem; className?: string }) {
	const t = useTranslations("account.buyAgain");

	if (item.status === "unavailable") {
		const label =
			item.reason === "discontinued"
				? t("reasonDiscontinued")
				: item.reason === "not-for-sale"
					? t("reasonNotForSale")
					: t("reasonOutOfStock");
		return <span className={cn("text-[12px] font-medium text-destructive", className)}>{label}</span>;
	}
	if (item.status === "limited") {
		return (
			<span className={cn("text-[12px] font-medium text-bestseller", className)}>
				{t("statusLimited", { count: item.addQuantity })}
			</span>
		);
	}
	return (
		<span className={cn("text-[12px] font-medium text-success", className)}>{t("statusAvailable")}</span>
	);
}
