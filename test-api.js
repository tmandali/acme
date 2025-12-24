
async function test() {
    try {
        const response = await fetch("http://localhost:3000/api/temporal/execute", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ query: "SELECT * FROM ACCOUNTS" }),
        });
        console.log("Status:", response.status);
        const data = await response.json();
        console.log("Data:", data);
    } catch (error) {
        console.error("Error:", error);
    }
}

test();
