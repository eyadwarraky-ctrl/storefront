import type { ReactNode } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { type OrderDetailsFragment } from "@/gql/graphql";
import { LinkWithChannel } from "@/ui/atoms/link-with-channel";
import { formatDate, formatMoney } from "@/lib/utils";
import { resolveLocaleFromSlug } from "@/config/locale";
import { orderStatusStyle, defaultStatusStyle } from "./order-status-config";
import { type OrderRowLabels } from "./order-row-labels";
import { accountRoutes } from "./routes";

type Props = {
	order: OrderDetailsFragment;
	localeSlug: string;
	labels: OrderRowLabels;
	/** Secondary action rendered beside the row link (kept outside it — no nested interactives). */
	action?: ReactNode;
};

export function OrderRow({ order, localeSlug, labels, action }: Props) {
	const intlLocale = resolveLocaleFromSlug(localeSlug).bcp47;

	const thumbnails = order.lines
		.filter((l) => l.variant?.product.thumbnail)
		.map((l) => l.variant!.product.thumbnail!)
		.slice(0, 3);

	const style = orderStatusStyle[order.status] ?? defaultStatusStyle;
	const StatusIcon = style.icon;

	const link = (
		<LinkWithChannel
			href={accountRoutes.orderDetail(order.number)}
			className={
				action
					? "flex min-w-0 flex-1 items-center gap-4 rounded-lg px-5 py-4 transition-colors hover:bg-secondary/30"
					: "flex items-center gap-4 rounded-lg border px-5 py-4 transition-colors hover:bg-secondary/30"
			}
		>
			<div className="flex -space-x-3">
				{thumbnails.map((thumb, i) => (
					<div
						key={i}
						className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border-2 border-background bg-secondary/40"
					>
						<Image
							src={thumb.url}
							alt={thumb.alt ?? ""}
							width={96}
							height={96}
							className="h-full w-full object-contain"
						/>
					</div>
				))}
				{thumbnails.length === 0 && (
					<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary text-xs text-muted-foreground">
						#
					</div>
				)}
			</div>

			<div className="min-w-0 flex-1">
				<p className="text-sm font-semibold">{labels.orderNumber}</p>
				<p className="text-[13px] text-muted-foreground">
					<time dateTime={order.created}>{formatDate(new Date(order.created), undefined, intlLocale)}</time>
					{" · "}
					{labels.itemCount}
				</p>
			</div>

			<div className="flex items-center gap-4">
				<span className={`inline-flex items-center gap-1.5 text-[13px] font-medium ${style.className}`}>
					<StatusIcon className="h-4 w-4" strokeWidth={1.75} />
					<span className="hidden sm:inline">{labels.statusLabel}</span>
				</span>
				<span className="text-sm font-semibold tabular-nums">
					{formatMoney(order.total.gross.amount, order.total.gross.currency, intlLocale)}
				</span>
				<ArrowRight className="h-4 w-4 text-muted-foreground" />
			</div>
		</LinkWithChannel>
	);

	if (!action) {
		return link;
	}

	return (
		<div className="flex flex-col rounded-lg border sm:flex-row sm:items-center">
			{link}
			<div className="border-t px-5 py-3 sm:border-l sm:border-t-0 sm:py-4">{action}</div>
		</div>
	);
}
