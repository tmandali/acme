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
        const connection = await Connection.connect({ address: "localhost:7233" });
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

        // Wait for result
        const result = await handle.result();

        return NextResponse.json({
            success: true,
            data: result,
            execution_time_ms: 0, // We could track this if needed
        });
    } catch (error: any) {
        console.error("Temporal error:", error);
        return NextResponse.json(
            { error: error.message || "Temporal execution failed" },
            { status: 500 }
        );
    }
}

export async function GET() {
    return NextResponse.json({ message: "Temporal API is up and running!" });
}
