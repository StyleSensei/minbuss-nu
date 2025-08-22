import Link from "next/link";

export default function NotFound() {
	return (
		<main>
			<div className="min-h-screen flex items-center justify-center ">
				<div className="text-center space-y-6 px-4">
					<h1 className="text-6xl md:text-8xl font-bold text-background">
						404
					</h1>
					<div className="space-y-4">
						<p className="text-xl md:text-2xl text-background">
							Sidan kunde tyvärr inte hittas
						</p>
						<p className="text-base text-background max-w-md mx-auto">
							Sidan du letar efter finns inte eller har flyttats.
						</p>
					</div>
					<Link
						href="/"
						className="inline-flex items-center justify-center px-6! py-3! mt-6! text-sm font-medium text-background bg-accent rounded-xl hover:bg-accent/90 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
					>
						Tillbaka till startsidan
					</Link>
				</div>
			</div>
		</main>
	);
}
