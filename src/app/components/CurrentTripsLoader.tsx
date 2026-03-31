export const SkeletonTripTable = ({ rowCount = 6 }: { rowCount?: number }) => (
	<table className="skeleton-table">
		<tbody>
			{Array.from({ length: rowCount }).map((_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows
				<tr key={i}>
					<td className="td-icon">
						<div className="skeleton skeleton-circle" />
					</td>
					<td>
						<div className="skeleton skeleton-line" />
					</td>
					<td className="td-time">
						<div className="skeleton skeleton-time" />
					</td>
				</tr>
			))}
		</tbody>
	</table>
);

export const CurrentTripsLoader = () => {
	return (
		<div className="current-trips">
			<div className="skeleton-wrapper">
				<div className="skeleton skeleton-title" />
				<div className="skeleton skeleton-subtitle" />
				<div className="skeleton skeleton-subtitle short" />

				<div className="skeleton-card">
					<div className="skeleton skeleton-icon" />
					<div className="skeleton-card-text">
						<div className="skeleton skeleton-line" />
						<div className="skeleton skeleton-line short" />
					</div>
				</div>

				<SkeletonTripTable rowCount={6} />
			</div>
		</div>
	);
};
