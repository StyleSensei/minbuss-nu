"use client";

import type { FormEvent, KeyboardEvent, RefObject } from "react";
import { alphabet } from "../../../public/icons";
import colors from "../colors";
import { Icon } from "./Icon";

interface SearchInputRowProps {
	iconSize: string;
	fill: string;
	title: string;
	title2?: string;
	path: string;
	path2?: string;
	inputRef: RefObject<HTMLInputElement>;
	userInput: string;
	isTextMode: boolean;
	isLoading: boolean;
	isKeyboardLikelyOpen: boolean;
	routeExists: boolean;
	onFocus: () => void;
	onActivateFromGesture: () => void;
	onBlur: () => void;
	onSubmit: (event: FormEvent<HTMLFormElement>) => void;
	onChangeInput: (value: string) => void;
	onToggleTextMode: () => void;
	onReset: () => void;
}

export function SearchInputRow({
	iconSize,
	fill,
	title,
	title2,
	path,
	path2,
	inputRef,
	userInput,
	isTextMode,
	isLoading,
	isKeyboardLikelyOpen,
	routeExists,
	onFocus,
	onActivateFromGesture,
	onBlur,
	onSubmit,
	onChangeInput,
	onToggleTextMode,
	onReset,
}: SearchInputRowProps) {
	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Escape" || event.key === "Cancel") {
			onBlur();
		}
	};

	return (
		<form onSubmit={onSubmit}>
			<button
				type="button"
				onClick={onActivateFromGesture}
			>
				<Icon path={path} fill={fill} iconSize={iconSize} title={title} />
			</button>
			<label htmlFor="searchbar" className="sr-only">
				Sök busslinje eller hållplats
			</label>
			<input
				id="searchbar"
				name="searchbar"
				inputMode={isTextMode ? "search" : "numeric"}
				enterKeyHint="search"
				ref={inputRef}
				type="search"
				maxLength={80}
				pattern={undefined}
				placeholder="Sök linje / hållplats..."
				className={`search-bar__input ${isLoading ? "loading" : ""}`}
				autoComplete="off"
				autoCorrect="off"
				spellCheck={false}
				onChange={(e) => onChangeInput(e.target.value)}
				value={userInput}
				onKeyDown={handleKeyDown}
				onFocus={onFocus}
				onBlur={onBlur}
				style={{
					outlineColor: routeExists ? colors.accentColor : colors.notValid,
				}}
			/>
			{isKeyboardLikelyOpen && (
				<button
					type="button"
					className={
						isTextMode ? "button text-mode --active" : "button text-mode"
					}
					onMouseDown={(e) => {
						e.preventDefault();
					}}
					onClick={onToggleTextMode}
				>
					<Icon
						path={alphabet}
						fill={fill}
						iconSize={iconSize}
						title="Ändra till textläge"
					/>
				</button>
			)}
			{userInput && title2 && path2 && (
				<button className="reset-button" type="reset" onClick={onReset}>
					<Icon path={path2} fill={fill} iconSize={iconSize} title={title2} />
				</button>
			)}
			<button type="submit">Sök</button>
		</form>
	);
}
