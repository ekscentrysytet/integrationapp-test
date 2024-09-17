import { ActionStep, Assert, CompareFunction, ConditionStep, JsonPrimitive, Nullable, Operator, RequestBody, RequestResult, WorkflowStep } from "./types";

import express, { Express, Request, Response } from 'express';
import bodyParser from 'body-parser';
import _ from 'lodash';

const app: Express = express()

app.use(express.json());
app.use(bodyParser());

const isInputDefinition = (key: JsonPrimitive) => key === "$input";
const isParamDefinition = (key: JsonPrimitive) => typeof key === "string" && key.includes("$") && !isInputDefinition(key);

type SomeInput = RequestBody["someInput"];

const getParamValue = _.cond([
  [isInputDefinition, (_: JsonPrimitive) => (input: SomeInput) => input],
  [isParamDefinition, (key: JsonPrimitive) => (input: SomeInput, results: RequestResult) => _.get(results, key?.replace("$", ""))],
  [_.stubTrue, () => _.identity]
]);

const isConditionStep = (step: WorkflowStep): step is ConditionStep => step.type === "condition";
const isActionStep = (step: WorkflowStep): step is ActionStep => step.type !== "condition";

app.post('/', async (req: Request<any, RequestResult, RequestBody>, res: Response) => {
  const { workflow, someInput } = req.body;

  const stepsMap: Record<string, WorkflowStep> = workflow.reduce<Record<string, WorkflowStep>>((acc, step) => {
    acc[step.id] = step;

    return acc
  }, {});

  const results: RequestResult = {}

  let stepId: Nullable<string> = workflow[0].id;

  while(stepId) {
    const step: WorkflowStep = stepsMap[stepId];

    if (!step) {
      stepId = null;
      break
    }

    if (isConditionStep(step)) {
      const { assert }: { assert: Assert } = step; 

      const operatorsMap: Record<Operator, CompareFunction> = {
        "eq": (a, b) => a === b,
        "gt": (a, b) => a > b,
      };

      const result: boolean = Object.keys(assert).every(key => {
        const a: any = getParamValue(key)(someInput, results);
        const b: any = getParamValue(Object.values(assert[key])[0])(someInput, results);

        const operator = Object.keys(assert[key])[0] as Operator;

        return operatorsMap[operator](a, b);
      })

      stepId = result ? step.on_success : step.on_fail;
    } else if (isActionStep(step)) {
      const { request, result_key } = step;
      const { url, method, body, headers } = request

      let requestBody = body;
      const isRequestWithBody = method.toUpperCase() !== "GET" && body;

      if (isRequestWithBody) {
        requestBody = Object.keys(body).reduce<Record<string, any>>((acc, key) => {
          acc[key] = key.includes("$") ? results[key.replace("$", "")] : key;

          return acc;
        }, {})
      }


      const response = await fetch(url, {
        method,
        ...(isRequestWithBody && {
          body: JSON.stringify(requestBody),
        }),
        headers
      });

      const data = await response.json();

      if (result_key) {
        _.set(results, result_key, data);
      }

      stepId = step.next;
    }
  }

  return res.json(results);
})

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
})

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