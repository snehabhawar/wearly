import { Suspense } from "react";
import { StyleScreen } from "@/components/style-screen";

// params are only known per request: read them inside Suspense so the shell still prerenders
export default function StylePage({ params, searchParams }: PageProps<"/style/[garmentId]">) {
  return (
    <Suspense>
      <Style params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Style({ params, searchParams }: Pick<PageProps<"/style/[garmentId]">, "params" | "searchParams">) {
  const [{ garmentId }, { from }] = await Promise.all([params, searchParams]);
  // Opened from the Swipe deck (?from=swipe) or from the item page
  const back = from === "swipe" ? { href: "/swipe", label: "Swipe" } : { href: `/closet/${garmentId}`, label: "Item" };
  return <StyleScreen garmentId={garmentId} back={back} />;
}
