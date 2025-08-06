import { z } from 'zod';
import type {
  Artifact,
  ChartArtifact,
  CodeArtifact,
  DataArtifact,
  DocumentArtifact,
  ImageArtifact,
  SpreadsheetArtifact,
} from '@/types/artifacts';

// Tool schemas
export const createCodeArtifactSchema = z.object({
  title: z.string().describe('Title of the code artifact'),
  language: z
    .string()
    .describe('Programming language (e.g., javascript, python, sql)'),
  content: z.string().describe('The code content'),
  runnable: z.boolean().optional().describe('Whether the code can be executed'),
  dependencies: z
    .array(z.string())
    .optional()
    .describe('Required dependencies'),
});

export const createDocumentArtifactSchema = z.object({
  title: z.string().describe('Title of the document'),
  format: z.enum(['markdown', 'html', 'plain']).describe('Document format'),
  content: z.string().describe('The document content'),
});

export const createSpreadsheetArtifactSchema = z.object({
  title: z.string().describe('Title of the spreadsheet'),
  columns: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        type: z.enum(['string', 'number', 'date', 'boolean']),
        width: z.number().optional(),
      })
    )
    .describe('Column definitions'),
  data: z.array(z.record(z.string(), z.any())).describe('Row data'),
});

export const createChartArtifactSchema = z.object({
  title: z.string().describe('Title of the chart'),
  chartType: z
    .enum(['line', 'bar', 'pie', 'scatter', 'area'])
    .describe('Type of chart'),
  data: z.any().describe('Chart.js data configuration'),
  options: z.any().optional().describe('Chart.js options configuration'),
});

export const createImageArtifactSchema = z.object({
  title: z.string().describe('Title of the image'),
  format: z.enum(['png', 'jpg', 'svg', 'gif']).describe('Image format'),
  width: z.number().describe('Image width in pixels'),
  height: z.number().describe('Image height in pixels'),
  content: z.string().optional().describe('SVG content or base64 data'),
  url: z.string().optional().describe('Image URL'),
});

export const createDataArtifactSchema = z.object({
  title: z.string().describe('Title of the data'),
  type: z.enum(['json', 'csv']).describe('Data format'),
  content: z.string().describe('The data content'),
  schema: z.any().optional().describe('Data schema if applicable'),
});

// Helper function to generate artifact ID
function generateArtifactId(): string {
  return `artifact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Tool implementations
export const artifactTools = {
  createCodeArtifact: {
    description:
      'Create a code artifact that can be displayed, edited, and optionally executed',
    inputSchema: createCodeArtifactSchema,
    execute: async (
      input: z.infer<typeof createCodeArtifactSchema>
    ): Promise<CodeArtifact> => {
      const artifact: CodeArtifact = {
        id: generateArtifactId(),
        type: 'code',
        title: input.title,
        content: input.content,
        language: input.language,
        runnable: input.runnable ?? false,
        dependencies: input.dependencies,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      return artifact;
    },
  },

  createDocumentArtifact: {
    description: 'Create a document artifact (markdown, HTML, or plain text)',
    inputSchema: createDocumentArtifactSchema,
    execute: async (
      input: z.infer<typeof createDocumentArtifactSchema>
    ): Promise<DocumentArtifact> => {
      const artifact: DocumentArtifact = {
        id: generateArtifactId(),
        type: 'document',
        title: input.title,
        content: input.content,
        format: input.format,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      return artifact;
    },
  },

  createSpreadsheetArtifact: {
    description: 'Create a spreadsheet artifact with sortable, filterable data',
    inputSchema: createSpreadsheetArtifactSchema,
    execute: async (
      input: z.infer<typeof createSpreadsheetArtifactSchema>
    ): Promise<SpreadsheetArtifact> => {
      const artifact: SpreadsheetArtifact = {
        id: generateArtifactId(),
        type: 'spreadsheet',
        title: input.title,
        content: JSON.stringify(input.data, null, 2),
        columns: input.columns,
        data: input.data,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      return artifact;
    },
  },

  createChartArtifact: {
    description: 'Create a chart artifact using Chart.js configuration',
    inputSchema: createChartArtifactSchema,
    execute: async (
      input: z.infer<typeof createChartArtifactSchema>
    ): Promise<ChartArtifact> => {
      const artifact: ChartArtifact = {
        id: generateArtifactId(),
        type: 'chart',
        title: input.title,
        content: JSON.stringify(
          { data: input.data, options: input.options },
          null,
          2
        ),
        chartType: input.chartType,
        data: input.data,
        options: input.options || {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      return artifact;
    },
  },

  createImageArtifact: {
    description:
      'Create an image artifact (for generated SVGs or referencing images)',
    inputSchema: createImageArtifactSchema,
    execute: async (
      input: z.infer<typeof createImageArtifactSchema>
    ): Promise<ImageArtifact> => {
      const artifact: ImageArtifact = {
        id: generateArtifactId(),
        type: 'image',
        title: input.title,
        content: input.content || '',
        format: input.format,
        width: input.width,
        height: input.height,
        url: input.url,
        base64:
          input.content && input.format !== 'svg' ? input.content : undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      return artifact;
    },
  },

  createDataArtifact: {
    description: 'Create a JSON or CSV data artifact',
    inputSchema: createDataArtifactSchema,
    execute: async (
      input: z.infer<typeof createDataArtifactSchema>
    ): Promise<DataArtifact> => {
      const artifact: DataArtifact = {
        id: generateArtifactId(),
        type: input.type,
        title: input.title,
        content: input.content,
        schema: input.schema,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };
      return artifact;
    },
  },
};

// React component code execution tool
export const executeReactComponentSchema = z.object({
  code: z.string().describe('React component code to execute'),
  props: z
    .record(z.string(), z.any())
    .optional()
    .describe('Props to pass to the component'),
});

export const executeReactComponent = {
  description: 'Execute a React component and render it in a sandbox',
  inputSchema: executeReactComponentSchema,
  execute: async (input: z.infer<typeof executeReactComponentSchema>) => {
    // React execution happens in the code-sandbox component
    // This tool returns the execution request
    return {
      success: true,
      rendered: true,
      code: input.code,
      props: input.props,
    };
  },
};

// Python code execution tool
export const executePythonCodeSchema = z.object({
  code: z.string().describe('Python code to execute'),
  inputs: z.record(z.string(), z.any()).optional().describe('Input variables'),
});

export const executePythonCode = {
  description: 'Execute Python code in a sandboxed environment',
  inputSchema: executePythonCodeSchema,
  execute: async (input: z.infer<typeof executePythonCodeSchema>) => {
    // Python execution happens in the code-sandbox component using Pyodide
    // This tool returns the execution request
    return {
      success: true,
      code: input.code,
      inputs: input.inputs,
      output: '',
      error: null,
    };
  },
};

// SQL query execution tool
export const executeSQLQuerySchema = z.object({
  query: z.string().describe('SQL query to execute'),
  database: z.string().optional().describe('Database name'),
});

export const executeSQLQuery = {
  description: 'Execute SQL queries against a database',
  inputSchema: executeSQLQuerySchema,
  execute: async (input: z.infer<typeof executeSQLQuerySchema>) => {
    // SQL execution would require a backend service
    // Return the query for client-side handling
    return {
      success: true,
      query: input.query,
      database: input.database,
      rows: [],
      rowCount: 0,
    };
  },
};
