// lib/googleSheets.ts - Edge Runtime compatible (fetch + Web Crypto API)
// Uses @cloudflare/next-on-pages for env vars on Cloudflare, process.env fallback for local dev

import { getOptionalRequestContext } from '@cloudflare/next-on-pages';

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

// Lazy config - reads env vars at request time (not module load time)
function getConfig() {
    const cfEnv = getOptionalRequestContext()?.env as Record<string, string> | undefined;
    return {
        clientEmail: cfEnv?.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL || '',
        privateKey: (cfEnv?.GOOGLE_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        spreadsheetId: cfEnv?.GOOGLE_SPREADSHEET_ID || process.env.GOOGLE_SPREADSHEET_ID || '1FnOYddjOYdqx8kZgxvtWn2sLAejJYOWto1XMXa3n7ag',
    };
}

// Token cache (invalidates when email changes)
let cachedToken: string | null = null;
let tokenExpiry = 0;
let cachedEmail = '';

// Base64url encode bytes
function base64urlEncode(data: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < data.length; i++) {
        binary += String.fromCharCode(data[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Base64url encode string
function base64urlEncodeString(str: string): string {
    return base64urlEncode(new TextEncoder().encode(str));
}

// Import PEM private key for Web Crypto (PKCS#8)
async function importPrivateKey(pem: string): Promise<CryptoKey> {
    const pemContents = pem
        .replace(/-----BEGIN .*-----/g, '')
        .replace(/-----END .*-----/g, '')
        .replace(/\s/g, '');

    const binaryString = atob(pemContents);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    return crypto.subtle.importKey(
        'pkcs8',
        bytes.buffer,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign']
    );
}

// Create a signed JWT for Google service account
async function createSignedJwt(clientEmail: string, privateKey: string): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    const header = base64urlEncodeString(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = base64urlEncodeString(JSON.stringify({
        iss: clientEmail,
        scope: SCOPES,
        aud: TOKEN_URL,
        iat: now,
        exp: now + 3600,
    }));

    const signingInput = `${header}.${payload}`;
    const key = await importPrivateKey(privateKey);

    const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        key,
        new TextEncoder().encode(signingInput)
    );

    return `${signingInput}.${base64urlEncode(new Uint8Array(signature))}`;
}

// Get access token with caching
async function getAccessToken(): Promise<string> {
    const config = getConfig();
    const now = Date.now();

    // Invalidate cache if email changed or token expired
    if (cachedToken && cachedEmail === config.clientEmail && tokenExpiry > now + 60000) {
        return cachedToken;
    }

    const jwt = await createSignedJwt(config.clientEmail, config.privateKey);

    const response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get access token: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    cachedToken = data.access_token;
    tokenExpiry = now + (data.expires_in * 1000);
    cachedEmail = config.clientEmail;

    return cachedToken!;
}

// Authenticated fetch to Google Sheets API
async function sheetsApiFetch(path: string, options: RequestInit = {}): Promise<any> {
    const { spreadsheetId } = getConfig();
    const token = await getAccessToken();

    const response = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}${path}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Google Sheets API error: ${response.status} ${errorText}`);
    }

    return response.json();
}

// ============================================
// Public API (same interface as before)
// ============================================

export async function getSheetData(range: string): Promise<any[][]> {
    try {
        const encodedRange = encodeURIComponent(range);
        const data = await sheetsApiFetch(`/values/${encodedRange}`);
        return data.values || [];
    } catch (error) {
        console.error('Error fetching sheet data:', error);
        throw error;
    }
}

export async function appendRow(range: string, values: any[]) {
    try {
        const encodedRange = encodeURIComponent(range);
        const data = await sheetsApiFetch(
            `/values/${encodedRange}:append?valueInputOption=USER_ENTERED`,
            {
                method: 'POST',
                body: JSON.stringify({ values: [values] }),
            }
        );
        return data;
    } catch (error) {
        console.error('Error appending row:', error);
        throw error;
    }
}

export async function getLastRow(sheetName: string): Promise<number> {
    try {
        const range = `${sheetName}!A:A`;
        const encodedRange = encodeURIComponent(range);
        const data = await sheetsApiFetch(`/values/${encodedRange}`);
        return data.values ? data.values.length : 0;
    } catch (error) {
        console.error('Error getting last row:', error);
        return 0;
    }
}

export async function updateRow(range: string, values: any[]) {
    try {
        console.log('[updateRow] Range:', range);
        console.log('[updateRow] Values:', values);

        const encodedRange = encodeURIComponent(range);
        const data = await sheetsApiFetch(
            `/values/${encodedRange}?valueInputOption=USER_ENTERED`,
            {
                method: 'PUT',
                body: JSON.stringify({ values: [values] }),
            }
        );

        console.log('[updateRow] Response:', data);
        return data;
    } catch (error) {
        console.error('[updateRow] Error:', error);
        throw error;
    }
}

export async function deleteRow(range: string) {
    try {
        const encodedRange = encodeURIComponent(range);
        const data = await sheetsApiFetch(
            `/values/${encodedRange}:clear`,
            {
                method: 'POST',
                body: JSON.stringify({}),
            }
        );
        return data;
    } catch (error) {
        console.error('Error deleting row:', error);
        throw error;
    }
}

export async function getSheetId(sheetName: string): Promise<number> {
    try {
        const data = await sheetsApiFetch('');

        const sheet = data.sheets?.find(
            (s: any) => s.properties?.title === sheetName
        );

        if (!sheet?.properties?.sheetId && sheet?.properties?.sheetId !== 0) {
            throw new Error(`Sheet "${sheetName}" not found`);
        }

        return sheet.properties.sheetId;
    } catch (error) {
        console.error('Error getting sheet ID:', error);
        throw error;
    }
}

export async function deleteMultipleRows(sheetName: string, rowNumbers: number[]) {
    try {
        if (rowNumbers.length === 0) {
            return { deletedRows: 0 };
        }

        const { spreadsheetId } = getConfig();
        const sheetId = await getSheetId(sheetName);

        // Sort descending to avoid index shifting
        const sortedRows = [...rowNumbers].sort((a, b) => b - a);

        const requests = sortedRows.map(rowNumber => ({
            deleteDimension: {
                range: {
                    sheetId: sheetId,
                    dimension: 'ROWS',
                    startIndex: rowNumber - 1,
                    endIndex: rowNumber,
                },
            },
        }));

        console.log(`[deleteMultipleRows] Deleting ${rowNumbers.length} rows: ${sortedRows.join(', ')}`);

        const token = await getAccessToken();
        const response = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ requests }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Batch update error: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        console.log(`[deleteMultipleRows] Deleted ${rowNumbers.length} rows successfully`);
        return { deletedRows: rowNumbers.length, response: data };
    } catch (error) {
        console.error('Error deleting multiple rows:', error);
        throw error;
    }
}

export async function appendMultipleRows(sheetName: string, rows: any[][]) {
    try {
        if (rows.length === 0) {
            return { updatedRows: 0 };
        }

        const lastRow = await getLastRow(sheetName);
        const startRow = lastRow + 1;
        const endRow = startRow + rows.length - 1;

        const exactRange = `'${sheetName}'!A${startRow}:O${endRow}`;

        console.log(`[appendMultipleRows] Writing ${rows.length} rows to range: ${exactRange}`);

        const encodedRange = encodeURIComponent(exactRange);
        const data = await sheetsApiFetch(
            `/values/${encodedRange}?valueInputOption=USER_ENTERED`,
            {
                method: 'PUT',
                body: JSON.stringify({ values: rows }),
            }
        );

        console.log(`[appendMultipleRows] Result: ${JSON.stringify(data.updatedRange)}`);
        return data;
    } catch (error) {
        console.error('Error appending multiple rows:', error);
        throw error;
    }
}

export async function batchUpdateCells(updates: { range: string; values: any[][] }[]) {
    try {
        if (updates.length === 0) {
            return { updatedCells: 0 };
        }

        const { spreadsheetId } = getConfig();
        const requestData = updates.map(u => ({
            range: u.range,
            values: u.values,
        }));

        const token = await getAccessToken();
        const response = await fetch(
            `${SHEETS_API_BASE}/${spreadsheetId}/values:batchUpdate`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    valueInputOption: 'USER_ENTERED',
                    data: requestData,
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Batch update error: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        console.log(`[batchUpdateCells] Updated ${data.totalUpdatedCells} cells`);
        return data;
    } catch (error) {
        console.error('Error batch updating cells:', error);
        throw error;
    }
}
