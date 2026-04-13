import { useState, useEffect, useRef, useCallback } from 'react';

interface TerminalLine {
    text: string;
    delay?: number;
}

export function useTerminalTyping(lines: TerminalLine[], autoRestart = true, restartDelay = 3000) {
    const [displayedLines, setDisplayedLines] = useState<string[]>([]);
    const [currentLineIndex, setCurrentLineIndex] = useState(0);
    const [currentCharIndex, setCurrentCharIndex] = useState(0);
    const [isTyping, setIsTyping] = useState(true);
    const [showCursor, setShowCursor] = useState(true);
    const timeoutRef = useRef<number | undefined>(undefined);

    const reset = useCallback(() => {
        setDisplayedLines([]);
        setCurrentLineIndex(0);
        setCurrentCharIndex(0);
        setIsTyping(true);
    }, []);

    useEffect(() => {
        if (!isTyping || currentLineIndex >= lines.length) {
            if (currentLineIndex >= lines.length && autoRestart) {
                timeoutRef.current = window.setTimeout(reset, restartDelay);
            }
            return;
        }

        const line = lines[currentLineIndex];

        // Guard clause: if line is undefined, schedule stop typing
        if (!line) {
            timeoutRef.current = window.setTimeout(() => {
                setIsTyping(false);
            }, 0);
            return;
        }

        const charDelay = line.delay ?? 30;

        if (currentCharIndex <= line.text.length) {
            timeoutRef.current = window.setTimeout(() => {
                setDisplayedLines(prev => {
                    const newLines = [...prev];
                    newLines[currentLineIndex] = line.text.slice(0, currentCharIndex);
                    return newLines;
                });

                if (currentCharIndex === line.text.length) {
                    setCurrentLineIndex(prev => prev + 1);
                    setCurrentCharIndex(0);
                } else {
                    setCurrentCharIndex(prev => prev + 1);
                }
            }, currentCharIndex === 0 && currentLineIndex > 0 ? 200 : charDelay);
        }

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [currentLineIndex, currentCharIndex, isTyping, lines, autoRestart, restartDelay, reset]);

    // Cursor blink effect
    useEffect(() => {
        const interval = setInterval(() => {
            setShowCursor(prev => !prev);
        }, 530);
        return () => clearInterval(interval);
    }, []);

    return { displayedLines, showCursor, isComplete: currentLineIndex >= lines.length };
}