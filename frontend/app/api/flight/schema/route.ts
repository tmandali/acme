import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import path from "path";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import * as arrow from "apache-arrow";

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
    const location = process.env.ARROW_FLIGHT_URL || "localhost:8815";
    const client = new flightProto.FlightService(location, grpc.credentials.createInsecure());

    // DataFusion information_schema query
    const sql = `
        SELECT 
            table_name, 
            column_name, 
            data_type,
            is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
    `;

    const descriptor = {
        type: "CMD",
        cmd: Buffer.from(JSON.stringify({ query: sql, session_id: sessionId })),
    };

    return new Promise((resolve) => {
        client.GetFlightInfo(descriptor, (err: any, info: any) => {
            if (err) {
                console.error("Schema Fetch Error (GetFlightInfo):", err);
                resolve(NextResponse.json({ error: err.message }, { status: 500 }));
                return;
            }

            const ticket = info.endpoint[0].ticket;
            const call = client.DoGet(ticket);
            const chunks: Uint8Array[] = [];

            call.on('data', (flightData: any) => {
                if (flightData.data_header) {
                    const continuationBuf = Buffer.alloc(4);
                    continuationBuf.writeUInt32LE(0xFFFFFFFF, 0);
                    const headerLenBuf = Buffer.alloc(4);
                    headerLenBuf.writeInt32LE(flightData.data_header.length, 0);
                    chunks.push(new Uint8Array(continuationBuf));
                    chunks.push(new Uint8Array(headerLenBuf));
                    chunks.push(new Uint8Array(flightData.data_header));
                }
                if (flightData.data_body) {
                    chunks.push(new Uint8Array(flightData.data_body));
                }
            });

            call.on('end', async () => {
                try {
                    // IPC End marker
                    const continuationBuf = Buffer.alloc(4);
                    continuationBuf.writeUInt32LE(0xFFFFFFFF, 0);
                    const endBuf = Buffer.alloc(4);
                    endBuf.writeInt32LE(0, 0);
                    chunks.push(new Uint8Array(continuationBuf));
                    chunks.push(new Uint8Array(endBuf));

                    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
                    const combined = new Uint8Array(totalLength);
                    let offset = 0;
                    for (const chunk of chunks) {
                        combined.set(chunk, offset);
                        offset += chunk.length;
                    }

                    const table = arrow.tableFromIPC(combined);
                    const rows = table.toArray();

                    // Group by table_name
                    const schemaMap: Record<string, any> = {};
                    rows.forEach((row: any) => {
                        const tableName = row.table_name;
                        if (!schemaMap[tableName]) {
                            schemaMap[tableName] = { name: tableName, columns: [] };
                        }
                        schemaMap[tableName].columns.push({
                            name: row.column_name,
                            type: row.data_type,
                            nullable: row.is_nullable === 'YES'
                        });
                    });

                    const result = {
                        name: "DataFusion Schema",
                        models: [],
                        tables: Object.values(schemaMap)
                    };

                    resolve(NextResponse.json(result));
                } catch (e: any) {
                    console.error("Schema Parse Error:", e);
                    resolve(NextResponse.json({ error: e.message }, { status: 500 }));
                } finally {
                    client.close();
                }
            });

            call.on('error', (err: any) => {
                console.error("Schema Fetch Error (DoGet):", err);
                client.close();
                resolve(NextResponse.json({ error: err.message }, { status: 500 }));
            });
        });
    });
}
