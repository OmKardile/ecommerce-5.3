import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/session";
import { db } from "@/lib/db";
import { AccountAddressBook } from "@/components/storefront/account-address-book";

export const metadata: Metadata = {
  title: "Address Book",
  description: "Saved delivery addresses used at checkout.",
};

export default async function AccountAddressesPage() {
  const session = await getCustomerSession();
  if (!session) redirect("/account/login?next=%2Faccount%2Faddresses");

  const customer = await db.customer.findUnique({
    where: { userId: session.userId },
    include: { addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] } },
  });

  const addresses =
    customer?.addresses.map((a) => ({
      id: a.id,
      recipientName: a.recipientName,
      phone: a.phone,
      addressLine1: a.addressLine1,
      addressLine2: a.addressLine2,
      landmark: a.landmark,
      city: a.city,
      state: a.state,
      pincode: a.pincode,
      isDefault: a.isDefault,
      type: a.type,
    })) ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:py-14">
      <header className="mb-8">
        <p className="label-caps mb-2">Your account</p>
        <h1 className="font-display text-3xl sm:text-4xl">Address book</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Saved addresses are offered at checkout. The default address is pre-selected; site or warehouse drops can be marked per job.
        </p>
      </header>
      <AccountAddressBook addresses={addresses} />
    </div>
  );
}
