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

export async function GET(request: NextRequest) {
    const sessionId = request.headers.get("x-session-id") || request.nextUrl.searchParams.get("session_id") || "default";
    const location = process.env.ARROW_FLIGHT_URL || "127.0.0.1:8815";
    const client = new flightProto.FlightService(location, grpc.credentials.createInsecure());

    const action = {
        type: "get_schema",
        body: Buffer.from(JSON.stringify({ session_id: sessionId })),
    };

    return new Promise((resolve) => {
        const stream = client.DoAction(action);
        let result = Buffer.alloc(0);

        stream.on('data', (response: any) => {
            // Response is Result message, has body field
            if (response.body) {
                result = Buffer.concat([result, response.body]);
            }
        });

        stream.on('end', () => {
            client.close();
            try {
                // Backend returns the schema JSON directly
                const jsonResult = JSON.parse(result.toString());
                resolve(NextResponse.json(jsonResult));
            } catch (e: any) {
                console.error("Schema Parse Error:", e);
                // Fallback for empty or error cases
                resolve(NextResponse.json({
                    name: "Error",
                    models: [],
                    tables: [],
                    error: "Failed to parse schema"
                }));
            }
        });

        stream.on('error', (err: any) => {
            console.error("DoAction Error (get_schema):", err);
            client.close();
            resolve(NextResponse.json({ error: err.message }, { status: 500 }));
        });
    });
}
