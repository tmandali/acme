import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    // Filter for requests to /sql-query/*
    if (request.nextUrl.pathname.startsWith('/sql-query/')) {
        // If it's a POST request, rewrite to the API route
        if (request.method === 'POST') {
            const newUrl = request.nextUrl.clone()
            // Prepend /api to the pathname. /sql-query/test2 -> /api/sql-query/test2
            newUrl.pathname = `/api${request.nextUrl.pathname}`
            return NextResponse.rewrite(newUrl)
        }
    }

    return NextResponse.next()
}

export const config = {
    matcher: '/sql-query/:path*',
}
