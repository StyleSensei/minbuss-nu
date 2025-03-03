export const CurrentTripsLoader = () => {
	return (
		<div className="table-container skeleton">
			<div className="current-trips-loader">
				<div className="current-trips-loader__header container">
					<div className="skeleton skeleton-text title" />
					<div className="skeleton skeleton-text" />
				</div>
				<div className="next-departure container">
					<div className="skeleton skeleton-text" />
					<div className="time skeleton skeleton-text" />
				</div>
				<div className="container">
					<div className="skeleton skeleton-text" />
					<div className="skeleton skeleton-text" />
					<div className="skeleton skeleton-text" />
				</div>
			</div>
		</div>
	);
};
