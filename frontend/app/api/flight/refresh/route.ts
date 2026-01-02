import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import path from "path";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

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
    const { tableName } = await request.json();
    const sessionId = request.headers.get("x-session-id") || "default";
    const location = process.env.ARROW_FLIGHT_URL || "127.0.0.1:8815";
    const client = new flightProto.FlightService(location, grpc.credentials.createInsecure());

    const action = {
        type: tableName ? "refresh_table" : "refresh_all",
        body: Buffer.from(JSON.stringify({ table_name: tableName, session_id: sessionId }))
    };

    return new Promise((resolve) => {
        const stream = client.DoAction(action);
        let finished = false;

        stream.on('data', (result: any) => {
            finished = true;
            resolve(NextResponse.json({ success: true }));
        });

        stream.on('end', () => {
            if (!finished) {
                resolve(NextResponse.json({ success: true }));
            }
        });

        stream.on('error', (err: any) => {
            console.error("Refresh Action Error:", err);
            resolve(NextResponse.json({ error: err.message }, { status: 500 }));
        });
    });
}
