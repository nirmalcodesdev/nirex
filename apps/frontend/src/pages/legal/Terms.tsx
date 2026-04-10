import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Hexagon, ArrowLeft, FileText, Shield, UserCheck, Scale, Globe } from "lucide-react";

export function Terms() {
    const location = useLocation();
    const lastUpdated = "January 1, 2026";

    // Get the return path from location state, or detect based on referrer
    const getReturnPath = () => {
        const state = location.state as { from?: string } | null;
        if (state?.from) {
            return state.from;
        }
        // Default fallback based on common patterns
        const referrer = document.referrer;
        if (referrer.includes("/auth/login")) {
            return "/auth/login";
        } else if (referrer.includes("/auth/signup")) {
            return "/auth/signup";
        }
        return "/auth/signup";
    };

    const returnPath = getReturnPath();

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
                <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                            <Hexagon size={18} strokeWidth={2.5} />
                        </div>
                        <span className="font-semibold tracking-tight">nirex</span>
                    </Link>
                    <Link
                        to={returnPath}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </Link>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-3xl mx-auto px-6 py-12">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                >
                    <div className="text-center mb-12">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                            <FileText className="h-6 w-6 text-primary" />
                        </div>
                        <h1 className="text-3xl font-semibold tracking-tight text-foreground mb-3">
                            Terms of Service
                        </h1>
                        <p className="text-muted-foreground">
                            Last updated: {lastUpdated}
                        </p>
                    </div>

                    <div className="prose prose-zinc dark:prose-invert max-w-none">
                        <section className="mb-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                                    <Shield className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <h2 className="text-xl font-semibold text-foreground m-0">1. Acceptance of Terms</h2>
                            </div>
                            <p className="text-muted-foreground leading-relaxed">
                                By accessing or using nirex's services, you agree to be bound by these Terms of Service
                                and all applicable laws and regulations. If you do not agree with any of these terms,
                                you are prohibited from using or accessing our services.
                            </p>
                        </section>

                        <section className="mb-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                                    <UserCheck className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <h2 className="text-xl font-semibold text-foreground m-0">2. Account Registration</h2>
                            </div>
                            <p className="text-muted-foreground leading-relaxed mb-3">
                                To use certain features of our services, you must register for an account. You agree to:
                            </p>
                            <ul className="space-y-2 text-muted-foreground">
                                <li className="flex items-start gap-2">
                                    <span className="text-primary mt-1.5">•</span>
                                    <span>Provide accurate, current, and complete information during registration</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-primary mt-1.5">•</span>
                                    <span>Maintain and promptly update your account information</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-primary mt-1.5">•</span>
                                    <span>Maintain the security of your password and accept all risks of unauthorized access</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-primary mt-1.5">•</span>
                                    <span>Notify us immediately if you discover or suspect any security breaches</span>
                                </li>
                            </ul>
                        </section>

                        <section className="mb-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                                    <Scale className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <h2 className="text-xl font-semibold text-foreground m-0">3. Acceptable Use</h2>
                            </div>
                            <p className="text-muted-foreground leading-relaxed mb-3">
                                You agree not to use our services to:
                            </p>
                            <ul className="space-y-2 text-muted-foreground">
                                <li className="flex items-start gap-2">
                                    <span className="text-primary mt-1.5">•</span>
                                    <span>Violate any applicable laws or regulations</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-primary mt-1.5">•</span>
                                    <span>Infringe upon the rights of others, including intellectual property rights</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-primary mt-1.5">•</span>
                                    <span>Transmit any harmful code, malware, or viruses</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-primary mt-1.5">•</span>
                                    <span>Attempt to gain unauthorized access to our systems or user accounts</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-primary mt-1.5">•</span>
                                    <span>Engage in any activity that disrupts or interferes with our services</span>
                                </li>
                            </ul>
                        </section>

                        <section className="mb-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                                    <Globe className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <h2 className="text-xl font-semibold text-foreground m-0">4. Service Availability</h2>
                            </div>
                            <p className="text-muted-foreground leading-relaxed">
                                We strive to maintain high availability of our services, but we do not guarantee
                                uninterrupted access. We reserve the right to modify, suspend, or discontinue
                                any part of our services at any time, with or without notice. We will not be
                                liable for any modification, suspension, or discontinuation of the services.
                            </p>
                        </section>

                        <section className="mb-10">
                            <h2 className="text-xl font-semibold text-foreground mb-4">5. Payment and Billing</h2>
                            <p className="text-muted-foreground leading-relaxed mb-3">
                                Some of our services require payment. By subscribing to a paid plan:
                            </p>
                            <ul className="space-y-2 text-muted-foreground">
                                <li className="flex items-start gap-2">
                                    <span className="text-primary mt-1.5">•</span>
                                    <span>You agree to pay all fees associated with your subscription</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-primary mt-1.5">•</span>
                                    <span>All payments are non-refundable unless otherwise specified</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-primary mt-1.5">•</span>
                                    <span>We may change our pricing upon notice to you</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-primary mt-1.5">•</span>
                                    <span>You authorize us to charge your payment method for all applicable fees</span>
                                </li>
                            </ul>
                        </section>

                        <section className="mb-10">
                            <h2 className="text-xl font-semibold text-foreground mb-4">6. Intellectual Property</h2>
                            <p className="text-muted-foreground leading-relaxed">
                                All content, features, and functionality of our services, including but not limited
                                to text, graphics, logos, icons, images, audio clips, and software, are owned by
                                nirex or our licensors and are protected by copyright, trademark, and other
                                intellectual property laws. You may not reproduce, distribute, modify, create
                                derivative works from, or exploit any content without our express written permission.
                            </p>
                        </section>

                        <section className="mb-10">
                            <h2 className="text-xl font-semibold text-foreground mb-4">7. Termination</h2>
                            <p className="text-muted-foreground leading-relaxed">
                                We may terminate or suspend your account and access to our services immediately,
                                without prior notice or liability, for any reason, including if you breach these
                                Terms of Service. Upon termination, your right to use the services will immediately
                                cease. All provisions of these terms which by their nature should survive
                                termination shall survive.
                            </p>
                        </section>

                        <section className="mb-10">
                            <h2 className="text-xl font-semibold text-foreground mb-4">8. Limitation of Liability</h2>
                            <p className="text-muted-foreground leading-relaxed">
                                To the maximum extent permitted by law, nirex shall not be liable for any indirect,
                                incidental, special, consequential, or punitive damages, including loss of profits,
                                data, or use, arising out of or in connection with these terms or your use of our
                                services, whether based on warranty, contract, tort, or any other legal theory.
                            </p>
                        </section>

                        <section className="mb-10">
                            <h2 className="text-xl font-semibold text-foreground mb-4">9. Changes to Terms</h2>
                            <p className="text-muted-foreground leading-relaxed">
                                We reserve the right to modify these terms at any time. We will notify you of any
                                material changes by posting the new terms on this page and updating the "Last updated"
                                date. Your continued use of our services after any changes constitutes acceptance
                                of the revised terms.
                            </p>
                        </section>

                        <section className="mb-10">
                            <h2 className="text-xl font-semibold text-foreground mb-4">10. Contact Us</h2>
                            <p className="text-muted-foreground leading-relaxed">
                                If you have any questions about these Terms of Service, please contact us at:
                            </p>
                            <div className="mt-3 p-4 bg-muted rounded-lg">
                                <p className="text-foreground font-medium">nirex, Inc.</p>
                                <p className="text-muted-foreground">Email: legal@nirex.com</p>
                                <p className="text-muted-foreground">Address: 123 Innovation Drive, San Francisco, CA 94105</p>
                            </div>
                        </section>
                    </div>

                    {/* Footer */}
                    <div className="mt-16 pt-8 border-t border-border">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <p className="text-sm text-muted-foreground">
                                By signing up, you agree to our Terms of Service
                            </p>
                            <div className="flex items-center gap-4">
                                <Link
                                    to="/privacy"
                                    state={{ from: returnPath }}
                                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Privacy Policy
                                </Link>
                                <Link
                                    to={returnPath}
                                    className="text-sm font-medium text-foreground hover:underline"
                                >
                                    Back
                                </Link>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </main>
        </div>
    );
}
