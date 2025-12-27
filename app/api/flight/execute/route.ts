import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import path from "path";

export async function POST(request: NextRequest) {
    const body = await request.json();
    const pythonPath = path.join(process.cwd(), ".venv/bin/python");
    const scriptPath = path.join(process.cwd(), "flight_query_server/bridge.py");

    // Command structure expected by Flight Server
    // body should be like { template: "report.yaml", criteria: { ... } }
    const commandJson = JSON.stringify(body);

    return new Promise((resolve) => {
        execFile(pythonPath, [scriptPath, "exec", commandJson], (error, stdout, stderr) => {
            if (error) {
                console.error("Bridge Error:", stderr);
                resolve(NextResponse.json({ success: false, error: stderr || "Execution failed" }, { status: 500 }));
                return;
            }
            try {
                const data = JSON.parse(stdout);
                resolve(NextResponse.json(data));
            } catch (e) {
                console.error("JSON Parse Error:", stdout);
                resolve(NextResponse.json({ success: false, error: "Invalid response from bridge" }, { status: 500 }));
            }
        });
    });
}
