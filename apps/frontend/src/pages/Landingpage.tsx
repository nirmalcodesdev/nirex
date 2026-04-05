import { Footer } from '@nirex/ui/layout/Footer';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import Hero from '@/components/sections/landingpage/Hero';
import GrainOverlay from '@nirex/ui/layout/GrainOverlay';
import CustomCursor from '@nirex/ui/CustomCursor';
import Nav from '@nirex/ui/layout/Nav';
import { footerDescription, footerLinks, navLinks, socialLinks } from '@/constant/landingpage';
import { APP_NAME, APP_NAME_SUFFIX } from '@nirex/shared';
import nirexLogo from '@nirex/assets/images/nirex.svg';

export default function LandingPage() {
    const revealRef = useScrollReveal();

    return (
        <div ref={revealRef}>
            <a href="#main" className="skip-link">Skip to main content</a>
            <CustomCursor />
            <GrainOverlay />
            <Nav links={navLinks} brandName={APP_NAME} brandSuffix={APP_NAME_SUFFIX} logoSrc={nirexLogo} />

            <main id="main">
                <Hero />

            </main>

            <Footer columns={footerLinks} brandName={`${APP_NAME}`} socialLinks={socialLinks} brandHref='/' description={footerDescription} brandSuffix={APP_NAME_SUFFIX} copyrightName={`${APP_NAME} ${APP_NAME_SUFFIX}`} />
        </div>
    );
}
