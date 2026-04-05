export default function Solution() {
    return (
        <section className="nirex-section">
            <div className="nirex-container">
                <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    {/* Before */}
                    <div className="transform md:-rotate-1" data-reveal="fade-right">
                        <div className="font-mono text-[11px] text-nirex-text-muted mb-3 tracking-wider">// before</div>
                        <div className="terminal opacity-75">
                            <div className="terminal-chrome">
                                <div className="terminal-dots">
                                    <span className="terminal-dot" style={{ background: '#ff5f57' }} />
                                    <span className="terminal-dot" style={{ background: '#ffbd2e' }} />
                                    <span className="terminal-dot" style={{ background: '#28c840' }} />
                                </div>
                            </div>
                            <div className="terminal-body text-sm">
                                <div><span className="t-comment">// copy function from editor</span></div>
                                <div><span className="t-comment">// paste into ChatGPT</span></div>
                                <div><span className="t-comment">// explain context manually</span></div>
                                <div><span className="t-comment">// wait for response</span></div>
                                <div><span className="t-comment">// copy answer back</span></div>
                                <div><span className="t-comment">// hope it works</span></div>
                                <div className="mt-2"><span className="t-error">// 6 context switches. Zero guarantee.</span></div>
                            </div>
                        </div>
                    </div>

                    {/* After */}
                    <div className="transform md:rotate-[0.5deg]" data-reveal="fade-left">
                        <div className="font-mono text-[11px] text-nirex-accent-hi mb-3 tracking-wider">// with nirex</div>
                        <div className="terminal">
                            <div className="terminal-chrome">
                                <div className="terminal-dots">
                                    <span className="terminal-dot" style={{ background: '#ff5f57' }} />
                                    <span className="terminal-dot" style={{ background: '#ffbd2e' }} />
                                    <span className="terminal-dot" style={{ background: '#28c840' }} />
                                </div>
                            </div>
                            <div className="terminal-body text-sm">
                                <div><span className="t-prompt">$ </span><span className="t-cmd">nirex fix</span> <span className="t-string">"auth token expires too early"</span></div>
                                <div className="mt-2"><span className="t-output">  Scanning 847 files...</span></div>
                                <div><span className="t-label">  Found</span> <span className="t-path">src/auth/tokenService.ts</span><span className="t-linenum">:142</span></div>
                                <div><span className="t-remove">  - const expiresAt = Date.now() + TOKEN_TTL</span></div>
                                <div><span className="t-add">  + const expiresAt = () =&gt; Date.now() + TOKEN_TTL</span></div>
                                <div className="mt-2"><span className="t-success">  ✓ Patch applied. Tests passing.</span></div>
                                <div className="mt-2"><span className="t-comment">// 1 command. Zero context switches.</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
