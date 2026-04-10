import { Footer } from '@nirex/ui/layout/Footer';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import Hero from '@/components/sections/landingpage/Hero';
import GrainOverlay from '@nirex/ui/layout/GrainOverlay';
import Nav from '@nirex/ui/layout/Nav';
import { footerDescription, footerLinks, navLinks, socialLinks } from '@/constant/landingpage';
import { APP_NAME, APP_NAME_SUFFIX } from '@nirex/shared';
import nirexLogo from '@nirex/assets/images/nirex.svg';
import Stats from '@/components/sections/landingpage/Stats';
import Problem from '@/components/sections/landingpage/Problem';
import Solution from '@/components/sections/landingpage/Solution';
import Demo from '@/components/sections/landingpage/Demo';
import HowItWorks from '@/components/sections/landingpage/HowItWorks';
import Testimonials from '@/components/sections/landingpage/Testimonials';
import Pricing from '@/components/sections/landingpage/Pricing';
import FAQ from '@/components/sections/landingpage/FAQ';
import FinalCTA from '@/components/sections/landingpage/FinalCTA';
import Features from '@/components/sections/landingpage/Features';

export default function LandingPage() {
    const revealRef = useScrollReveal();

    return (
        <div ref={revealRef}>
            <a href="#main" className="skip-link">Skip to main content</a>
            <GrainOverlay />
            <Nav links={navLinks} brandName={APP_NAME} brandSuffix={APP_NAME_SUFFIX} logoSrc={nirexLogo} ctaTo='/auth/signup' />

            <main id="main">
                <Hero />
                <Stats />
                <Problem />
                <Solution />
                <Features />
                <Demo />
                <HowItWorks />
                <Testimonials />
                <Pricing />
                <FAQ />
                <FinalCTA />


            </main>

            <Footer columns={footerLinks} brandName={`${APP_NAME}`} socialLinks={socialLinks} brandHref='/' description={footerDescription} brandSuffix={APP_NAME_SUFFIX} copyrightName={`${APP_NAME} ${APP_NAME_SUFFIX}`} />
        </div>
    );
}
