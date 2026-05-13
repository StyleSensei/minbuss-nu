import { useEffect, useState } from "react";

export type OperatorsMeta = {
	operators: string[];
	defaultOperator: string;
};

export function useOperatorsMeta(): OperatorsMeta | null {
	const [operatorsMeta, setOperatorsMeta] = useState<OperatorsMeta | null>(
		null,
	);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const resp = await fetch("/api/operators");
				const m = (await resp.json()) as OperatorsMeta;
				if (!cancelled) setOperatorsMeta(m);
			} catch {
				if (!cancelled) {
					setOperatorsMeta({ operators: ["sl"], defaultOperator: "sl" });
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	return operatorsMeta;
}
