import { Suspense } from "react";
import { ItemScreen } from "@/components/item-screen";

// params are only known per request: read them inside Suspense so the shell still prerenders
export default function ItemPage({ params }: PageProps<"/closet/[garmentId]">) {
  return (
    <Suspense>
      <Item params={params} />
    </Suspense>
  );
}

async function Item({ params }: Pick<PageProps<"/closet/[garmentId]">, "params">) {
  const { garmentId } = await params;
  return <ItemScreen garmentId={garmentId} />;
}
