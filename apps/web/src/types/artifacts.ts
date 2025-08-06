export type ArtifactType =
  | 'code'
  | 'document'
  | 'spreadsheet'
  | 'image'
  | 'chart'
  | 'markdown'
  | 'html'
  | 'react-component'
  | 'python-script'
  | 'sql-query'
  | 'json'
  | 'csv';

export interface BaseArtifact {
  id: string;
  type: ArtifactType;
  title: string;
  content: string;
  language?: string;
  createdAt: number;
  updatedAt: number;
  version: number;
  metadata?: Record<string, any>;
}

export interface CodeArtifact extends BaseArtifact {
  type: 'code' | 'react-component' | 'python-script' | 'sql-query';
  language: string;
  runnable: boolean;
  dependencies?: string[];
  output?: string;
  error?: string;
}

export interface DocumentArtifact extends BaseArtifact {
  type: 'document' | 'markdown' | 'html';
  format: 'markdown' | 'html' | 'plain';
  toc?: TableOfContentsItem[];
}

export interface SpreadsheetArtifact extends BaseArtifact {
  type: 'spreadsheet';
  data: Array<Record<string, any>>;
  columns: Array<{
    key: string;
    label: string;
    type: 'string' | 'number' | 'date' | 'boolean';
    width?: number;
  }>;
  formulas?: Record<string, string>;
}

export interface ImageArtifact extends BaseArtifact {
  type: 'image';
  format: 'png' | 'jpg' | 'svg' | 'gif';
  width: number;
  height: number;
  url?: string;
  base64?: string;
}

export interface ChartArtifact extends BaseArtifact {
  type: 'chart';
  chartType: 'line' | 'bar' | 'pie' | 'scatter' | 'area';
  data: any;
  options: any;
}

export interface DataArtifact extends BaseArtifact {
  type: 'json' | 'csv';
  schema?: any;
  preview?: any;
}

export type Artifact =
  | CodeArtifact
  | DocumentArtifact
  | SpreadsheetArtifact
  | ImageArtifact
  | ChartArtifact
  | DataArtifact;

export interface TableOfContentsItem {
  id: string;
  title: string;
  level: number;
  children?: TableOfContentsItem[];
}

export interface ArtifactExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
  executionTime?: number;
  logs?: string[];
}

export interface ArtifactAction {
  id: string;
  label: string;
  icon?: string;
  handler: (artifact: Artifact) => void | Promise<void>;
  enabled?: (artifact: Artifact) => boolean;
}
