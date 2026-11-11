export const enquiryRoutes = [
  "enquiry-process review",
  "custom automation",
] as const;
export type EnquiryRoute = (typeof enquiryRoutes)[number];
export const enquiryRouteLabels: Record<EnquiryRoute, string> = {
  "enquiry-process review": "Enquiry-process review",
  "custom automation": "Custom automation",
};

export const serviceEnquirySuccess =
  "Thanks—your enquiry has been received. We’ll review what you’ve shared and contact you about the next step.";
