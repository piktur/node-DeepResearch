"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var supertest_1 = require("supertest");
var events_1 = require("events");
var TEST_SECRET = "test-secret";
var app;
describe("/v1/chat/completions", function () {
    jest.setTimeout(120000); // Increase timeout for all tests in this suite
    beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
        var existingSecretIndex, serverModule;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // Set up test environment
                    process.env.NODE_ENV = "test";
                    process.env.LLM_PROVIDER = "openai"; // Use OpenAI provider for tests
                    process.env.OPENAI_API_KEY = "test-key";
                    process.env.JINA_API_KEY = "test-key";
                    existingSecretIndex = process.argv.findIndex(function (arg) {
                        return arg.startsWith("--secret=");
                    });
                    if (existingSecretIndex !== -1) {
                        process.argv.splice(existingSecretIndex, 1);
                    }
                    // Set up test secret and import server module
                    process.argv.push("--secret=".concat(TEST_SECRET));
                    return [4 /*yield*/, require("../app")];
                case 1:
                    serverModule = (_a.sent()).default;
                    app = serverModule;
                    return [2 /*return*/];
            }
        });
    }); });
    afterEach(function () { return __awaiter(void 0, void 0, void 0, function () {
        var emitter, secretIndex;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // Clean up environment variables
                    delete process.env.OPENAI_API_KEY;
                    delete process.env.JINA_API_KEY;
                    emitter = events_1.EventEmitter.prototype;
                    emitter.removeAllListeners();
                    emitter.setMaxListeners(emitter.getMaxListeners() + 1);
                    secretIndex = process.argv.findIndex(function (arg) {
                        return arg.startsWith("--secret=");
                    });
                    if (secretIndex !== -1) {
                        process.argv.splice(secretIndex, 1);
                    }
                    // Wait for any pending promises to settle
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 500); })];
                case 1:
                    // Wait for any pending promises to settle
                    _a.sent();
                    // Reset module cache to ensure clean state
                    jest.resetModules();
                    return [2 /*return*/];
            }
        });
    }); });
    it("should require authentication when secret is set", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(app)
                        .post("/v1/chat/completions")
                        .send({
                        model: "test-model",
                        messages: [{ role: "user", content: "test" }],
                    })];
                case 1:
                    response = _a.sent();
                    expect(response.status).toBe(401);
                    return [2 /*return*/];
            }
        });
    }); });
    it("should allow requests without auth when no secret is set", function () { return __awaiter(void 0, void 0, void 0, function () {
        var secretIndex, serverModule, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    secretIndex = process.argv.findIndex(function (arg) {
                        return arg.startsWith("--secret=");
                    });
                    if (secretIndex !== -1) {
                        process.argv.splice(secretIndex, 1);
                    }
                    // Reset module cache to ensure clean state
                    jest.resetModules();
                    return [4 /*yield*/, require("../app")];
                case 1:
                    serverModule = (_a.sent()).default;
                    app = serverModule;
                    return [4 /*yield*/, (0, supertest_1.default)(app)
                            .post("/v1/chat/completions")
                            .send({
                            model: "test-model",
                            messages: [{ role: "user", content: "test" }],
                        })];
                case 2:
                    response = _a.sent();
                    expect(response.status).toBe(200);
                    return [2 /*return*/];
            }
        });
    }); });
    it("should reject requests without user message", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(app)
                        .post("/v1/chat/completions")
                        .set("Authorization", "Bearer ".concat(TEST_SECRET))
                        .send({
                        model: "test-model",
                        messages: [{ role: "developer", content: "test" }],
                    })];
                case 1:
                    response = _a.sent();
                    expect(response.status).toBe(400);
                    expect(response.body.error).toBe("Last message must be from user");
                    return [2 /*return*/];
            }
        });
    }); });
    it("should handle non-streaming request", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(app)
                        .post("/v1/chat/completions")
                        .set("Authorization", "Bearer ".concat(TEST_SECRET))
                        .send({
                        model: "test-model",
                        messages: [{ role: "user", content: "test" }],
                    })];
                case 1:
                    response = _a.sent();
                    expect(response.status).toBe(200);
                    expect(response.body).toMatchObject({
                        object: "chat.completion",
                        choices: [
                            {
                                message: {
                                    role: "assistant",
                                },
                            },
                        ],
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    it("should handle streaming request and track tokens correctly", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, new Promise(function (resolve, reject) {
                    var isDone = false;
                    var totalCompletionTokens = 0;
                    var cleanup = function () {
                        clearTimeout(timeoutHandle);
                        isDone = true;
                        resolve();
                    };
                    var timeoutHandle = setTimeout(function () {
                        if (!isDone) {
                            cleanup();
                            reject(new Error("Test timed out"));
                        }
                    }, 30000);
                    (0, supertest_1.default)(app)
                        .post("/v1/chat/completions")
                        .set("Authorization", "Bearer ".concat(TEST_SECRET))
                        .send({
                        model: "test-model",
                        messages: [{ role: "user", content: "test" }],
                        stream: true,
                    })
                        .buffer(true)
                        .parse(function (res, callback) {
                        var response = res;
                        var responseData = "";
                        response.on("error", function (err) {
                            cleanup();
                            callback(err, null);
                        });
                        response.on("data", function (chunk) {
                            responseData += chunk.toString();
                        });
                        response.on("end", function () {
                            try {
                                callback(null, responseData);
                            }
                            catch (err) {
                                cleanup();
                                callback(err instanceof Error ? err : new Error(String(err)), null);
                            }
                        });
                    })
                        .end(function (err, res) {
                        var _a, _b;
                        if (err)
                            return reject(err);
                        expect(res.status).toBe(200);
                        expect(res.headers["content-type"]).toBe("text/event-stream");
                        // Verify stream format and content
                        if (isDone)
                            return; // Prevent multiple resolves
                        var responseText = res.body;
                        var chunks = responseText
                            .split("\n\n")
                            .filter(function (line) { return line.startsWith("data: "); })
                            .map(function (line) { return JSON.parse(line.replace("data: ", "")); });
                        // Process all chunks
                        expect(chunks.length).toBeGreaterThan(0);
                        // Verify initial chunk format
                        expect(chunks[0]).toMatchObject({
                            id: expect.any(String),
                            object: "chat.completion.chunk",
                            choices: [
                                {
                                    index: 0,
                                    delta: { role: "assistant" },
                                    logprobs: null,
                                    finish_reason: null,
                                },
                            ],
                        });
                        // Verify content chunks have content
                        chunks.slice(1).forEach(function (chunk) {
                            var content = chunk.choices[0].delta.content;
                            if (content && content.trim()) {
                                totalCompletionTokens += 1; // Count 1 token per chunk as per Vercel convention
                            }
                            expect(chunk).toMatchObject({
                                object: "chat.completion.chunk",
                                choices: [
                                    {
                                        delta: expect.objectContaining({
                                            content: expect.any(String),
                                        }),
                                    },
                                ],
                            });
                        });
                        // Verify final chunk format if present
                        var lastChunk = chunks[chunks.length - 1];
                        if (((_b = (_a = lastChunk === null || lastChunk === void 0 ? void 0 : lastChunk.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.finish_reason) === "stop") {
                            expect(lastChunk).toMatchObject({
                                object: "chat.completion.chunk",
                                choices: [
                                    {
                                        delta: {},
                                        finish_reason: "stop",
                                    },
                                ],
                            });
                        }
                        // Verify we tracked some completion tokens
                        expect(totalCompletionTokens).toBeGreaterThan(0);
                        // Clean up and resolve
                        if (!isDone) {
                            cleanup();
                        }
                    });
                })];
        });
    }); });
    it("should track tokens correctly in error response", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response, validResponse;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(app)
                        .post("/v1/chat/completions")
                        .set("Authorization", "Bearer ".concat(TEST_SECRET))
                        .send({
                        model: "test-model",
                        messages: [], // Invalid messages array
                    })];
                case 1:
                    response = _a.sent();
                    expect(response.status).toBe(400);
                    expect(response.body).toHaveProperty("error");
                    expect(response.body.error).toBe("Messages array is required and must not be empty");
                    return [4 /*yield*/, (0, supertest_1.default)(app)
                            .post("/v1/chat/completions")
                            .set("Authorization", "Bearer ".concat(TEST_SECRET))
                            .send({
                            model: "test-model",
                            messages: [{ role: "user", content: "test" }],
                        })];
                case 2:
                    validResponse = _a.sent();
                    // Verify token tracking still works after error
                    expect(validResponse.body.usage).toMatchObject({
                        prompt_tokens: expect.any(Number),
                        completion_tokens: expect.any(Number),
                        total_tokens: expect.any(Number),
                    });
                    // Basic token tracking structure should be present
                    expect(validResponse.body.usage.total_tokens).toBe(validResponse.body.usage.prompt_tokens +
                        validResponse.body.usage.completion_tokens);
                    return [2 /*return*/];
            }
        });
    }); });
    it("should provide token usage in Vercel AI SDK format", function () { return __awaiter(void 0, void 0, void 0, function () {
        var response, usage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, supertest_1.default)(app)
                        .post("/v1/chat/completions")
                        .set("Authorization", "Bearer ".concat(TEST_SECRET))
                        .send({
                        model: "test-model",
                        messages: [{ role: "user", content: "test" }],
                    })];
                case 1:
                    response = _a.sent();
                    expect(response.status).toBe(200);
                    usage = response.body.usage;
                    expect(usage).toMatchObject({
                        prompt_tokens: expect.any(Number),
                        completion_tokens: expect.any(Number),
                        total_tokens: expect.any(Number),
                    });
                    // Basic token tracking structure should be present
                    expect(usage.total_tokens).toBe(usage.prompt_tokens + usage.completion_tokens);
                    return [2 /*return*/];
            }
        });
    }); });
});
