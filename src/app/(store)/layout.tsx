import { Header } from "@/components/storefront/header";
import { Footer } from "@/components/storefront/footer";
import { CompareTray } from "@/components/storefront/compare-tray";
import { CartHydrator } from "@/store/cart-hydrator";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg"
      >
        Skip to content
      </a>
      <CartHydrator />
      <Header />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <Footer />
      <CompareTray />
    </div>
  );
}
