"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { beginBookingHistory, completeBookingHistory } from "@/lib/booking-navigation";
import { getTenantStorageKey, TENANT_STORAGE_KEYS } from "@/lib/tenant/runtime";

const draftKey = () => getTenantStorageKey(TENANT_STORAGE_KEYS.booking);
export function Start() {
  const router = useRouter();
  return <><button onClick={() => {beginBookingHistory(); sessionStorage.setItem(draftKey(), "test draft"); router.push("/book/address");}}>Start new booking</button>
    <Link href="/book/address?reorderFrom=fixture">Book again</Link></>;
}
export function Address() { return <><h2>Service ZIP</h2><Link href="/checkout">Continue to checkout</Link></>; }
export function Checkout() {
  const router = useRouter();
  useEffect(() => { if (!sessionStorage.getItem(draftKey())) router.replace("/book/address"); }, [router]);
  function complete(legacy = false) {
    const bookingId = crypto.randomUUID();
    if (!legacy) completeBookingHistory(window, undefined, bookingId);
    sessionStorage.removeItem(draftKey());
    router.push(`/success?bookingId=${bookingId}`);
  }
  return <><h2>Checkout</h2><button onClick={() => {
    const state = {...history.state}; delete state.retailBooking;
    history.replaceState(state, "");
  }}>Discard custom history metadata</button>
    <button onClick={() => complete()}>Complete simulated booking</button>
    <button onClick={() => complete(true)}>Complete with older checkout code</button></>;
}
export function Inspector() {
  const [value, setValue] = useState("");
  return <><hr /><button onClick={() => setValue(JSON.stringify({ path: location.pathname,
    marker: history.state?.retailBooking ?? null,
    version: sessionStorage.getItem(getTenantStorageKey(TENANT_STORAGE_KEYS.bookingHistoryVersion)),
  }))}>Inspect navigation</button><pre>{value}</pre></>;
}
