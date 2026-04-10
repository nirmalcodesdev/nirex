import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Lock, Eye, Server, Share2, UserX, Cookie, Mail } from "lucide-react";
import nirexLogo from "@nirex/assets/images/nirex.svg";
import { APP_NAME, APP_NAME_SUFFIX } from "@nirex/shared";

export function Privacy() {
    const location = useLocation();
    const lastUpdated = "January 1, 2025";

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
                        <img src={nirexLogo} alt="nirex" className="w-8 h-8" />
                        <span className="font-semibold tracking-tight">{APP_NAME}</span>
                        {APP_NAME_SUFFIX && <span className="font-mono text-[0.85em]">{APP_NAME_SUFFIX}</span>}
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
                            <Lock className="h-6 w-6 text-primary" />
                        </div>
                        <h1 className="text-3xl font-semibold tracking-tight text-foreground mb-3">
                            Privacy Policy
                        </h1>
                        <p className="text-muted-foreground">
                            Last updated: {lastUpdated}
                        </p>
                    </div>

                    <div className="prose prose-zinc dark:prose-invert max-w-none">
                        <section className="mb-10">
                            <p className="text-lg text-muted-foreground leading-relaxed">
                                At nirex, we take your privacy seriously. This Privacy Policy explains how we collect,
                                use, disclose, and safeguard your information when you use our services. Please read
                                this policy carefully to understand our practices regarding your personal data.
                            </p>
                        </section>

                        <section className="mb-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <h2 className="text-xl font-semibold text-foreground m-0">1. Information We Collect</h2>
                            </div>
                            <p className="text-muted-foreground leading-relaxed mb-3">
                                We collect several types of information from and about users of our services:
                            </p>
                            <div className="space-y-4">
                                <div className="p-4 bg-muted rounded-lg">
                                    <h3 className="font-medium text-foreground mb-2">Personal Information</h3>
                                    <ul className="space-y-1 text-muted-foreground text-sm">
                                        <li>• Name and email address</li>
                                        <li>• Account credentials</li>
                                        <li>• Billing and payment information</li>
                                        <li>• Profile information you choose to provide</li>
                                    </ul>
                                </div>
                                <div className="p-4 bg-muted rounded-lg">
                                    <h3 className="font-medium text-foreground mb-2">Usage Data</h3>
                                    <ul className="space-y-1 text-muted-foreground text-sm">
                                        <li>• IP address and browser type</li>
                                        <li>• Device information and operating system</li>
                                        <li>• Pages visited and features used</li>
                                        <li>• Time spent on our platform</li>
                                    </ul>
                                </div>
                            </div>
                        </section>

                        <section className="mb-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                                    <Server className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <h2 className="text-xl font-semibold text-foreground m-0">2. How We Use Your Information</h2>
                            </div>
                            <p className="text-muted-foreground leading-relaxed mb-3">
                                We use the information we collect for various purposes, including:
                            </p>
                            <ul className="space-y-2 text-muted-foreground">
                                <li className="flex items-start gap-2">
                                    <span className="text-primary mt-1.5">•</span>
                                    <span>Providing, maintaining, and improving our services</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-primary mt-1.5">•</span>
                                    <span>Processing transactions and sending related information</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-primary mt-1.5">•</span>
                                    <span>Sending technical notices, updates, and support messages</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-primary mt-1.5">•</span>
                                    <span>Responding to your comments and questions</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-primary mt-1.5">•</span>
                                    <span>Understanding how users interact with our services</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-primary mt-1.5">•</span>
                                    <span>Detecting, preventing, and addressing technical issues</span>
                                </li>
                            </ul>
                        </section>

                        <section className="mb-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                                    <Share2 className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <h2 className="text-xl font-semibold text-foreground m-0">3. Information Sharing</h2>
                            </div>
                            <p className="text-muted-foreground leading-relaxed mb-3">
                                We do not sell, trade, or rent your personal information to third parties. We may
                                share your information only in the following circumstances:
                            </p>
                            <ul className="space-y-2 text-muted-foreground">
                                <li className="flex items-start gap-2">
                                    <span className="text-primary mt-1.5">•</span>
                                    <span><strong>Service Providers:</strong> With trusted third parties who assist us in operating our services</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-primary mt-1.5">•</span>
                                    <span><strong>Legal Requirements:</strong> When required by law or to protect our rights</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-primary mt-1.5">•</span>
                                    <span><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-primary mt-1.5">•</span>
                                    <span><strong>With Your Consent:</strong> When you explicitly authorize us to share your information</span>
                                </li>
                            </ul>
                        </section>

                        <section className="mb-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                                    <Cookie className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <h2 className="text-xl font-semibold text-foreground m-0">4. Cookies and Tracking</h2>
                            </div>
                            <p className="text-muted-foreground leading-relaxed mb-3">
                                We use cookies and similar tracking technologies to track activity on our services
                                and hold certain information. Cookies are files with a small amount of data that
                                may include an anonymous unique identifier.
                            </p>
                            <p className="text-muted-foreground leading-relaxed mb-3">
                                Types of cookies we use:
                            </p>
                            <ul className="space-y-2 text-muted-foreground">
                                <li className="flex items-start gap-2">
                                    <span className="text-primary mt-1.5">•</span>
                                    <span><strong>Essential Cookies:</strong> Required for the operation of our services</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-primary mt-1.5">•</span>
                                    <span><strong>Preference Cookies:</strong> Remember your settings and preferences</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-primary mt-1.5">•</span>
                                    <span><strong>Analytics Cookies:</strong> Help us understand how visitors interact with our services</span>
                                </li>
                            </ul>
                            <p className="text-muted-foreground leading-relaxed mt-3">
                                You can instruct your browser to refuse all cookies or to indicate when a cookie
                                is being sent. However, if you do not accept cookies, you may not be able to use
                                some portions of our services.
                            </p>
                        </section>

                        <section className="mb-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                                    <UserX className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <h2 className="text-xl font-semibold text-foreground m-0">5. Your Data Rights</h2>
                            </div>
                            <p className="text-muted-foreground leading-relaxed mb-3">
                                Depending on your location, you may have the following rights regarding your personal data:
                            </p>
                            <ul className="space-y-2 text-muted-foreground">
                                <li className="flex items-start gap-2">
                                    <span className="text-primary mt-1.5">•</span>
                                    <span><strong>Access:</strong> Request a copy of the personal data we hold about you</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-primary mt-1.5">•</span>
                                    <span><strong>Correction:</strong> Request correction of inaccurate or incomplete data</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-primary mt-1.5">•</span>
                                    <span><strong>Deletion:</strong> Request deletion of your personal data</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-primary mt-1.5">•</span>
                                    <span><strong>Portability:</strong> Request transfer of your data to another service</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-primary mt-1.5">•</span>
                                    <span><strong>Objection:</strong> Object to processing of your personal data</span>
                                </li>
                            </ul>
                            <p className="text-muted-foreground leading-relaxed mt-3">
                                To exercise any of these rights, please contact us using the information provided
                                at the end of this policy.
                            </p>
                        </section>

                        <section className="mb-10">
                            <h2 className="text-xl font-semibold text-foreground mb-4">6. Data Security</h2>
                            <p className="text-muted-foreground leading-relaxed">
                                We implement appropriate technical and organizational measures to protect your
                                personal data against unauthorized access, alteration, disclosure, or destruction.
                                However, no method of transmission over the Internet or electronic storage is
                                100% secure. While we strive to use commercially acceptable means to protect your
                                personal data, we cannot guarantee its absolute security.
                            </p>
                        </section>

                        <section className="mb-10">
                            <h2 className="text-xl font-semibold text-foreground mb-4">7. Data Retention</h2>
                            <p className="text-muted-foreground leading-relaxed">
                                We will retain your personal information only for as long as is necessary for the
                                purposes set out in this Privacy Policy. We will retain and use your information
                                to the extent necessary to comply with our legal obligations, resolve disputes,
                                and enforce our policies.
                            </p>
                        </section>

                        <section className="mb-10">
                            <h2 className="text-xl font-semibold text-foreground mb-4">8. Children's Privacy</h2>
                            <p className="text-muted-foreground leading-relaxed">
                                Our services are not intended for use by children under the age of 13. We do not
                                knowingly collect personally identifiable information from children under 13. If
                                you are a parent or guardian and you are aware that your child has provided us
                                with personal data, please contact us immediately.
                            </p>
                        </section>

                        <section className="mb-10">
                            <h2 className="text-xl font-semibold text-foreground mb-4">9. International Data Transfers</h2>
                            <p className="text-muted-foreground leading-relaxed">
                                Your information may be transferred to and maintained on computers located outside
                                of your state, province, country, or other governmental jurisdiction where data
                                protection laws may differ. We will take all steps reasonably necessary to ensure
                                that your data is treated securely and in accordance with this Privacy Policy.
                            </p>
                        </section>

                        <section className="mb-10">
                            <h2 className="text-xl font-semibold text-foreground mb-4">10. Changes to This Policy</h2>
                            <p className="text-muted-foreground leading-relaxed">
                                We may update our Privacy Policy from time to time. We will notify you of any
                                changes by posting the new Privacy Policy on this page and updating the
                                "Last updated" date. You are advised to review this Privacy Policy periodically
                                for any changes.
                            </p>
                        </section>

                        <section className="mb-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <h2 className="text-xl font-semibold text-foreground m-0">11. Contact Us</h2>
                            </div>
                            <p className="text-muted-foreground leading-relaxed">
                                If you have any questions about this Privacy Policy or our data practices, please contact us:
                            </p>
                            <div className="mt-3 p-4 bg-muted rounded-lg">
                                <p className="text-foreground font-medium">nirex, Inc.</p>
                                <p className="text-muted-foreground">Email: privacy@nirex.com</p>
                                <p className="text-muted-foreground">Address: 123 Innovation Drive, San Francisco, CA 94105</p>
                                <p className="text-muted-foreground">Phone: +1 (555) 123-4567</p>
                            </div>
                        </section>
                    </div>

                    {/* Footer */}
                    <div className="mt-16 pt-8 border-t border-border">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <p className="text-sm text-muted-foreground">
                                By signing up, you agree to our Privacy Policy
                            </p>
                            <div className="flex items-center gap-4">
                                <Link
                                    to="/terms"
                                    state={{ from: returnPath }}
                                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Terms of Service
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
