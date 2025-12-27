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
            let isClosed = false;

            const safeEnqueue = (chunk: any) => {
                if (isClosed) return;
                try {
                    controller.enqueue(chunk);
                } catch (e) {
                    console.error("Controller enqueue error:", e);
                    isClosed = true;
                }
            };

            const safeClose = () => {
                if (isClosed) return;
                try {
                    controller.close();
                } catch (e) {
                    // Ignore if already closed
                } finally {
                    isClosed = true;
                }
            };

            const safeError = (err: any) => {
                if (isClosed) return;
                try {
                    controller.error(err);
                } catch (e) {
                    // ignore
                } finally {
                    isClosed = true;
                }
            }


            child.stdout.on('data', (chunk) => {
                safeEnqueue(chunk);
            });

            child.stderr.on('data', (chunk) => {
                const errorMsg = chunk.toString();
                // console.error("Bridge Stderr:", errorMsg);
                // Only log critical errors or find a way to pass them to UI if needed
            });

            child.on('close', (code) => {
                if (code !== 0) {
                    console.error(`Bridge exited with code ${code}`);
                }
                safeClose();
            });

            child.on('error', (err) => {
                console.error("Bridge Spawn Error:", err);
                safeError(err);
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
