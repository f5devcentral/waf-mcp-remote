const WAF_STATUS_CODE = Number(process.env.WAF_STATUS_CODE) || null;

let WAF_RESPONSE_PATTERN = process.env.WAF_RESPONSE_PATTERN || '\\bYour support ID is:? ([\\w-]+)\\b';
let WAF_RESPONSE_PATTERN_FLAGS = process.env.WAF_RESPONSE_PATTERN_FLAGS || '';
if(WAF_RESPONSE_PATTERN) {
    WAF_RESPONSE_PATTERN = new RegExp(WAF_RESPONSE_PATTERN, WAF_RESPONSE_PATTERN_FLAGS);
}

function patchArguments() {
    const transportIndex = process.argv.indexOf('--transport');
    if (transportIndex < 0) {
        process.argv.push('--transport', 'http-only');
        return;
    }

    const transportValue = process.argv[transportIndex + 1];
    if (['sse-only', 'sse-first'].includes(transportValue)) {
        throw new Error(
            `Using transport strategy: ${transportValue} is not supported. ` +
            `Please use '--transport http-only' or '--transport http-first'`
        );
    }

    process.argv[transportIndex + 1] = 'http-only';
}

function monkeyPatch() {
    const _fetch = global.fetch;
    global.fetch = async function (input, init = {}) {
        const req = input instanceof Request ? input : new Request(input, init);

        // Only intercept POST requests
        if(req.method?.toUpperCase() !== 'POST') {
            return _fetch(req);
        }

        const _req = req.clone();
        const _reqBody = _req.body ? await _req.text() : undefined;

        const res = await _fetch(req);
        const _res = res.clone();
        const _resBody = _res.body ? await _res.text() : undefined;

        // Check if WAF status code or response pattern matches
        let reqBodyJson = {};
        if (res.status === WAF_STATUS_CODE || WAF_RESPONSE_PATTERN?.test(_resBody)) {
            // Return original response if JSON parsing fails
            try {
                reqBodyJson = _reqBody ? JSON.parse(_reqBody) : {};
            } catch (e) {
                return res;
            }

            // Not a valid JSON-RPC request, return original response
            if(!reqBodyJson.jsonrpc || isNaN(reqBodyJson.id)) {
                return res;
            }

            // Set data for SSE JSON-RPC response
            const data = {
                result: {
                    content: [
                        {
                            type: 'text',
                            text: `Error, WAF Detected: \n${_resBody}`,
                        }
                    ],
                },
                jsonrpc: reqBodyJson.jsonrpc || '2.0',
                id: reqBodyJson.id || 0,
            }
            const body  = new TextEncoder().encode(`event: message\ndata: ${JSON.stringify(data)}\n\n`);

            // Set headers for SSE
            let headers = new Headers(_res.headers);
            headers.set('content-type', 'text/event-stream');

            // Set mcp-session-id if present
            const mcpSessionId = res.headers.get('mcp-session-id');
            if(mcpSessionId) {
                headers.set('mcp-session-id', mcpSessionId);
            }

            return new Response(body, {
                status: 200,
                statusText: 'OK',
                headers: headers,
            });
        }

        return res;
    };
}

async function main() {
    // Check if WAF status codes or patterns are provided
    if (!WAF_STATUS_CODE && !WAF_RESPONSE_PATTERN) {
        throw new Error(
            'No WAF status code or response pattern provided. ' +
            'Please set WAF_STATUS_CODE or WAF_RESPONSE_PATTERN environment variables.'
        );
    }

    patchArguments();
    monkeyPatch();

    return await import("mcp-remote/dist/proxy.js");
}

// Start the MCP remote proxy
(async () => {
    try{
        await main();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
})();