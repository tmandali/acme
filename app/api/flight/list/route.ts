import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";

export async function GET(request: NextRequest) {
    const pythonPath = path.join(process.cwd(), ".venv/bin/python");
    const scriptPath = path.join(process.cwd(), "flight_query_server/bridge.py");

    return new Promise((resolve) => {
        exec(`${pythonPath} ${scriptPath} list`, (error, stdout, stderr) => {
            if (error) {
                console.error("Bridge Error:", stderr);
                resolve(NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 }));
                return;
            }
            try {
                const data = JSON.parse(stdout);
                resolve(NextResponse.json(data));
            } catch (e) {
                console.error("JSON Parse Error:", stdout);
                resolve(NextResponse.json({ error: "Invalid response from bridge" }, { status: 500 }));
            }
        });
    });
}
