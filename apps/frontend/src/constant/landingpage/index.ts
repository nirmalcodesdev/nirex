import type { FooterColumn, NavLink, SocialLink } from "@nirex/shared";
import { FaGithub } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { BsDiscord } from "react-icons/bs";

import type { ComponentType } from "react";
import type { PricingPlans } from "@/types/plans.types";
import type { FAQs } from "@/types/faq.types";
import type { Features } from "@/types/features.types";
import type { Commands } from "@/types/commands.types";
export const navLinks: NavLink[] = [
    {
        label: "Features",
        href: "#features"
    },
    {
        label: "Demo",
        href: "#demo"
    },
    {
        label: "Pricing",
        href: "#pricing"
    },
    {
        label: "Docs",
        href: "/docs"
    }

]

export const footerLinks: FooterColumn[] = [
    {
        title: 'Product',
        links: [
            { label: 'Features', href: '#features' },
            { label: 'Pricing', href: '#pricing' },
            { label: 'Changelog', href: '#' },
            { label: 'Documentation', href: '#' },
            { label: 'CLI Reference', href: '#' },
        ],
    },
    {
        title: 'Resources',
        links: [
            { label: 'Getting Started', href: '#' },
            { label: 'API Reference', href: '#' },
            { label: 'Integrations', href: '#' },
            { label: 'Blog', href: '#' },
            { label: 'Status', href: '#' },
        ],
    },
    {
        title: 'Company',
        links: [
            { label: 'About', href: '#' },
            { label: 'Careers', href: '#' },
            { label: 'Contact', href: '#' },
            { label: 'Press Kit', href: '#' },
        ],
    },
    {
        title: 'Legal',
        links: [
            { label: 'Privacy Policy', href: '#' },
            { label: 'Terms of Service', href: '#' },
            { label: 'Security', href: '#' },
            { label: 'DPA', href: '#' },
        ],
    },
];

export const socialLinks: SocialLink<ComponentType>[] = [
    {
        label: 'GitHub',
        icon: FaGithub,
        href: "#"
    },
    {
        label: 'X',
        icon: FaXTwitter,
        href: "#"
    },
    {
        label: 'Discord',
        icon: BsDiscord,
        href: "#"
    },
];


export const footerDescription: string = "Multi-agent AI that lives in your terminal. Fix, generate, explain, and refactor — powered by the world's best AI models."

export const terminalLines: { text: string, delay: number }[] = [
    { text: '$ nirex fix "token refresh keeps failing after 30min"', delay: 40 },
    { text: '', delay: 10 },
    { text: '  Orchestrating agents: CodeAnalyzer → ContextMapper → PatchWriter', delay: 25 },
    { text: '  Agents scanning 847 files across 12 modules...', delay: 20 },
    { text: '  Agent[Search] querying latest auth best practices...', delay: 25 },
    { text: '', delay: 10 },
    { text: '  Found › src/auth/tokenService.ts:142', delay: 25 },
    { text: '  Issue  › Refresh timer uses Date.now() at mount,', delay: 25 },
    { text: '           not at execution — token expires too early.', delay: 25 },
    { text: '', delay: 10 },
    { text: '  Diff:', delay: 30 },
    { text: '  - const expiresAt = Date.now() + TOKEN_TTL', delay: 25 },
    { text: '  + const expiresAt = () => Date.now() + TOKEN_TTL', delay: 25 },
    { text: '', delay: 10 },
    { text: '  Apply this patch? [Y/n] Y', delay: 60 },
    { text: '', delay: 10 },
    { text: '  ✓ Patch applied  ·  1 file changed, 1 insertion(+), 1 deletion(-)', delay: 20 },
];


export const commands: Commands = [
    {
        cmd: '$ nirex fix',
        output: [
            { text: '$ nirex fix "auth token expires prematurely"', type: 'prompt' },
            { text: '', type: 'blank' },
            { text: '  Orchestrating: Analyzer → Search → Patcher', type: 'label' },
            { text: '  Scanning 847 files across 12 modules', type: 'output' },
            { text: '', type: 'blank' },
            { text: '  Found › src/auth/tokenService.ts:142', type: 'path' },
            { text: '  Issue › Refresh timer captures stale timestamp', type: 'label' },
            { text: '', type: 'blank' },
            { text: '  - const expiresAt = Date.now() + TOKEN_TTL', type: 'remove' },
            { text: '  + const expiresAt = () => Date.now() + TOKEN_TTL', type: 'add' },
            { text: '', type: 'blank' },
            { text: '  ✓ Patch applied · 1 file changed', type: 'success' },
        ],
        context: { type: 'diff', file: 'src/auth/tokenService.ts' },
    },
    {
        cmd: '$ nirex generate',
        output: [
            { text: '$ nirex generate "rate limiter middleware for Express"', type: 'prompt' },
            { text: '', type: 'blank' },
            { text: '  Agent[Search] querying Redis rate-limit patterns...', type: 'label' },
            { text: '  Detected: Express 4.x, TypeScript, Redis', type: 'output' },
            { text: '', type: 'blank' },
            { text: '  Generated › src/middleware/rateLimiter.ts', type: 'path' },
            { text: '  Generated › src/middleware/rateLimiter.test.ts', type: 'path' },
            { text: '', type: 'blank' },
            { text: '  ✓ 2 files created · matches project conventions', type: 'success' },
        ],
        context: { type: 'files', files: ['src/middleware/rateLimiter.ts', 'src/middleware/rateLimiter.test.ts'] },
    },
    {
        cmd: '$ nirex explain',
        output: [
            { text: '$ nirex explain src/auth/token.ts', type: 'prompt' },
            { text: '', type: 'blank' },
            { text: '  ┌─ tokenService.ts ─────────────────────┐', type: 'output' },
            { text: '  │ Purpose: JWT refresh token management  │', type: 'output' },
            { text: '  │ Dependencies: 3 internal, 2 external   │', type: 'output' },
            { text: '  │ Complexity: moderate (cyclomatic: 8)    │', type: 'output' },
            { text: '  └────────────────────────────────────────┘', type: 'output' },
            { text: '', type: 'blank' },
            { text: '  Key functions:', type: 'label' },
            { text: '    refreshToken()  → handles silent refresh', type: 'output' },
            { text: '    validateJWT()   → verifies token integrity', type: 'output' },
        ],
        context: { type: 'tree', file: 'src/auth/' },
    },
    {
        cmd: '$ nirex refactor',
        output: [
            { text: '$ nirex refactor utils/dateHelper.ts', type: 'prompt' },
            { text: '', type: 'blank' },
            { text: '  Analyzing code quality...', type: 'output' },
            { text: '', type: 'blank' },
            { text: '  Issues found: 3', type: 'label' },
            { text: '    1. Duplicated date formatting (L24, L67)', type: 'warning' },
            { text: '    2. Missing timezone in parseDate()', type: 'warning' },
            { text: '    3. Unused import: moment', type: 'output' },
            { text: '', type: 'blank' },
            { text: '  ✓ Refactored · 3 improvements applied', type: 'success' },
        ],
        context: { type: 'diff', file: 'utils/dateHelper.ts' },
    },
    {
        cmd: '$ nirex search',
        output: [
            { text: '$ nirex search "best practices for Next.js 15 caching"', type: 'prompt' },
            { text: '', type: 'blank' },
            { text: '  Agent[Search] querying the internet...', type: 'label' },
            { text: '  Found 12 relevant sources', type: 'output' },
            { text: '', type: 'blank' },
            { text: '  › Next.js 15 docs — unstable_cache deprecated', type: 'path' },
            { text: '  › Vercel blog — new cacheLife() API', type: 'path' },
            { text: '  › GitHub issue #58712 — migration guide', type: 'path' },
            { text: '', type: 'blank' },
            { text: '  Applying findings to your codebase...', type: 'output' },
            { text: '  ✓ 3 files updated with new caching patterns', type: 'success' },
        ],
        context: { type: 'files', files: ['src/app/page.tsx', 'src/lib/cache.ts', 'next.config.ts'] },
    },

]


export const how_its_works_steps = [
    {
        num: '01',
        title: 'Install',
        description: 'One command. Works with any Node.js project. Free tier gets you started instantly.',
        code: '$ npm install -g nirex',
    },
    {
        num: '02',
        title: 'Index',
        description: 'Nirex builds a semantic map of your codebase. Every file, function, and dependency — understood by all agents.',
        code: '$ nirex init',
    },
    {
        num: '03',
        title: 'Command',
        description: 'Fix, generate, explain, search, or refactor. Multiple agents collaborate behind the scenes — you just see the result.',
        code: '$ nirex fix "your bug here"',
    },
];

export const testimonials = [
    {
        quote: 'The multi-agent setup is genius. One command triggers\nanalysis, web search, and patching — all at once.',
        handle: '@tobi_dev',
        role: 'Lead Engineer',
    },
    {
        quote: 'The explain command alone is worth it. Used it to\nonboard into a 200k LOC codebase in one afternoon.',
        handle: '@sarah_codes',
        role: 'Indie founder',
    },
    {
        quote: 'Agents that search the internet for latest API docs\nand apply fixes to my code? This is the future.',
        handle: '@mk_builds',
        role: 'Solo builder',
    },
];


export const plans: PricingPlans = [
    {
        name: 'Starter',
        price: '$0',
        period: '/month',
        description: 'For individual developers exploring AI-assisted coding.',
        features: [
            '50 commands per month',
            '2 AI agents (GPT-4o mini, Gemini Flash)',
            'Local codebase indexing',
            'Community Discord access',
        ],
        cta: 'Get Started Free',
        highlight: false,
    },
    {
        name: 'Pro',
        price: '$29',
        period: '/month',
        description: 'For professional developers who ship fast.',
        features: [
            'Unlimited commands',
            'All AI agents (GPT-4, Claude, Gemini Pro & more)',
            'Internet search — agents query docs, APIs & StackOverflow',
            'Multi-agent orchestration — agents collaborate on tasks',
            'Priority support',
        ],
        cta: 'Start Pro Trial',
        highlight: true,
    },
    {
        name: 'Team',
        price: '$49',
        period: '/user/month',
        description: 'For engineering teams that need shared context.',
        features: [
            'Everything in Pro',
            'Shared codebase context across team',
            'Team usage analytics',
            'SSO & admin controls',
            'Dedicated support channel',
        ],
        cta: 'Contact Sales',
        highlight: false,
    },
];

export const faqs: FAQs = [
    {
        q: 'Does my code leave my machine?',
        a: 'Your codebase stays local. Nirex sends only the minimal context needed to generate a response — function signatures, error messages, and file structure. Never raw source code.',
    },
    {
        q: 'Which languages are supported?',
        a: 'TypeScript, JavaScript, Python, Go, and Rust have first-class support. Other languages work but with reduced context accuracy. We\'re expanding coverage every week.',
    },
    {
        q: 'How is this different from Copilot?',
        a: 'Copilot autocompletes inside your editor. Nirex operates at project-level — it understands cross-file dependencies, can debug across modules, and generates complete features. Different tool, different layer.',
    },
    {
        q: 'Will it break my code?',
        a: 'Nirex always shows you the diff before applying. Nothing changes without your explicit approval. And it runs your test suite after every patch if tests exist.',
    },
    {
        q: 'What happens after beta?',
        a: 'We\'ll introduce a paid tier for teams and enterprise features. Individual developers will always have a generous free tier. We believe in earning your money.',
    },
    {
        q: 'Can I use it in a monorepo?',
        a: 'Yes. Nirex respects workspace boundaries and can scope commands to specific packages. Run nirex init at the root and it handles the rest.',
    },
];


export const features: Features = [
    {
        label: 'MULTI-AGENT AI',
        title: 'Multiple agents, one command',
        description: 'Nirex orchestrates specialized AI agents — CodeAnalyzer, ContextMapper, PatchWriter, and SearchAgent — to collaborate on every task. Each agent handles what it does best.',
        large: true,
        terminal: [
            { prompt: true, text: 'nirex fix "login redirect loop"' },
            { text: '  Orchestrating: Analyzer → Search → Patcher' },
            { text: '  Found › src/middleware/auth.ts:89', path: true },
            { text: '  ✓ Patch generated · 2 files changed', success: true },
        ],
    },
    {
        label: 'INTERNET SEARCH',
        title: 'Agents that search the web',
        description: 'When your codebase isn\'t enough, agents search documentation, APIs, Stack Overflow, and GitHub issues for the latest answers — then apply them to your code.',
        tall: true,
    },
    {
        label: 'TOP AI MODELS',
        title: 'GPT-4, Claude, Gemini & more',
        description: 'Nirex routes tasks to the best model for the job. Reasoning tasks go to Claude. Code generation to GPT-4. Fast lookups to Gemini. You get the best of every model.',
    },
    {
        label: 'CONTEXT ENGINE',
        title: 'Understands your entire codebase',
        description: 'Nirex builds a semantic map of your project. Every suggestion is grounded in YOUR code, not generic patterns.',
    },
    {
        label: 'CODE GENERATION',
        title: 'Generate, don\'t write',
        description: 'From middleware to migrations. Describe what you need; get production-ready code that matches your conventions.',
    },
];