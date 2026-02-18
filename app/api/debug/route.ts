export const runtime = 'edge';

import { getOptionalRequestContext } from '@cloudflare/next-on-pages';
import { NextResponse } from 'next/server';

export async function GET() {
    const cfContext = getOptionalRequestContext();
    const cfEnv = cfContext?.env as Record<string, string> | undefined;

    // Check which sources have the env vars (show only first 10 chars for security)
    const mask = (val: string | undefined) => val ? val.substring(0, 10) + '...' : '(vazio)';

    const debug = {
        timestamp: new Date().toISOString(),
        runtime: 'edge',

        // Check Cloudflare context
        cloudflare: {
            hasContext: !!cfContext,
            hasEnv: !!cfEnv,
            GOOGLE_CLIENT_EMAIL: mask(cfEnv?.GOOGLE_CLIENT_EMAIL),
            GOOGLE_PRIVATE_KEY: mask(cfEnv?.GOOGLE_PRIVATE_KEY),
            GOOGLE_SPREADSHEET_ID: mask(cfEnv?.GOOGLE_SPREADSHEET_ID),
        },

        // Check process.env
        processEnv: {
            hasProcess: typeof process !== 'undefined',
            hasProcessEnv: typeof process !== 'undefined' && typeof process.env !== 'undefined',
            GOOGLE_CLIENT_EMAIL: mask(process.env?.GOOGLE_CLIENT_EMAIL),
            GOOGLE_PRIVATE_KEY: mask(process.env?.GOOGLE_PRIVATE_KEY),
            GOOGLE_SPREADSHEET_ID: mask(process.env?.GOOGLE_SPREADSHEET_ID),
        },

        // Check Web Crypto (needed for JWT signing)
        crypto: {
            hasCrypto: typeof crypto !== 'undefined',
            hasSubtle: typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined',
        },
    };

    return NextResponse.json(debug);
}
