import { NextRequest, NextResponse } from "next/server";
import { Connection, Client } from "@temporalio/client";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
    console.log(">>> [API] Temporal Execute Hit");
    try {
        const body = await request.json();
        console.log(">>> [API] Request body:", body);
        const { query, workflowId: providedId } = body;

        if (!query) {
            return NextResponse.json({ error: "Query is required" }, { status: 400 });
        }

        const workflowId = providedId || `sql-query-${uuidv4()}`;

        // Connect to Temporal
        const connection = await Connection.connect({ address: "127.0.0.1:7233" });
        const client = new Client({ connection });

        // Start Workflow
        console.log(`>>> [API] Starting workflow ExecuteSQLWorkflow on sql-tasks-v2 with ID: ${workflowId}`);
        const handle = await client.workflow.start("ExecuteSQLWorkflow", {
            taskQueue: "sql-tasks-v2",
            workflowId: workflowId,
            args: [query],
        });
        console.log(`>>> [API] Started workflow: ${handle.workflowId}`);
        console.log(`>>> [API] Started workflow: ${handle.workflowId}`);

        console.log(`Started workflow ${handle.workflowId}`);

        const startTime = Date.now();
        // Wait for result
        const result = await handle.result();
        const duration = Date.now() - startTime;

        // Check if result is binary (Arrow IPC)
        let responseData = result;
        let isBinary = false;

        if (Buffer.isBuffer(result) || result instanceof Uint8Array) {
            responseData = Buffer.from(result).toString("base64");
            isBinary = true;
        }

        return NextResponse.json({
            success: true,
            data: responseData,
            isBinary: isBinary,
            execution_time_ms: duration,
        });
    } catch (error: any) {
        if (error.message?.includes('Kullanıcı tarafından durduruldu')) {
            console.log(`>>> [API] Workflow terminated by user: ${error.message}`);
        } else {
            console.error("Temporal error:", error);
        }
        return NextResponse.json(
            { error: error.message || "Temporal execution failed" },
            { status: 500 }
        );
    }
}

export async function GET() {
    return NextResponse.json({ message: "Temporal API is up and running!" });
}
