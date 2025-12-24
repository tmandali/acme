import { NextRequest, NextResponse } from "next/server";
import { Connection, Client } from "@temporalio/client";

export async function POST(request: NextRequest) {
    console.log(">>> [API] Temporal Cancel Hit");
    try {
        const { workflowId } = await request.json();

        if (!workflowId) {
            return NextResponse.json({ error: "workflowId is required" }, { status: 400 });
        }

        const connection = await Connection.connect({ address: "localhost:7233" });
        const client = new Client({ connection });

        const handle = client.workflow.getHandle(workflowId);

        console.log(`>>> [API] Terminating workflow: ${workflowId}`);
        await handle.terminate("Kullanıcı tarafından durduruldu");

        return NextResponse.json({ success: true, message: "Sorgu durduruldu" });
    } catch (error: any) {
        console.error("Temporal cancel error:", error);
        return NextResponse.json(
            { error: error.message || "Sorgu durdurulamadı" },
            { status: 500 }
        );
    }
}
