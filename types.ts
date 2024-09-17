interface WorkflowStepBase {
  id: string;
  type: string;
}

export type Operator = "eq" | "gt";

export type JsonPrimitive = string | number | boolean | null;
export type Assert = Record<string, Record<Operator, JsonPrimitive>>;

export interface ConditionStep extends WorkflowStepBase {
  assert: Assert;
  on_success: string;
  on_fail: string;
}

export interface ActionStep extends WorkflowStepBase {
  request: {
    url: string;
    method: string;
    body?: Record<string, any>;
    headers?: Record<string, any>;
  };
  result_key?: string;
  next: string;
}

export type WorkflowStep = ConditionStep | ActionStep;


export interface RequestBody {
  workflow: WorkflowStep[];
  someInput: number;
}

export type RequestResult = Record<string, any>;

export type Nullable<T> = T | null;

export type CompareFunction<T = any, K = any> = (a: T, b: K) => boolean;