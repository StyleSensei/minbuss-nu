import { bus } from "../../public/icons";
import DemoMap from "./components/DemoMap";
import { LinkButton } from "./components/LinkButton";
import TextBlock from "./components/Textblock";
import { Paths } from "./paths";

export default async function Home() {
	const routePathD =
		"M-24.528,330.81399 C-17.525,311.80799 44.791,261.004 117.797,258.853 154.821,257.735 183.68,258.53 139.726,338.075 124.362,365.879 93.723,535.922 138.878,565.951 184.026,595.961 303.864,507.401 383.642,352.192 410.96,299.038 608.013,184.642 644.854,270.215 679.451,350.594 884.9068,175.63219 898.078,98.28499";
	return (
		<>
			<div className="wrapper__start">
				<TextBlock
					title="Min buss.nu"
					className="start"
					description="Undrar du också var bussen är? Vi visar var bussen är i realtid."
					h1ClassName="text-8xl text-white tracking-tighter text-balance"
					descriptionClassName="text-xl leading-10 [&:not(:first-child)]:mt-6"
				/>
				<DemoMap pathD={routePathD} />
			</div>
			<LinkButton
				title="Sök busslinje"
				text="Sök busslinje"
				fill={"black"}
				path={bus}
				className="--cta"
				href={`${Paths.Search}`}
				id="cta"
			/>
		</>
	);
}
