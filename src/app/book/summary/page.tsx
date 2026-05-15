import { redirect } from "next/navigation";

export default async function SummaryStepPage() {
  redirect("/confirm");
}
