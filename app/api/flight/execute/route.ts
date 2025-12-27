import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export async function POST(request: NextRequest) {
    const body = await request.json();
    const pythonPath = path.join(process.cwd(), ".venv/bin/python");
    const scriptPath = path.join(process.cwd(), "flight_query_server/bridge.py");
    const commandJson = JSON.stringify(body);

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        start(controller) {
            const child = spawn(pythonPath, [scriptPath, "exec", commandJson]);

            child.stdout.on('data', (chunk) => {
                controller.enqueue(chunk);
            });

            child.stderr.on('data', (chunk) => {
                const errorMsg = chunk.toString();
                console.error("Bridge Stderr:", errorMsg);
                // Optionally send error as a special chunk if needed, 
                // but since we are streaming NDJSON, we can maybe ignore stderr unless it crashes
            });

            child.on('close', (code) => {
                if (code !== 0) {
                    // If it crashed, we might have already sent some data.
                    // The client will handle incomplete stream or parse errors.
                    console.error(`Bridge exited with code ${code}`);
                }
                controller.close();
            });

            child.on('error', (err) => {
                console.error("Bridge Spawn Error:", err);
                controller.error(err);
            });
        }
    });

    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'application/x-ndjson',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
