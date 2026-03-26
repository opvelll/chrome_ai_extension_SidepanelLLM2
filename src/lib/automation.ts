import type { FunctionTool } from 'openai/resources/responses/responses';
import { z } from 'zod';

export const AUTOMATION_MAX_STEPS = 12;

const inspectPageArgsSchema = z.object({
  maxElements: z.number().int().min(1).max(60).nullish(),
});

const clickArgsSchema = z.object({
  selector: z.string().min(1),
});

const typeArgsSchema = z.object({
  selector: z.string().min(1),
  text: z.string(),
  clear: z.boolean().nullish(),
  submit: z.boolean().nullish(),
});

const scrollArgsSchema = z.object({
  direction: z.enum(['up', 'down']),
  amount: z.number().int().min(80).max(3000).nullish(),
});

const pressKeyArgsSchema = z.object({
  key: z.string().min(1),
});

const captureScreenshotArgsSchema = z.object({});

const waitArgsSchema = z.object({
  timeoutMs: z.number().int().min(100).max(10000).nullish(),
  selector: z.string().min(1).nullish(),
  text: z.string().min(1).nullish(),
});

export type AutomationToolCall =
  | {
      name: 'browser_inspect_page';
      args: z.infer<typeof inspectPageArgsSchema>;
    }
  | {
      name: 'browser_click';
      args: z.infer<typeof clickArgsSchema>;
    }
  | {
      name: 'browser_type';
      args: z.infer<typeof typeArgsSchema>;
    }
  | {
      name: 'browser_scroll';
      args: z.infer<typeof scrollArgsSchema>;
    }
  | {
      name: 'browser_press_key';
      args: z.infer<typeof pressKeyArgsSchema>;
    }
  | {
      name: 'browser_capture_screenshot';
      args: z.infer<typeof captureScreenshotArgsSchema>;
    }
  | {
      name: 'browser_wait';
      args: z.infer<typeof waitArgsSchema>;
    };

export type AutomationExecutionResult = {
  ok: boolean;
  result?: unknown;
  error?: string;
};

const automationToolSchemas = {
  browser_inspect_page: inspectPageArgsSchema,
  browser_click: clickArgsSchema,
  browser_type: typeArgsSchema,
  browser_scroll: scrollArgsSchema,
  browser_press_key: pressKeyArgsSchema,
  browser_capture_screenshot: captureScreenshotArgsSchema,
  browser_wait: waitArgsSchema,
} as const;

export function getAutomationTools(): FunctionTool[] {
  return [
    {
      type: 'function',
      name: 'browser_inspect_page',
      description:
        'Inspect the current tab and return the main visible interactive elements with labels, selectors, and page metadata.',
      parameters: {
        type: 'object',
        properties: {
          maxElements: {
            type: ['integer', 'null'],
            minimum: 1,
            maximum: 60,
            description: 'Maximum number of visible interactive elements to include.',
          },
        },
        required: ['maxElements'],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      type: 'function',
      name: 'browser_click',
      description: 'Click a visible element in the current tab by CSS selector.',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector returned by browser_inspect_page.',
          },
        },
        required: ['selector'],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      type: 'function',
      name: 'browser_type',
      description: 'Type text into an input, textarea, or contenteditable element identified by CSS selector.',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector returned by browser_inspect_page.',
          },
          text: {
            type: 'string',
            description: 'Text to enter.',
          },
          clear: {
            type: ['boolean', 'null'],
            description: 'Clear any existing value before typing. Defaults to true.',
          },
          submit: {
            type: ['boolean', 'null'],
            description: 'Submit the enclosing form or press Enter after typing when possible.',
          },
        },
        required: ['selector', 'text', 'clear', 'submit'],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      type: 'function',
      name: 'browser_scroll',
      description: 'Scroll the current page vertically.',
      parameters: {
        type: 'object',
        properties: {
          direction: {
            type: 'string',
            enum: ['up', 'down'],
          },
          amount: {
            type: ['integer', 'null'],
            minimum: 80,
            maximum: 3000,
            description: 'Scroll distance in CSS pixels. Defaults to 600.',
          },
        },
        required: ['direction', 'amount'],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      type: 'function',
      name: 'browser_press_key',
      description: 'Press a single key on the currently focused element. Useful for Enter, Tab, Escape, and Arrow keys.',
      parameters: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description: 'KeyboardEvent key value such as Enter, Tab, Escape, ArrowDown.',
          },
        },
        required: ['key'],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      type: 'function',
      name: 'browser_capture_screenshot',
      description: 'Capture a screenshot of the current visible viewport and return it for visual inspection.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      type: 'function',
      name: 'browser_wait',
      description: 'Wait for the page to settle, optionally until a selector or text appears.',
      parameters: {
        type: 'object',
        properties: {
          timeoutMs: {
            type: ['integer', 'null'],
            minimum: 100,
            maximum: 10000,
            description: 'How long to wait before giving up. Defaults to 1500.',
          },
          selector: {
            type: ['string', 'null'],
            description: 'Optional CSS selector to wait for.',
          },
          text: {
            type: ['string', 'null'],
            description: 'Optional visible text to wait for.',
          },
        },
        required: ['timeoutMs', 'selector', 'text'],
        additionalProperties: false,
      },
      strict: true,
    },
  ];
}

export function parseAutomationToolCall(name: string, rawArguments: string): AutomationToolCall {
  const toolName = name as keyof typeof automationToolSchemas;
  const schema = automationToolSchemas[toolName];

  if (!schema) {
    throw new Error(`Unsupported automation tool: ${name}`);
  }

  const parsedArguments = rawArguments.trim() ? JSON.parse(rawArguments) : {};
  return {
    name: toolName,
    args: schema.parse(parsedArguments),
  } as AutomationToolCall;
}

export function formatAutomationResult(result: AutomationExecutionResult): string {
  return JSON.stringify(result);
}
