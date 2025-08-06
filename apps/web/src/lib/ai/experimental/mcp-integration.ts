import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { experimental_createMCPClient } from 'ai';

// AI SDK v5 experimental MCP Client type - properly aliased to avoid conflicts
export type MCPClient = Awaited<
  ReturnType<typeof experimental_createMCPClient>
>;

// MCP Transport types
export type MCPTransportType = 'stdio' | 'sse' | 'http';

export interface MCPConnectionConfig {
  type: MCPTransportType;
  url?: string;
  command?: string;
  args?: string[];
  sessionId?: string;
  headers?: Record<string, string>;
}

export interface MCPTool {
  description?: string;
  parameters?: unknown;
  execute: (
    args: unknown,
    options?: { toolCallId?: string }
  ) => Promise<unknown>;
}

export interface MCPToolSet {
  [toolName: string]: MCPTool;
}

/**
 * SYMLog MCP Client for tool orchestration across multiple services
 */
export class SYMLogMCPClient {
  private clients: Map<string, MCPClient> = new Map();
  private connections: Map<string, MCPConnectionConfig> = new Map();

  /**
   * Initialize MCP client with specified transport
   */
  async connect(name: string, config: MCPConnectionConfig): Promise<void> {
    // Close existing connection if any
    if (this.clients.has(name)) {
      await this.disconnect(name);
    }

    let transport:
      | StdioClientTransport
      | SSEClientTransport
      | StreamableHTTPClientTransport;

    switch (config.type) {
      case 'stdio': {
        if (!(config.command && config.args)) {
          throw new Error('stdio transport requires command and args');
        }

        // Validate command to prevent injection
        const allowedCommands = ['node', 'python', 'python3', 'deno', 'bun'];
        if (!allowedCommands.includes(config.command)) {
          throw new Error(
            `Command '${config.command}' is not in the allowed list`
          );
        }

        // Validate args - no shell metacharacters
        const dangerousChars = /[;&|`$<>(){}[\]\\'"]/;
        for (const arg of config.args) {
          if (dangerousChars.test(arg)) {
            throw new Error(
              'Arguments contain potentially dangerous characters'
            );
          }
        }

        transport = new StdioClientTransport({
          command: config.command,
          args: config.args,
        });
        break;
      }

      case 'sse': {
        if (!config.url) {
          throw new Error('SSE transport requires URL');
        }

        transport = new SSEClientTransport(new URL(config.url));
        break;
      }

      case 'http': {
        if (!config.url) {
          throw new Error('HTTP transport requires URL');
        }

        transport = new StreamableHTTPClientTransport(new URL(config.url), {
          sessionId: config.sessionId,
        });
        break;
      }

      default:
        throw new Error(`Unknown transport type: ${config.type}`);
    }

    try {
      const client = await experimental_createMCPClient({ transport });
      this.clients.set(name, client);
      this.connections.set(name, config);
    } catch (error) {
      console.error(`Failed to connect MCP client ${name}:`, error);
      throw new Error(
        `MCP connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Connect to multiple MCP servers
   */
  async connectMultiple(
    configs: Array<{ name: string; config: MCPConnectionConfig }>
  ): Promise<void> {
    await Promise.all(
      configs.map(({ name, config }) => this.connect(name, config))
    );
  }

  /**
   * Get tools from a specific MCP client
   */
  async getTools(name: string): Promise<MCPToolSet> {
    const client = this.clients.get(name);
    if (!client) {
      throw new Error(`No MCP client connected with name: ${name}`);
    }

    try {
      // For AI SDK v5, the client exposes tools through a different interface
      // We'll return the tools as-is and handle the type casting
      return client.tools as any as MCPToolSet;
    } catch (error) {
      console.error(`Failed to get tools from ${name}:`, error);
      throw new Error(
        `Failed to retrieve tools: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get tools from all connected MCP clients
   */
  async getAllTools(): Promise<MCPToolSet> {
    const allTools: MCPToolSet = {};

    for (const [name, client] of this.clients) {
      try {
        const tools = client.tools as any as MCPToolSet;

        // Namespace tools by client name to avoid conflicts
        for (const [toolName, tool] of Object.entries(tools)) {
          allTools[`${name}:${toolName}`] = tool;
        }
      } catch (error) {
        console.warn(`Failed to get tools from ${name}:`, error);
      }
    }

    return allTools;
  }

  /**
   * Get merged tools without namespacing (last one wins)
   */
  async getMergedTools(): Promise<MCPToolSet> {
    let mergedTools: MCPToolSet = {};

    for (const [name, client] of this.clients) {
      try {
        const tools = client.tools as any as MCPToolSet;
        mergedTools = { ...mergedTools, ...tools };
      } catch (error) {
        console.warn(`Failed to get tools from ${name}:`, error);
      }
    }

    return mergedTools;
  }

  /**
   * Call a tool on a specific MCP client
   */
  async callTool(
    clientName: string,
    toolName: string,
    args: any
  ): Promise<any> {
    const client = this.clients.get(clientName);
    if (!client) {
      throw new Error(`No MCP client connected with name: ${clientName}`);
    }

    try {
      // AI SDK v5 MCP client tool calling
      return await (client as any).callTool(toolName, args);
    } catch (error) {
      console.error(`Failed to call tool ${toolName} on ${clientName}:`, error);
      throw new Error(
        `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Disconnect a specific MCP client
   */
  async disconnect(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (client) {
      try {
        await client.close();
        // Only remove from maps if close succeeded
        this.clients.delete(name);
        this.connections.delete(name);
      } catch (error) {
        console.error(`Error closing MCP client ${name}:`, error);
        // Re-throw to indicate failure
        throw new Error(
          `Failed to disconnect MCP client ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  /**
   * Disconnect all MCP clients
   */
  async disconnectAll(): Promise<void> {
    await Promise.all(
      Array.from(this.clients.keys()).map((name) => this.disconnect(name))
    );
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): Array<{
    name: string;
    config: MCPConnectionConfig;
    connected: boolean;
  }> {
    return Array.from(this.connections.entries()).map(([name, config]) => ({
      name,
      config,
      connected: this.clients.has(name),
    }));
  }

  /**
   * Check if a client is connected
   */
  isConnected(name: string): boolean {
    return this.clients.has(name);
  }

  /**
   * Get a specific MCP client instance
   */
  getClient(name: string): MCPClient | undefined {
    return this.clients.get(name);
  }
}

// Export singleton instance
export const mcpClient = new SYMLogMCPClient();

/**
 * Helper function to setup default MCP connections
 */
export async function setupDefaultMCPConnections(): Promise<void> {
  const configs: Array<{ name: string; config: MCPConnectionConfig }> = [];

  // Add stdio server if configured
  if (process.env.MCP_STDIO_COMMAND) {
    configs.push({
      name: 'stdio',
      config: {
        type: 'stdio',
        command: process.env.MCP_STDIO_COMMAND,
        args: process.env.MCP_STDIO_ARGS?.split(' ') || [],
      },
    });
  }

  // Add SSE server if configured
  if (process.env.MCP_SSE_URL) {
    configs.push({
      name: 'sse',
      config: {
        type: 'sse',
        url: process.env.MCP_SSE_URL,
      },
    });
  }

  // Add HTTP server if configured
  if (process.env.MCP_HTTP_URL) {
    configs.push({
      name: 'http',
      config: {
        type: 'http',
        url: process.env.MCP_HTTP_URL,
        sessionId: process.env.MCP_SESSION_ID,
      },
    });
  }

  if (configs.length > 0) {
    await mcpClient.connectMultiple(configs);
  }
}

/**
 * Use MCP tools with streaming responses
 */
export function useMCPToolsWithStreaming(
  onFinish: () => Promise<void>,
  onError?: (error: any) => Promise<void>
) {
  return {
    onFinish: async () => {
      await onFinish();
      await mcpClient.disconnectAll();
    },
    onError: async (error: any) => {
      if (onError) {
        await onError(error);
      }
      await mcpClient.disconnectAll();
    },
  };
}
