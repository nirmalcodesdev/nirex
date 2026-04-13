import { createContext, useContext, type ReactNode } from "react";
import { toast as sonnerToast } from "sonner";

interface ToastContextType {
    toast: (message: string, type?: "success" | "error" | "info" | "warning") => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within ToastProvider");
    }
    return context;
}

interface ToastProviderProps {
    children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
    const toast = (message: string, type: "success" | "error" | "info" | "warning" = "info") => {
        switch (type) {
            case "success":
                sonnerToast.success(message);
                break;
            case "error":
                sonnerToast.error(message);
                break;
            case "warning":
                sonnerToast.warning(message);
                break;
            default:
                sonnerToast.info(message);
        }
    };

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}
        </ToastContext.Provider>
    );
}
