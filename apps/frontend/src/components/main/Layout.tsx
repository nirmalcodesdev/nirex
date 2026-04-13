import { Outlet } from "react-router-dom";
import { DesktopSidebar, SidebarProvider } from "./Sidebar";
import { Header } from "./Header";
import { Plans } from "@/components/ui/Plans";

export function Layout() {
    return (
        <SidebarProvider>
            <div className="min-h-screen flex bg-background">
                {/* Desktop Sidebar - lg+ only, collapsible */}
                <DesktopSidebar />

                {/* Main Content */}
                <div className="flex-1 flex flex-col min-w-0 min-h-screen w-full overflow-hidden pt-14 lg:pt-16">
                    {/* Single Header - Responsive */}
                    <Header />

                    {/* Page Content */}
                    <main className="flex-1 overflow-auto">
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
