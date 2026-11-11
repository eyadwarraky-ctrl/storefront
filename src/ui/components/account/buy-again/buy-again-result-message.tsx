"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { BuyAgainResult } from "@/app/(storefront)/[locale]/[channel]/(main)/account/orders/actions";
import { LinkWithChannel } from "@/ui/atoms/link-with-channel";
import { cn } from "@/lib/utils";

export function BuyAgainResultMessage({
	result,
	className,
}: {
	result: BuyAgainResult | null;
	className?: string;
}) {
	const t = useTranslations("account.buyAgain");

	return (
		<p aria-live="polite" className={cn("text-[13px]", !result && "sr-only", className)}>
			{result?.status === "added" && (
				<span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-foreground">
					<CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
					{result.skippedItems > 0
						? t("addedPartial", { count: result.addedUnits, skipped: result.skippedItems })
						: t("added", { count: result.addedUnits })}
					<LinkWithChannel href="/cart" className="font-medium underline underline-offset-4">
						{t("viewCart")}
					</LinkWithChannel>
				</span>
			)}
			{result && result.status !== "added" && (
				<span className="inline-flex items-center gap-2 text-muted-foreground">
					<AlertCircle className="h-4 w-4" aria-hidden />
					{result.status === "nothing-available"
						? t("nothingAvailable")
						: result.status === "signed-out"
							? t("signedOut")
							: t("error")}
				</span>
			)}
		</p>
	);
}
