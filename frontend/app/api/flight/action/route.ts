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
    const { actionType, payload } = await request.json();

    if (!actionType) {
        return NextResponse.json({ error: "Missing actionType" }, { status: 400 });
    }

    const location = process.env.ARROW_FLIGHT_URL || "localhost:8815";
    const client = new flightProto.FlightService(location, grpc.credentials.createInsecure());

    const action = {
        type: actionType,
        body: Buffer.from(JSON.stringify(payload || {})),
    };

    return new Promise((resolve) => {
        const stream = client.DoAction(action);
        let result = Buffer.alloc(0);

        stream.on('data', (response: any) => {
            // Response body is bytes
            if (response.body) {
                result = Buffer.concat([result, response.body]);
            }
        });

        stream.on('end', () => {
            try {
                const jsonResult = JSON.parse(result.toString());
                resolve(NextResponse.json(jsonResult));
            } catch (e) {
                // Might be empty or raw string
                resolve(NextResponse.json({ success: true, raw: result.toString() }));
            }
        });

        stream.on('error', (err: any) => {
            console.error("DoAction Error:", err);
            resolve(NextResponse.json({ error: err.message }, { status: 500 }));
        });
    });
}
