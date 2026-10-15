// Test helpers: a fake fetch that records requests and replays canned responses.

function jsonResponse(status, body, headers = {}) {
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

// Server-sent events body for the Anthropic Messages streaming API.
function anthropicStream({ text = "Hello", stopReason = "end_turn", model = "claude-opus-5-5" } = {}) {
    const events = [
        ["message_start", { type: "message_start", message: { id: "msg_test", type: "message", role: "assistant", model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 12, output_tokens: 1 } } }],
        ["content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }],
        ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } }],
        ["content_block_stop", { type: "content_block_stop", index: 0 }],
        ["message_delta", { type: "message_delta", delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 7 } }],
        ["message_stop", { type: "message_stop" }],
    ];
    const body = events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join("");
    return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

/**
 * @param {Array<Response | ((request) => Response)>} responses - Returned in order
 */
function fakeFetch(responses) {
    const requests = [];
    const queue = [...responses];
    const fn = async (input, init = {}) => {
        const url = typeof input === "string" ? input : input.url;
        const headers = new Headers(init.headers || (typeof input === "object" ? input.headers : undefined));
        const body = init.body ? String(init.body) : undefined;
        const request = { url, method: init.method || "GET", headers, body, json: body ? JSON.parse(body) : undefined };
        requests.push(request);
        const next = queue.shift();
        if (!next) throw new Error(`Unexpected request: ${request.method} ${url}`);
        return typeof next === "function" ? next(request) : next;
    };
    fn.requests = requests;
    return fn;
}

module.exports = { jsonResponse, anthropicStream, fakeFetch };
