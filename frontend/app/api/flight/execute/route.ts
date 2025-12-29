import { NextRequest, NextResponse } from "next/server";
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
    const body = await request.json();
    const { query, criteria } = body;

    // Use environment variable for Flight server location
    const location = process.env.ARROW_FLIGHT_URL || "localhost:8815";
    const client = new flightProto.FlightService(location, grpc.credentials.createInsecure());

    // Prepare Descriptor (CMD type)
    const descriptor = {
        type: "CMD",
        cmd: Buffer.from(JSON.stringify({ query, criteria })),
    };

    return new Promise((resolve) => {
        // 1. Get Flight Info
        client.GetFlightInfo(descriptor, (err: any, info: any) => {
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

            const stream = new ReadableStream({
                start(controller) {
                    call.on('data', (flightData: any) => {
                        const header = flightData.data_header;
                        const body = flightData.data_body;

                        // 1. Eğer pakette başlık (metadata) varsa, yeni bir IPC mesajı başlat
                        if (header && header.length > 0) {
                            // Continuation token (0xFFFFFFFF)
                            const continuationBuf = Buffer.alloc(4);
                            continuationBuf.writeUInt32LE(0xFFFFFFFF, 0);

                            // Header length (4 bytes)
                            const headerLenBuf = Buffer.alloc(4);
                            headerLenBuf.writeInt32LE(header.length, 0);

                            controller.enqueue(continuationBuf);
                            controller.enqueue(headerLenBuf);
                            controller.enqueue(header);
                        }

                        // 2. Eğer pakette gövde (data) varsa, mevcut mesajın devamı olarak ekle
                        if (body && body.length > 0) {
                            controller.enqueue(body);
                        }
                    });

                    call.on('end', () => {
                        // IPC End of Stream marker (0x00000000)
                        // Bazı okuyucular continuation token bekler
                        const continuationBuf = Buffer.alloc(4);
                        continuationBuf.writeUInt32LE(0xFFFFFFFF, 0);
                        const endBuf = Buffer.alloc(4);
                        endBuf.writeInt32LE(0, 0);

                        controller.enqueue(continuationBuf);
                        controller.enqueue(endBuf);
                        controller.close();
                    });

                    call.on('error', (err: any) => {
                        console.error("DoGet Stream Error:", err);
                        controller.error(err);
                    });
                },
                cancel() {
                    call.cancel();
                }
            });

            resolve(new NextResponse(stream, {
                headers: {
                    'Content-Type': 'application/vnd.apache.arrow.stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
            }));
        });
    });
}
