"use client";

import { useState, useTransition } from "react";
import { useParams } from "next/navigation";
import {
	buyAgain,
	type BuyAgainResult,
} from "@/app/(storefront)/[locale]/[channel]/(main)/account/orders/actions";
import { bumpChromeVersion } from "@/lib/chrome-sync";

type Target = { orderNumber: string; variantIds?: string[] };

/** Runs the buy-again server action for the current locale/channel and keeps its last result. */
export function useBuyAgain() {
	const { locale, channel } = useParams<{ locale: string; channel: string }>();
	const [pending, startTransition] = useTransition();
	const [result, setResult] = useState<BuyAgainResult | null>(null);

	function run(target: Target, onDone?: (result: BuyAgainResult) => void) {
		startTransition(async () => {
			let next: BuyAgainResult;
			try {
				next = await buyAgain({ channel, localeSlug: locale, ...target });
			} catch {
				next = { status: "error" };
			}
			if (next.status === "added") {
				bumpChromeVersion();
			}
			setResult(next);
			onDone?.(next);
		});
	}

	return { run, pending, result, reset: () => setResult(null) };
}
