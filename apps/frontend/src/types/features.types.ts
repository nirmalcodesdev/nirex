export interface TerminalLine {
    text: string;
    prompt?: boolean;
    path?: boolean;
    success?: boolean;
}

export interface Feature {
    label: string;
    title: string;
    description: string;
    /** Large / featured card */
    large?: boolean;
    /** Tall card (used for Internet Search) */
    tall?: boolean;
    /** Terminal simulation (only used in the first feature) */
    terminal?: TerminalLine[];
}

// The main array type
export type Features = Feature[];