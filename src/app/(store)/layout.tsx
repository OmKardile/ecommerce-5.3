import { Header } from "@/components/storefront/header";
import { Footer } from "@/components/storefront/footer";
import { CompareTray } from "@/components/storefront/compare-tray";
import { CartHydrator } from "@/store/cart-hydrator";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <CartHydrator />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <CompareTray />
    </div>
  );
}
