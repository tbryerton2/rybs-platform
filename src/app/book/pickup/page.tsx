import { redirect } from "next/navigation";

export default async function PickupStepPage() {
  redirect("/confirm");
}
