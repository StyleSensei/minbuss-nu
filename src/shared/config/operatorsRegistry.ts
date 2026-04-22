import { regionCrestIconByOperator } from "../../../public/icons";

export type OperatorMapBounds = {
	north: number;
	south: number;
	east: number;
	west: number;
};

export type OperatorMapView = {
	defaultCenter: { lat: number; lng: number };
	restriction: OperatorMapBounds;
};

export type OperatorRegistryEntry = {
	id: string;
	aliases: string[];
	displayLabel: string;
	regionSlug: string;
	seoArea: string;
	crestIcon?: string;
	mapView: OperatorMapView;
};

export const SWEDEN_FALLBACK_MAP_VIEW: OperatorMapView = {
	defaultCenter: { lat: 61.5, lng: 15.5 },
	restriction: { north: 69.2, south: 55.05, east: 24.6, west: 10.4 },
};

export const OPERATOR_REGISTRY: OperatorRegistryEntry[] = [
	{
		id: "sl",
		aliases: [],
		displayLabel: "SL",
		regionSlug: "stockholm",
		seoArea: "Stockholm",
		crestIcon: regionCrestIconByOperator.sl,
		mapView: {
			defaultCenter: { lat: 59.33258, lng: 18.0649 },
			restriction: { north: 60.05, south: 58.45, east: 19.85, west: 16.65 },
		},
	},
	{
		id: "vt",
		aliases: ["vasttrafik"],
		displayLabel: "Västtrafik",
		regionSlug: "vastra-gotaland",
		seoArea: "Västra Götaland",
		crestIcon: regionCrestIconByOperator.vt,
		mapView: {
			defaultCenter: { lat: 57.7089, lng: 11.9746 },
			restriction: { north: 59.15, south: 56.95, east: 14.15, west: 10.95 },
		},
	},
	{
		id: "skane",
		aliases: ["skanetrafiken"],
		displayLabel: "Skåne",
		regionSlug: "skane",
		seoArea: "Skåne",
		crestIcon: regionCrestIconByOperator.skane,
		mapView: {
			defaultCenter: { lat: 55.605, lng: 13.0038 },
			restriction: { north: 56.45, south: 55.15, east: 14.55, west: 12.35 },
		},
	},
	{
		id: "ul",
		aliases: [],
		displayLabel: "UL",
		regionSlug: "uppsala",
		seoArea: "Uppsala",
		crestIcon: regionCrestIconByOperator.ul,
		mapView: {
			defaultCenter: { lat: 59.8586, lng: 17.6389 },
			restriction: { north: 60.25, south: 59.25, east: 18.25, west: 16.75 },
		},
	},
	{
		id: "sormland",
		aliases: [],
		displayLabel: "Sörmlandstrafiken",
		regionSlug: "sormland",
		seoArea: "Sörmland",
		crestIcon: regionCrestIconByOperator.sormland,
		mapView: {
			defaultCenter: { lat: 59.3715, lng: 16.478 },
			restriction: { north: 59.65, south: 58.85, east: 17.35, west: 15.85 },
		},
	},
	{
		id: "otraf",
		aliases: [],
		displayLabel: "Östgötatrafiken",
		regionSlug: "ostergotland",
		seoArea: "Östergötland",
		crestIcon: regionCrestIconByOperator.otraf,
		mapView: {
			defaultCenter: { lat: 58.4108, lng: 15.6214 },
			restriction: { north: 59.05, south: 58.05, east: 16.55, west: 14.65 },
		},
	},
	{
		id: "jlt",
		aliases: [],
		displayLabel: "JLT",
		regionSlug: "jonkoping",
		seoArea: "Jönköping",
		crestIcon: regionCrestIconByOperator.jlt,
		mapView: {
			defaultCenter: { lat: 57.7826, lng: 14.1618 },
			restriction: { north: 58.2, south: 57.35, east: 15.05, west: 13.35 },
		},
	},
	{
		id: "krono",
		aliases: [],
		displayLabel: "Kronoberg",
		regionSlug: "kronoberg",
		seoArea: "Kronoberg",
		crestIcon: regionCrestIconByOperator.krono,
		mapView: {
			defaultCenter: { lat: 56.8777, lng: 14.8091 },
			restriction: { north: 57.35, south: 56.35, east: 15.65, west: 13.95 },
		},
	},
	{
		id: "klt",
		aliases: [],
		displayLabel: "KLT",
		regionSlug: "kalmar",
		seoArea: "Kalmar",
		crestIcon: regionCrestIconByOperator.klt,
		mapView: {
			defaultCenter: { lat: 56.6634, lng: 16.3567 },
			restriction: { north: 57.2, south: 56.15, east: 17.1, west: 15.5 },
		},
	},
	{
		id: "gotland",
		aliases: [],
		displayLabel: "Gotland",
		regionSlug: "gotland",
		seoArea: "Gotland",
		crestIcon: regionCrestIconByOperator.gotland,
		mapView: {
			defaultCenter: { lat: 57.639, lng: 18.297 },
			restriction: { north: 58.05, south: 56.72, east: 19.35, west: 17.9 },
		},
	},
	{
		id: "blekinge",
		aliases: [],
		displayLabel: "Blekingetrafiken",
		regionSlug: "blekinge",
		seoArea: "Blekinge",
		crestIcon: regionCrestIconByOperator.blekinge,
		mapView: {
			defaultCenter: { lat: 56.1612, lng: 15.5869 },
			restriction: { north: 56.55, south: 55.85, east: 16.25, west: 14.55 },
		},
	},
	{
		id: "halland",
		aliases: [],
		displayLabel: "Hallandstrafiken",
		regionSlug: "halland",
		seoArea: "Halland",
		crestIcon: regionCrestIconByOperator.halland,
		mapView: {
			defaultCenter: { lat: 56.6745, lng: 12.8578 },
			restriction: { north: 57.35, south: 56.05, east: 13.45, west: 12.35 },
		},
	},
	{
		id: "orebro",
		aliases: [],
		displayLabel: "Örebro",
		regionSlug: "orebro",
		seoArea: "Örebro",
		crestIcon: regionCrestIconByOperator.orebro,
		mapView: {
			defaultCenter: { lat: 59.2716, lng: 15.2182 },
			restriction: { north: 59.65, south: 58.85, east: 15.85, west: 14.65 },
		},
	},
	{
		id: "varm",
		aliases: [],
		displayLabel: "Värmlandstrafik",
		regionSlug: "varm",
		seoArea: "Värmland",
		crestIcon: regionCrestIconByOperator.varm,
		mapView: {
			defaultCenter: { lat: 59.3793, lng: 13.5036 },
			restriction: { north: 61.05, south: 58.6, east: 14.95, west: 11.9 },
		},
	},
	{
		id: "vastmanland",
		aliases: [],
		displayLabel: "Västmanland",
		regionSlug: "vastmanland",
		seoArea: "Västmanland",
		crestIcon: regionCrestIconByOperator.vastmanland,
		mapView: {
			defaultCenter: { lat: 59.61, lng: 16.55 },
			restriction: { north: 60.35, south: 59.2, east: 17.4, west: 15.5 },
		},
	},
	{
		id: "dt",
		aliases: [],
		displayLabel: "Dalatrafik",
		regionSlug: "dt",
		seoArea: "Dalarna",
		crestIcon: regionCrestIconByOperator.dt,
		mapView: {
			defaultCenter: { lat: 60.6073, lng: 15.6299 },
			restriction: { north: 61.95, south: 59.85, east: 16.9, west: 12.6 },
		},
	},
	{
		id: "xt",
		aliases: [],
		displayLabel: "X-trafik",
		regionSlug: "xt",
		seoArea: "Gävleborg",
		crestIcon: regionCrestIconByOperator.xt,
		mapView: {
			defaultCenter: { lat: 60.6749, lng: 17.1413 },
			restriction: { north: 62.35, south: 60.1, east: 18.0, west: 14.9 },
		},
	},
	{
		id: "dintur",
		aliases: [],
		displayLabel: "Din Tur - Västernorrland",
		regionSlug: "dintur",
		seoArea: "Västernorrland",
		crestIcon: regionCrestIconByOperator.dintur,
		mapView: {
			defaultCenter: { lat: 62.3908, lng: 17.3069 },
			restriction: { north: 64.1, south: 61.7, east: 19.2, west: 15.4 },
		},
	},
];

const OPERATOR_LOOKUP = new Map<string, OperatorRegistryEntry>();
for (const entry of OPERATOR_REGISTRY) {
	OPERATOR_LOOKUP.set(entry.id, entry);
	for (const alias of entry.aliases) {
		OPERATOR_LOOKUP.set(alias, entry);
	}
}

export function canonicalizeOperatorSlug(slug: string): string {
	const key = slug.trim().toLowerCase();
	return OPERATOR_LOOKUP.get(key)?.id ?? key;
}

export function getOperatorRegistryEntryBySlug(
	slug: string | null | undefined,
): OperatorRegistryEntry | null {
	if (!slug) return null;
	return OPERATOR_LOOKUP.get(slug.trim().toLowerCase()) ?? null;
}

export function getOperatorRegistryEntryById(
	id: string | null | undefined,
): OperatorRegistryEntry | null {
	if (!id) return null;
	const key = id.trim().toLowerCase();
	return OPERATOR_REGISTRY.find((x) => x.id === key) ?? null;
}

export function getOperatorSeoArea(slug: string | null | undefined): string | null {
	if (!slug) return null;
	return getOperatorRegistryEntryBySlug(slug)?.seoArea ?? null;
}
