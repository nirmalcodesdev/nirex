export type OutputType =
    | 'prompt'
    | 'blank'
    | 'label'
    | 'output'
    | 'path'
    | 'remove'
    | 'add'
    | 'success'
    | 'warning';

export interface OutputLine {
    text: string;
    type: OutputType;
}

export type ContextType = 'diff' | 'files' | 'tree';

export interface CommandContext {
    type: ContextType;
    // For 'diff' and 'tree'
    file?: string;
    // For 'files'
    files?: string[];
}

// Main command item
export interface CommandExample {
    cmd: string;
    output: OutputLine[];
    context: CommandContext;
}

// The full array type
export type Commands = CommandExample[];