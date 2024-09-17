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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const lodash_1 = __importDefault(require("lodash"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, body_parser_1.default)());
const isInputDefinition = (key) => key === "$input";
const isParamDefinition = (key) => typeof key === "string" && key.includes("$") && !isInputDefinition(key);
const getParamValue = lodash_1.default.cond([
    [isInputDefinition, (_) => (input) => input],
    [isParamDefinition, (key) => (input, results) => lodash_1.default.get(results, key === null || key === void 0 ? void 0 : key.replace("$", ""))],
    [lodash_1.default.stubTrue, () => lodash_1.default.identity]
]);
const isConditionStep = (step) => step.type === "condition";
const isActionStep = (step) => step.type !== "condition";
app.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { workflow, someInput } = req.body;
    const stepsMap = workflow.reduce((acc, step) => {
        acc[step.id] = step;
        return acc;
    }, {});
    const results = {};
    let stepId = workflow[0].id;
    while (stepId) {
        const step = stepsMap[stepId];
        if (!step) {
            stepId = null;
            break;
        }
        if (isConditionStep(step)) {
            const { assert } = step;
            const operatorsMap = {
                "eq": (a, b) => a === b,
                "gt": (a, b) => a > b,
            };
            const result = Object.keys(assert).every(key => {
                const a = getParamValue(key)(someInput, results);
                const b = getParamValue(Object.values(assert[key])[0])(someInput, results);
                const operator = Object.keys(assert[key])[0];
                return operatorsMap[operator](a, b);
            });
            stepId = result ? step.on_success : step.on_fail;
        }
        else if (isActionStep(step)) {
            const { request, result_key } = step;
            const { url, method, body, headers } = request;
            let requestBody = body;
            const isRequestWithBody = method.toUpperCase() !== "GET" && body;
            if (isRequestWithBody) {
                requestBody = Object.keys(body).reduce((acc, key) => {
                    acc[key] = key.includes("$") ? results[key.replace("$", "")] : key;
                    return acc;
                }, {});
            }
            const response = yield fetch(url, Object.assign(Object.assign({ method }, (isRequestWithBody && {
                body: JSON.stringify(requestBody),
            })), { headers }));
            const data = yield response.json();
            if (result_key) {
                lodash_1.default.set(results, result_key, data);
            }
            stepId = step.next;
        }
    }
    return res.json(results);
}));
/*
{
    "workflow": [
        {
            "id": "step1",
            "type": "condition",
            "assert": {
                "$input": {
                    "eq": 20
                }
            },
            "on_success": "step2",
            "on_fail": "step3"
        },
        {
            "id": "step2",
            "request": {
                "url": "https://jsonplaceholder.typicode.com/todos/1",
                "method": "GET",
                "headers": {
                    "Content-Type": "application/json"
                }
            },
            "result_key": "resultKey",
            "next": null
        }
    ],
    "someInput": 20
}
*/ 
