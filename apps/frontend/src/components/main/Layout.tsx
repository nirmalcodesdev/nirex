import { Outlet } from "react-router-dom";
import { DesktopSidebar, SidebarProvider } from "./Sidebar";
import { Header } from "./Header";
import { Plans } from "@/components/ui/Plans";

export function Layout() {
    return (
        <SidebarProvider>
            {/* Skip to main content for keyboard users */}
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-4 focus:left-4 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus: focus:text-sm focus:font-medium"
            >
                Skip to main content
            </a>
            <div className="min-h-screen flex bg-background">
                {/* Desktop Sidebar - lg+ only, collapsible */}
                <DesktopSidebar />

                {/* Main Content */}
                <div className="flex-1 flex flex-col min-w-0 min-h-screen w-full overflow-hidden pt-14 lg:pt-16">
                    {/* Single Header - Responsive */}
                    <Header />

                    {/* Page Content */}
                    <main id="main-content" className="flex-1 overflow-auto focus-visible:outline-none" tabIndex={-1}>
                        <div className="w-full max-w-[1600px] mx-auto py-3 sm:py-4 lg:py-8 px-2 sm:px-3 lg:px-6">
                            <Outlet />
                        </div>
                    </main>
                </div>
            </div>

            {/* Global Dialogs */}
            <Plans />
        </SidebarProvider>
    );
}
