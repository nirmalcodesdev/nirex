import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Home, ArrowLeft, FileQuestion } from "lucide-react";

const NotFound = () => {
    const location = useLocation();

    useEffect(() => {
        console.error("404 Error: User attempted to access non-existent route:", location.pathname);
    }, [location.pathname]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
            <div className="text-center max-w-md mx-auto">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center bg-muted">
                    <FileQuestion size={40} className="text-muted-foreground" />
                </div>
                <h1 className="text-5xl font-bold tracking-tight mb-3">404</h1>
                <p className="text-lg text-muted-foreground mb-2">Page not found</p>
                <p className="text-sm text-muted-foreground mb-8">
                    The page you&apos;re looking for doesn&apos;t exist or has been moved. Check the URL or return to the dashboard.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                        <Home size={16} />
                        Back to Dashboard
                    </Link>
                    <button
                        type="button"
                        onClick={() => window.history.back()}
                        className="inline-flex items-center gap-2 border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                    >
                        <ArrowLeft size={16} />
                        Go Back
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NotFound;
