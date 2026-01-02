import { NextRequest, NextResponse } from "next/server";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import path from "path";

// Load Protobuf from consistent location
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
    const location = process.env.ARROW_FLIGHT_URL || "127.0.0.1:8815";
    const client = new flightProto.FlightService(location, grpc.credentials.createInsecure());

    const templates: any[] = [];

    return new Promise((resolve) => {
        const call = client.ListFlights({ expression: Buffer.alloc(0) });

        call.on("data", (info: any) => {
            try {
                if (info.flight_descriptor && info.flight_descriptor.cmd) {
                    const cmdText = Buffer.from(info.flight_descriptor.cmd).toString("utf-8");
                    const cmd = JSON.parse(cmdText);
                    templates.push(cmd);
                }
            } catch (e) {
                console.error("Error parsing flight info:", e);
            }
        });

        call.on("end", () => {
            client.close();
            resolve(NextResponse.json(templates));
        });

        call.on("error", (err: any) => {
            console.error("ListFlights Error:", err);
            client.close();
            resolve(NextResponse.json({ error: err.message }, { status: 500 }));
        });
    });
}
