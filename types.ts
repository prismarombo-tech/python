
export enum AppStatus {
  LOADING = 'LOADING',
  READY = 'READY',
  RUNNING = 'RUNNING',
  ERROR = 'ERROR',
  AWAITING_INPUT = 'AWAITING_INPUT'
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  error?: string;
}

// Added 'copy' to the supported security event types to permit tracking of copy/cut actions in the editor
export interface SecurityEvent {
  type: 'paste' | 'copy' | 'blur' | 'visibility';
  timestamp: number;
  message: string;
}

declare global {
  interface Window {
    loadPyodide: any;
    __PRISMA_INPUT_RESOLVER__: (value: string) => void;
  }
}