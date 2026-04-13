import { useEffect, useState } from "react";

export function useSimulatedLoading(delay = 1500) {
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const timer = window.setTimeout(() => setIsLoading(false), delay);
        return () => window.clearTimeout(timer);
    }, [delay]);

    return isLoading;
}
