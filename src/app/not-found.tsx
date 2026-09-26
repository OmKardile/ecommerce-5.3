import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-20">
      <div className="max-w-lg text-center">
        <p className="label-caps">404 · Signal lost</p>
        <h1 className="mt-4 font-display text-4xl tracking-tight sm:text-5xl">This feed is offline.</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
          The page you requested doesn&rsquo;t exist or has been moved. The rest of the store is online and dispatching.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild className="rounded-full px-6">
            <Link href="/">Back to home</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full px-6">
            <Link href="/products">Browse catalog</Link>
          </Button>
          <Button asChild variant="ghost" className="rounded-full px-6">
            <Link href="/track">Track an order</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
