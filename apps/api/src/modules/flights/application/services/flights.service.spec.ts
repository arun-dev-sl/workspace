import { describe, expect, it, vi } from "vitest";

import { FlightsService } from "@/modules/flights/application/services/flights.service";

import type { Env } from "@/app/config/env.schema";
import type { RawEmailRepository } from "@/modules/expenses/application/ports/raw-email.repository.port";
import type { SyncJobRepository } from "@/modules/expenses/application/ports/sync-job.repository.port";
import type { FlightActivityRepository } from "@/modules/flights/application/ports/flight-activity.repository.port";
import type { FlightEmailProcessingRepository } from "@/modules/flights/application/ports/flight-email-processing.repository.port";
import type { HybridFlightExtractor } from "@/modules/flights/infrastructure/extractors/hybrid-flight.extractor";
import type { EmailSyncService } from "@/shared/application/services/email-sync.service";
import type { ConfigService } from "@nestjs/config";
import type { RawEmail } from "@workspace/domain";

const baseEmail: RawEmail = {
    id: "email-1",
    userId: "user-1",
    provider: "gmail",
    providerMessageId: "provider-1",
    from: "bookings@airline.example",
    subject: "Your flight itinerary",
    snippet: "Flight IX1086 from BLR to VNS",
    receivedAt: "2025-10-20T08:00:00.000Z",
    bodyText: "Travel confirmation for your upcoming trip. Details attached.",
    bodyHtml: undefined,
    rawHeaders: {},
    category: "flights",
};

function createService(overrides?: {
    hybridExtract?: Partial<HybridFlightExtractor>;
    processingRepo?: Partial<FlightEmailProcessingRepository>;
    activityRepo?: Partial<FlightActivityRepository>;
    config?: Partial<ConfigService<Env, true>>;
}) {
    const flightActivityRepository: FlightActivityRepository = {
        upsertMany: vi.fn(),
        update: vi.fn(),
        listByUser: vi.fn(),
        listBySourceEmailId: vi.fn().mockResolvedValue([]),
        countByUser: vi.fn(),
        findById: vi.fn(),
        ...overrides?.activityRepo,
    };

    const flightEmailProcessingRepository: FlightEmailProcessingRepository = {
        findBySourceEmailId: vi.fn().mockResolvedValue(null),
        upsert: vi.fn(),
        listEmailsForProcessing: vi.fn(),
        listEmailsBySourceEmailIds: vi.fn(),
        listLlmReviewCandidates: vi.fn(),
        ...overrides?.processingRepo,
    };

    const syncJobRepository: SyncJobRepository = {
        create: vi.fn(),
        findById: vi.fn(),
        findByUserId: vi.fn(),
        findLastCompletedByUserId: vi.fn(),
        update: vi.fn(),
        incrementProgress: vi.fn(),
    };

    const rawEmailRepository: RawEmailRepository = {
        upsert: vi.fn(),
        findById: vi.fn(),
        findByProviderMessageId: vi.fn(),
        listByUser: vi.fn(),
        listAllByUser: vi.fn(),
        listUnprocessedByUser: vi.fn(),
        countByUser: vi.fn(),
    };

    const emailSyncService: EmailSyncService = {
        startSync: vi.fn(),
        buildIncrementalQuery: vi.fn(),
        getSyncJobStatus: vi.fn(),
        getUserSyncJobs: vi.fn(),
        fetchPreviewEmails: vi.fn(),
        runSyncForExistingJob: vi.fn(),
    } as unknown as EmailSyncService;

    const hybridFlightExtractor: HybridFlightExtractor = {
        extract: vi.fn().mockResolvedValue({
            segments: [],
            extractionMethod: "none",
            llmAttempted: false,
        }),
        ...overrides?.hybridExtract,
    } as unknown as HybridFlightExtractor;

    const configService = {
        get: vi.fn((key: string) => {
            switch (key) {
                case "FLIGHTS_LLM_ENABLED": {
                    return true;
                }
                case "GEMINI_API_KEY": {
                    return "test-key";
                }
                case "FLIGHTS_LLM_MAX_INPUT_CHARS": {
                    return 12_000;
                }
                case "FLIGHTS_LLM_MAX_CALLS_PER_JOB": {
                    return 25;
                }
                default: {
                    return;
                }
            }
        }),
        ...overrides?.config,
    } as unknown as ConfigService<Env, true>;

    const service = new FlightsService(
        flightActivityRepository,
        flightEmailProcessingRepository,
        rawEmailRepository,
        syncJobRepository,
        emailSyncService,
        hybridFlightExtractor,
        configService,
    );

    return {
        service,
        flightActivityRepository,
        flightEmailProcessingRepository,
        rawEmailRepository,
        hybridFlightExtractor,
    };
}

describe("flightsService", () => {
    it("disables LLM calls for emails that already exhausted their lifetime attempt", async () => {
        const { service, flightEmailProcessingRepository, hybridFlightExtractor } = createService({
            processingRepo: {
                findBySourceEmailId: vi.fn().mockResolvedValue({
                    id: "processing-1",
                    userId: "user-1",
                    sourceEmailId: "email-1",
                    status: "no_match",
                    extractionMethod: "llm",
                    matchedActivities: 0,
                    llmAttempts: 1,
                    lastError: null,
                    processedAt: "2025-10-20T08:00:00.000Z",
                    createdAt: "2025-10-20T08:00:00.000Z",
                    updatedAt: "2025-10-20T08:00:00.000Z",
                }),
            },
            hybridExtract: {
                extract: vi.fn().mockResolvedValue({
                    segments: [],
                    extractionMethod: "none",
                    llmAttempted: false,
                }),
            },
        });

        const processSingleEmail = Reflect.get(service, "processSingleEmail") as (
            email: RawEmail,
            remainingLlmCalls: number,
        ) => Promise<{ activities: number; llmCallsUsed: number }>;

        await processSingleEmail.call(service, baseEmail, 10);

        expect(hybridFlightExtractor.extract).toHaveBeenCalledWith(
            baseEmail,
            expect.objectContaining({
                allowLlm: false,
            }),
        );
        expect(flightEmailProcessingRepository.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                status: "no_match",
                llmAttempts: 1,
            }),
        );
    });

    it("marks emails as failed when LLM budget is exhausted before fallback", async () => {
        const { service, flightEmailProcessingRepository } = createService({
            hybridExtract: {
                extract: vi.fn().mockResolvedValue({
                    segments: [],
                    extractionMethod: "none",
                    llmAttempted: false,
                    failureReason: "llm_budget_exhausted",
                }),
            },
        });

        const processSingleEmail = Reflect.get(service, "processSingleEmail") as (
            email: RawEmail,
            remainingLlmCalls: number,
        ) => Promise<{ activities: number; llmCallsUsed: number }>;

        await processSingleEmail.call(service, baseEmail, 0);

        expect(flightEmailProcessingRepository.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                status: "failed",
                lastError: "llm_budget_exhausted",
            }),
        );
    });

    it("skips automatic reprocessing when a source email already has manual corrections", async () => {
        const { service, flightActivityRepository, hybridFlightExtractor } = createService({
            activityRepo: {
                listBySourceEmailId: vi.fn().mockResolvedValue([
                    {
                        id: "activity-1",
                        userId: "user-1",
                        sourceEmailId: "email-1",
                        activityType: "booking_confirmation",
                        extractionMethod: "manual",
                        canonicalHash: "hash-1",
                        segmentIndex: 0,
                        pnr: "ABC123",
                        airlineName: "Airline",
                        flightNumber: "IX1086",
                        fromAirport: "BLR",
                        toAirport: "VNS",
                        departureDate: "2025-10-20",
                        departureTime: "08:00",
                        arrivalDate: "2025-10-20",
                        arrivalTime: "10:45",
                        departureAt: null,
                        arrivalAt: null,
                        departureTimezone: null,
                        arrivalTimezone: null,
                        travelClass: null,
                        confidence: 1,
                        createdAt: "2025-10-20T08:00:00.000Z",
                        updatedAt: "2025-10-20T08:00:00.000Z",
                    },
                ]),
            },
        });

        const processSingleEmail = Reflect.get(service, "processSingleEmail") as (
            email: RawEmail,
            remainingLlmCalls: number,
        ) => Promise<{ activities: number; llmCallsUsed: number }>;

        const result = await processSingleEmail.call(service, baseEmail, 10);

        expect(result).toEqual({ activities: 0, llmCallsUsed: 0 });
        expect(hybridFlightExtractor.extract).not.toHaveBeenCalled();
        expect(flightActivityRepository.listBySourceEmailId).toHaveBeenCalledWith({
            userId: "user-1",
            sourceEmailId: "email-1",
        });
    });

    it("marks corrected flight activities as manual and normalizes updated fields", async () => {
        const existingActivity = {
            id: "activity-1",
            userId: "user-1",
            sourceEmailId: "email-1",
            activityType: "booking_confirmation",
            extractionMethod: "heuristic" as const,
            canonicalHash: "hash-1",
            segmentIndex: 0,
            pnr: null,
            airlineName: "Airline",
            flightNumber: "ix1086",
            fromAirport: "blr",
            toAirport: "vns",
            departureDate: "2025-10-20",
            departureTime: "08:00",
            arrivalDate: null,
            arrivalTime: null,
            departureAt: null,
            arrivalAt: null,
            departureTimezone: null,
            arrivalTimezone: null,
            travelClass: null,
            confidence: 0.8,
            createdAt: "2025-10-20T08:00:00.000Z",
            updatedAt: "2025-10-20T08:00:00.000Z",
        };

        const { service, flightActivityRepository } = createService({
            activityRepo: {
                findById: vi.fn().mockResolvedValue(existingActivity),
                update: vi
                    .fn()
                    .mockImplementation((activity: typeof existingActivity) =>
                        Promise.resolve(activity),
                    ),
            },
        });

        const updated = await service.updateFlightActivity({
            userId: "user-1",
            id: "activity-1",
            data: {
                pnr: " h5ltyz ",
                flightNumber: "ix 1086",
                fromAirport: "blr",
                toAirport: "vns",
                departureDate: "2025-10-21",
                departureTime: "09:30",
                travelClass: " economy plus ",
            },
        });

        expect(flightActivityRepository.update).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "activity-1",
                extractionMethod: "manual",
                pnr: "h5ltyz",
                flightNumber: "IX1086",
                fromAirport: "BLR",
                toAirport: "VNS",
                departureDate: "2025-10-21",
                departureTime: "09:30",
                travelClass: "Economy Plus",
                confidence: 1,
            }),
        );
        expect(updated.extractionMethod).toBe("manual");
        expect(updated.flightNumber).toBe("IX1086");
    });
});
