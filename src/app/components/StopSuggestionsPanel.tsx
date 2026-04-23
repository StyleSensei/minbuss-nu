"use client";

const STOP_SUGGESTION_SKELETON_KEYS = ["s1", "s2", "s3", "s4", "s5"] as const;

interface StopSuggestionRow {
	stop_id: string;
	stop_name: string;
	stop_lat: number;
	stop_lon: number;
	routes: string[];
}

interface StopSuggestionsPanelProps {
	isLoading: boolean;
	stops: StopSuggestionRow[];
	onPick: (row: StopSuggestionRow) => void;
}

export function StopSuggestionsPanel({
	isLoading,
	stops,
	onPick,
}: StopSuggestionsPanelProps) {
	return (
		<section
			className={`search-bar__stop-suggestions ${isLoading ? "--loading" : ""}`}
			aria-label="Hållplatser"
			aria-busy={isLoading}
		>
			{isLoading ? <h2>Laddar närmaste hållplatser...</h2> : <h2>Närmaste hållplatser</h2>}
			{isLoading ? (
				<div className="search-bar__stop-suggestions-skeleton" aria-hidden>
					{STOP_SUGGESTION_SKELETON_KEYS.map((rowKey) => (
						<div className="search-bar__stop-suggestion-skeleton" key={rowKey}>
							<span className="search-bar__stop-suggestion-skeleton__name" />
							<span className="search-bar__stop-suggestion-skeleton__routes" />
						</div>
					))}
				</div>
			) : (
				stops.map((row) => (
					<button
						key={row.stop_id}
						type="button"
						className="search-bar__stop-suggestion"
						onMouseDown={(e) => e.preventDefault()}
						onClick={() => onPick(row)}
					>
						<span className="search-bar__stop-suggestion-name">{row.stop_name}</span>
						{row.routes.length > 0 && (
							<span className="search-bar__stop-suggestion-routes">
								{row.routes.join(", ")}
							</span>
						)}
					</button>
				))
			)}
		</section>
	);
}
