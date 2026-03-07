import { z, type ZodType } from "zod";

import { RawEmailSchema, type RawEmail } from "./email.js";

export const FlightActivityTypeSchema = z.enum(["booking_confirmation"]);
export type FlightActivityType = z.infer<typeof FlightActivityTypeSchema>;

export const FlightExtractionMethodSchema = z.enum([
  "none",
  "json_ld",
  "heuristic",
  "llm",
]);
export type FlightExtractionMethod = z.infer<
  typeof FlightExtractionMethodSchema
>;

export const FlightActivityExtractionMethodSchema = z.enum([
  "json_ld",
  "heuristic",
  "llm",
  "manual",
]);
export type FlightActivityExtractionMethod = z.infer<
  typeof FlightActivityExtractionMethodSchema
>;

export const FlightProcessingStatusSchema = z.enum([
  "matched",
  "no_match",
  "failed",
]);
export type FlightProcessingStatus = z.infer<
  typeof FlightProcessingStatusSchema
>;

export const FlightActivitySchema: ZodType<FlightActivity> = z.object({
  id: z.string(),
  userId: z.string(),
  sourceEmailId: z.string(),
  activityType: FlightActivityTypeSchema,
  extractionMethod: FlightActivityExtractionMethodSchema,
  canonicalHash: z.string(),
  segmentIndex: z.number().int().nonnegative(),
  pnr: z.string().nullable(),
  airlineName: z.string().nullable(),
  flightNumber: z.string(),
  fromAirport: z.string(),
  toAirport: z.string(),
  departureDate: z.string(),
  departureTime: z.string().nullable(),
  arrivalDate: z.string().nullable(),
  arrivalTime: z.string().nullable(),
  departureAt: z.string().nullable(),
  arrivalAt: z.string().nullable(),
  departureTimezone: z.string().nullable(),
  arrivalTimezone: z.string().nullable(),
  travelClass: z.string().nullable(),
  confidence: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export interface FlightActivity {
  id: string;
  userId: string;
  sourceEmailId: string;
  activityType: FlightActivityType;
  extractionMethod: FlightActivityExtractionMethod;
  canonicalHash: string;
  segmentIndex: number;
  pnr: string | null;
  airlineName: string | null;
  flightNumber: string;
  fromAirport: string;
  toAirport: string;
  departureDate: string;
  departureTime: string | null;
  arrivalDate: string | null;
  arrivalTime: string | null;
  departureAt: string | null;
  arrivalAt: string | null;
  departureTimezone: string | null;
  arrivalTimezone: string | null;
  travelClass: string | null;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

export const FlightEmailProcessingSchema: ZodType<FlightEmailProcessing> =
  z.object({
    id: z.string(),
    userId: z.string(),
    sourceEmailId: z.string(),
    status: FlightProcessingStatusSchema,
    extractionMethod: FlightExtractionMethodSchema,
    matchedActivities: z.number().int().nonnegative(),
    llmAttempts: z.number().int().nonnegative(),
    lastError: z.string().nullable(),
    processedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  });

export interface FlightEmailProcessing {
  id: string;
  userId: string;
  sourceEmailId: string;
  status: FlightProcessingStatus;
  extractionMethod: FlightExtractionMethod;
  matchedActivities: number;
  llmAttempts: number;
  lastError: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const FlightSyncJobStatusSchema: ZodType<FlightSyncJobStatus> = z.object(
  {
    id: z.string(),
    userId: z.string(),
    status: z.enum(["pending", "processing", "completed", "failed"]),
    query: z.string().nullable(),
    totalEmails: z.number().nullable(),
    processedEmails: z.number(),
    newEmails: z.number(),
    activities: z.number(),
    errorMessage: z.string().nullable(),
    startedAt: z.string().nullable(),
    completedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  },
);

export interface FlightSyncJobStatus {
  id: string;
  userId: string;
  status: "pending" | "processing" | "completed" | "failed";
  query: string | null;
  totalEmails: number | null;
  processedEmails: number;
  newEmails: number;
  activities: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const FlightLlmReviewCandidateStatusSchema = z.enum([
  "unprocessed",
  "no_match",
  "failed",
]);
export type FlightLlmReviewCandidateStatus = z.infer<
  typeof FlightLlmReviewCandidateStatusSchema
>;

export const FlightLlmReviewCandidateSchema: ZodType<FlightLlmReviewCandidate> =
  z.object({
    email: RawEmailSchema,
    status: FlightLlmReviewCandidateStatusSchema,
    extractionMethod: FlightExtractionMethodSchema,
    llmAttempts: z.number().int().nonnegative(),
    lastError: z.string().nullable(),
  });

export interface FlightLlmReviewCandidate {
  email: RawEmail;
  status: FlightLlmReviewCandidateStatus;
  extractionMethod: FlightExtractionMethod;
  llmAttempts: number;
  lastError: string | null;
}

export const StartFlightLlmReviewRequestSchema = z.object({
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type StartFlightLlmReviewRequest = z.infer<
  typeof StartFlightLlmReviewRequestSchema
>;

export const FlightLlmReviewCandidatesResponseSchema = z.object({
  data: z.array(FlightLlmReviewCandidateSchema),
});
export type FlightLlmReviewCandidatesResponse = z.infer<
  typeof FlightLlmReviewCandidatesResponseSchema
>;

export const ProcessFlightLlmReviewRequestSchema = z.object({
  emailIds: z.array(z.string().uuid()).min(1).max(100),
});
export type ProcessFlightLlmReviewRequest = z.infer<
  typeof ProcessFlightLlmReviewRequestSchema
>;

export const UpdateFlightActivityInputSchema = z
  .object({
    pnr: z.string().trim().min(1).max(32).nullable().optional(),
    airlineName: z.string().trim().min(1).max(120).nullable().optional(),
    flightNumber: z.string().trim().min(2).max(12).optional(),
    fromAirport: z.string().trim().min(3).max(8).optional(),
    toAirport: z.string().trim().min(3).max(8).optional(),
    departureDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    departureTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .nullable()
      .optional(),
    arrivalDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    arrivalTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .nullable()
      .optional(),
    departureAt: z.iso.datetime().nullable().optional(),
    arrivalAt: z.iso.datetime().nullable().optional(),
    departureTimezone: z.string().trim().min(1).max(64).nullable().optional(),
    arrivalTimezone: z.string().trim().min(1).max(64).nullable().optional(),
    travelClass: z.string().trim().min(1).max(64).nullable().optional(),
  })
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    {
      message: "At least one field must be provided",
    },
  );
export type UpdateFlightActivityInput = z.infer<
  typeof UpdateFlightActivityInputSchema
>;

export const StartFlightSyncJobResponseSchema = z.object({
  jobId: z.string(),
  message: z.string(),
});
export type StartFlightSyncJobResponse = z.infer<
  typeof StartFlightSyncJobResponseSchema
>;
