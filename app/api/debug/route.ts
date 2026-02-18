export const runtime = 'edge';

import { getOptionalRequestContext } from '@cloudflare/next-on-pages';
import { NextResponse } from 'next/server';

export async function GET() {
    const results: Record<string, any> = {
        timestamp: new Date().toISOString(),
        steps: {},
    };

    try {
        // Step 1: Get env vars
        const cfEnv = getOptionalRequestContext()?.env as Record<string, string> | undefined;
        const clientEmail = cfEnv?.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL || '';
        const privateKey = (cfEnv?.GOOGLE_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
        const spreadsheetId = cfEnv?.GOOGLE_SPREADSHEET_ID || process.env.GOOGLE_SPREADSHEET_ID || '';

        results.steps.envVars = {
            ok: true,
            clientEmail: clientEmail.substring(0, 15) + '...',
            privateKeyLength: privateKey.length,
            privateKeyStart: privateKey.substring(0, 30),
            privateKeyHasNewlines: privateKey.includes('\n'),
            privateKeyNewlineCount: (privateKey.match(/\n/g) || []).length,
            spreadsheetId: spreadsheetId.substring(0, 10) + '...',
        };

        // Step 2: Import private key
        try {
            const pemContents = privateKey
                .replace(/-----BEGIN .*-----/g, '')
                .replace(/-----END .*-----/g, '')
                .replace(/\s/g, '');

            results.steps.pemParse = {
                ok: true,
                base64Length: pemContents.length,
                base64Start: pemContents.substring(0, 20) + '...',
            };

            const binaryString = atob(pemContents);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            const cryptoKey = await crypto.subtle.importKey(
                'pkcs8',
                bytes.buffer,
                { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
                false,
                ['sign']
            );
            results.steps.importKey = { ok: true, keyType: cryptoKey.type };
        } catch (e: any) {
            results.steps.importKey = { ok: false, error: e.message || String(e) };
            return NextResponse.json(results);
        }

        // Step 3: Create JWT
        try {
            const base64urlEncode = (data: Uint8Array) => {
                let binary = '';
                for (let i = 0; i < data.length; i++) binary += String.fromCharCode(data[i]);
                return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            };
            const b64str = (str: string) => base64urlEncode(new TextEncoder().encode(str));

            const now = Math.floor(Date.now() / 1000);
            const header = b64str(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
            const payload = b64str(JSON.stringify({
                iss: clientEmail,
                scope: 'https://www.googleapis.com/auth/spreadsheets',
                aud: 'https://oauth2.googleapis.com/token',
                iat: now,
                exp: now + 3600,
            }));

            const signingInput = `${header}.${payload}`;

            const pemContents = privateKey
                .replace(/-----BEGIN .*-----/g, '')
                .replace(/-----END .*-----/g, '')
                .replace(/\s/g, '');
            const binaryString = atob(pemContents);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

            const key = await crypto.subtle.importKey(
                'pkcs8', bytes.buffer,
                { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
            );

            const signature = await crypto.subtle.sign(
                'RSASSA-PKCS1-v1_5', key,
                new TextEncoder().encode(signingInput)
            );
            const jwt = `${signingInput}.${base64urlEncode(new Uint8Array(signature))}`;

            results.steps.createJwt = { ok: true, jwtLength: jwt.length };

            // Step 4: Exchange JWT for access token
            try {
                const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                        assertion: jwt,
                    }),
                });

                const tokenBody = await tokenRes.text();
                if (tokenRes.ok) {
                    const tokenData = JSON.parse(tokenBody);
                    results.steps.getToken = {
                        ok: true,
                        tokenType: tokenData.token_type,
                        expiresIn: tokenData.expires_in,
                        accessTokenStart: tokenData.access_token?.substring(0, 15) + '...',
                    };

                    // Step 5: Test Google Sheets API call
                    try {
                        const sheetsRes = await fetch(
                            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
                            { headers: { 'Authorization': `Bearer ${tokenData.access_token}` } }
                        );
                        const sheetsBody = await sheetsRes.text();
                        if (sheetsRes.ok) {
                            results.steps.sheetsApi = { ok: true, response: JSON.parse(sheetsBody) };
                        } else {
                            results.steps.sheetsApi = { ok: false, status: sheetsRes.status, body: sheetsBody.substring(0, 300) };
                        }
                    } catch (e: any) {
                        results.steps.sheetsApi = { ok: false, error: e.message || String(e) };
                    }
                } else {
                    results.steps.getToken = {
                        ok: false,
                        status: tokenRes.status,
                        body: tokenBody.substring(0, 500),
                    };
                }
            } catch (e: any) {
                results.steps.getToken = { ok: false, error: e.message || String(e) };
            }
        } catch (e: any) {
            results.steps.createJwt = { ok: false, error: e.message || String(e) };
        }
    } catch (e: any) {
        results.error = e.message || String(e);
    }

    return NextResponse.json(results);
}
