import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import path from "path";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

// Load Flight Protos
const PROTO_PATH = path.join(process.cwd(), "app/api/flight/Flight.proto");
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [path.join(process.cwd(), "app/api/flight")]
});

const grpcObj: any = grpc.loadPackageDefinition(packageDefinition);
const flightProto = grpcObj.arrow.flight.protocol;

export async function POST(request: NextRequest) {
    const sessionId = request.headers.get("x-session-id") || "default";
    const body = await request.json();
    const { query, criteria, connectionId } = body;
    // const sessionId = request.headers.get("x-session-id") || "default"; // This line is replaced

    // Use environment variable for Flight server location
    const location = process.env.ARROW_FLIGHT_URL || "localhost:8815";
    const client = new flightProto.FlightService(location, grpc.credentials.createInsecure());

    // Prepare Descriptor (CMD type)
    const descriptor = {
        type: "CMD",
        cmd: Buffer.from(JSON.stringify({ query, criteria, session_id: sessionId, connection_id: connectionId })),
    };

    return new Promise((resolve) => {
        // 1. Get Flight Info
        client.GetFlightInfo(descriptor, async (err: any, info: any) => {
            if (err) {
                console.error("GetFlightInfo Error:", err);
                resolve(NextResponse.json({ error: err.message }, { status: 500 }));
                return;
            }

            if (!info.endpoint || info.endpoint.length === 0) {
                resolve(NextResponse.json({ error: "No endpoints found" }, { status: 404 }));
                return;
            }

            // 2. DoGet via the ticket from the first endpoint
            const ticket = info.endpoint[0].ticket;
            const call = client.DoGet(ticket);

            // We wrap the stream start in a promise to control the initial response type (200 Stream vs 500 JSON)
            // This prevents ERR_EMPTY_RESPONSE when the backend errors immediately.
            const streamPromise = new Promise<NextResponse>((resolveStream, rejectStream) => {
                let streamStarted = false;
                let controllerRef: ReadableStreamDefaultController | null = null;
                let pendingData: any[] = [];

                const readable = new ReadableStream({
                    start(controller) {
                        controllerRef = controller;
                        // Flush any pending data that arrived while we were waiting for the stream to initialize
                        if (pendingData.length > 0) {
                            for (const d of pendingData) {
                                controller.enqueue(d);
                            }
                            pendingData = [];
                        }
                    },
                    cancel() {
                        call.cancel();
                    }
                });

                call.on('data', (flightData: any) => {
                    const header = flightData.data_header;
                    const body = flightData.data_body;

                    const chunks: Buffer[] = [];

                    if (header && header.length > 0) {
                        const continuationBuf = Buffer.alloc(4);
                        continuationBuf.writeUInt32LE(0xFFFFFFFF, 0);
                        const headerLenBuf = Buffer.alloc(4);
                        headerLenBuf.writeInt32LE(header.length, 0);
                        chunks.push(continuationBuf, headerLenBuf, header);
                    }

                    if (body && body.length > 0) {
                        chunks.push(body);
                    }

                    if (chunks.length > 0) {
                        if (!streamStarted) {
                            streamStarted = true;
                            // Resolve the main promise with the success stream response
                            resolveStream(new NextResponse(readable, {
                                headers: {
                                    'Content-Type': 'application/vnd.apache.arrow.stream',
                                    'Cache-Control': 'no-cache',
                                    'Connection': 'keep-alive',
                                },
                            }));
                        }

                        // Push to controller OR buffer if controller isn't ready
                        chunks.forEach(chunk => {
                            if (controllerRef) {
                                controllerRef.enqueue(chunk);
                            } else {
                                pendingData.push(chunk);
                            }
                        });
                    }
                });

                call.on('end', () => {
                    if (!streamStarted) {
                        // Empty stream? Resolve with empty success.
                        streamStarted = true;
                        resolveStream(new NextResponse(readable, {
                            headers: {
                                'Content-Type': 'application/vnd.apache.arrow.stream',
                            },
                        }));
                    }

                    const continuationBuf = Buffer.alloc(4);
                    continuationBuf.writeUInt32LE(0xFFFFFFFF, 0);
                    const endBuf = Buffer.alloc(4);
                    endBuf.writeInt32LE(0, 0);

                    if (controllerRef) {
                        controllerRef.enqueue(continuationBuf);
                        controllerRef.enqueue(endBuf);
                        controllerRef.close();
                    }
                });

                call.on('error', (err: any) => {
                    console.error("DoGet Stream Error:", err);
                    if (!streamStarted) {
                        streamStarted = true;
                        // Backend error on startup -> Return JSON Error Response
                        resolveStream(NextResponse.json({ error: err.message || "Query execution failed" }, { status: 500 }));
                    } else {
                        // Stream already started sending 200 OK, can only error server-side
                        if (controllerRef) {
                            try { controllerRef.error(err); } catch { }
                        }
                    }
                });
            });

            resolve(await streamPromise);
        });
    });
}
