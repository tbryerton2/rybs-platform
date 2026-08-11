export type PlatformBusinessFormValues = {
  businessName: string;
  slug: string;
  status: string;
};

export type PlatformBusinessFormFieldErrors = Partial<
  Record<"businessName" | "slug" | "status" | "tenantId" | "confirmation" | "updatedAt", string>
>;

export type PlatformBusinessFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: PlatformBusinessFormFieldErrors;
  values: PlatformBusinessFormValues;
};

export function getInitialPlatformBusinessFormState(
  values: PlatformBusinessFormValues,
): PlatformBusinessFormState {
  return {
    status: "idle",
    values,
  };
}
