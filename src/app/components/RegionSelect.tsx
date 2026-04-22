import { useEffect, useMemo, useRef, useState } from "react";
import { useOverflow } from "../hooks/useOverflow";
import { Icon } from "./Icon";

export type RegionOption = {
	operator: string;
	regionLabel: string;
	crestIcon?: string;
};

type RegionSelectProps = {
	id?: string;
	options: RegionOption[];
	selectedOperator: string;
	onChangeOperator: (operator: string) => void;
};

export function RegionSelect({
	id = "search-bar-region",
	options,
	selectedOperator,
	onChangeOperator,
}: RegionSelectProps) {
	const [isOpen, setIsOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement | null>(null);
	const { containerRef, isOverflowing, isScrolledToBottom, checkOverflow } =
		useOverflow<HTMLDivElement>({ bottomThreshold: 48 });
	const selected = useMemo(
		() => options.find((o) => o.operator === selectedOperator) ?? options[0],
		[options, selectedOperator],
	);

	useEffect(() => {
		if (!isOpen) return;
		const id = requestAnimationFrame(() => {
			checkOverflow();
		});
		return () => cancelAnimationFrame(id);
	}, [isOpen, options.length, checkOverflow]);

	useEffect(() => {
		const onPointerDown = (ev: MouseEvent) => {
			const root = rootRef.current;
			if (!root) return;
			if (!(ev.target instanceof Node)) return;
			if (!root.contains(ev.target)) setIsOpen(false);
		};
		const onEscape = (ev: KeyboardEvent) => {
			if (ev.key === "Escape") setIsOpen(false);
		};
		document.addEventListener("mousedown", onPointerDown);
		document.addEventListener("keydown", onEscape);
		return () => {
			document.removeEventListener("mousedown", onPointerDown);
			document.removeEventListener("keydown", onEscape);
		};
	}, []);

	if (!selected) return null;

	return (
		<div ref={rootRef} className="region-select">
			<button
				id={id}
				type="button"
				aria-haspopup="listbox"
				aria-expanded={isOpen}
				aria-controls={`${id}-listbox`}
				onClick={() => setIsOpen((v) => !v)}
				className="region-select__trigger"
			>
				{selected.crestIcon ? (
					<Icon
						svgSrc={selected.crestIcon}
						fill="currentColor"
						iconSize="18"
						title={`${selected.regionLabel} vapen`}
						className="region-select__crest"
					/>
				) : (
					<svg
						className="region-select__pin"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						viewBox="0 0 24 24"
						aria-hidden
					>
						<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
						<circle cx="12" cy="9" r="2.5" />
					</svg>
				)}
				<span className="region-select__label">{selected.regionLabel}</span>
				<svg
					className={`region-select__chevron ${isOpen ? "region-select__chevron--open" : ""}`}
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					viewBox="0 0 24 24"
					aria-hidden
				>
					<path d="M6 9l6 6 6-6" />
				</svg>
			</button>

			{isOpen ? (
				<div
					ref={containerRef}
					id={`${id}-listbox`}
					role="listbox"
					aria-label="Region"
					className={`region-select__menu ${isOverflowing ? "--overflowing" : ""} ${isScrolledToBottom ? "--at-bottom" : ""}`}
				>
					{options.map((option) => {
						const isActive = selected.operator === option.operator;
						return (
							<button
								key={option.operator}
								type="button"
								role="option"
								aria-selected={isActive}
								onClick={() => {
									onChangeOperator(option.operator);
									setIsOpen(false);
								}}
								className={`region-select__option ${isActive ? "region-select__option--active" : ""}`}
							>
								{option.crestIcon ? (
									<Icon
										svgSrc={option.crestIcon}
										fill="currentColor"
										iconSize="16"
										title={`${option.regionLabel} vapen`}
										className="region-select__crest region-select__crest--option"
									/>
								) : null}
								{option.regionLabel}
							</button>
						);
					})}
				</div>
			) : null}
		</div>
	);
}