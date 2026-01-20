declare module 'mammoth/mammoth.browser' {
  export interface MammothResult {
    value: string;
    messages?: Array<{ type: string; message: string }>;
  }

  export function convertToHtml(
    input: { arrayBuffer: ArrayBuffer | Uint8Array },
    options?: Record<string, unknown>
  ): Promise<MammothResult>;

  export function extractRawText(
    input: { arrayBuffer: ArrayBuffer | Uint8Array },
    options?: Record<string, unknown>
  ): Promise<MammothResult>;
}
