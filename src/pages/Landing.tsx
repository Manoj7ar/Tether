import { Link } from "react-router-dom";
import { Lock, FileText, Shield, Eye, Zap, Clock, CheckCircle, ChevronDown, Activity, Smartphone, AlertTriangle, Github, ShieldOff, Ban, X, Check } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import TetherLogo from "@/components/layout/TetherLogo";
import ghibliHero from "@/assets/ghibli-canyon.jpg";
import ghibliDanger from "@/assets/ghibli-dark-forest.jpg";
import ghibliSteps from "@/assets/ghibli-steps.jpg";
import ghibliFortress from "@/assets/ghibli-fortress.jpg";
import ghibliForge from "@/assets/ghibli-forge.jpg";

const ParallaxBg = ({ src, alt = "", speed = 0.3, className = "" }: { src: string; alt?: string; speed?: number; className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [`-${speed * 100}px`, `${speed * 100}px`]);

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden">
      <motion.img
        src={src}
        alt={alt}
        style={{ y }}
        className={`absolute inset-0 w-full h-[120%] object-cover -top-[10%] ${className}`}
      />
    </div>
  );
};

const FadeInSection = ({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 40 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-80px" }}
    transition={{ duration: 0.7, ease: "easeOut", delay }}
    className={className}
  >
    {children}
  </motion.div>
);

const SlideFromLeft = ({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, x: -60 }}
    whileInView={{ opacity: 1, x: 0 }}
    viewport={{ once: true, margin: "-60px" }}
    transition={{ duration: 0.7, ease: "easeOut", delay }}
    className={className}
  >
    {children}
  </motion.div>
);

const SlideFromRight = ({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, x: 60 }}
    whileInView={{ opacity: 1, x: 0 }}
    viewport={{ once: true, margin: "-60px" }}
    transition={{ duration: 0.7, ease: "easeOut", delay }}
    className={className}
  >
    {children}
  </motion.div>
);

const ScaleIn = ({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    whileInView={{ opacity: 1, scale: 1 }}
    viewport={{ once: true, margin: "-60px" }}
    transition={{ duration: 0.6, ease: "easeOut", delay }}
    className={className}
  >
    {children}
  </motion.div>
);

const BlurIn = ({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, filter: "blur(10px)" }}
    whileInView={{ opacity: 1, filter: "blur(0px)" }}
    viewport={{ once: true, margin: "-60px" }}
    transition={{ duration: 0.8, ease: "easeOut", delay }}
    className={className}
  >
    {children}
  </motion.div>
);

const StaggerChild = ({ children, className = "", index = 0 }: { children: React.ReactNode; className?: string; index?: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-60px" }}
    transition={{ duration: 0.5, ease: "easeOut", delay: index * 0.12 }}
    className={className}
  >
    {children}
  </motion.div>
);

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.5rem)] sm:w-[calc(100%-2rem)] max-w-5xl backdrop-blur-xl bg-card/70 border border-border/50 rounded-2xl shadow-lg shadow-black/5">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <TetherLogo size="md" />
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#problem" className="hover:text-foreground transition-colors">The Problem</a>
            <a href="#how" className="hover:text-foreground transition-colors">How It Works</a>
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            
          </div>
          <Link to="/auth" className="border border-foreground/20 text-foreground px-5 py-2 rounded-full text-sm font-medium hover:bg-foreground/5 transition-colors">
            Sign up
          </Link>
        </div>
      </nav>

      {/* ════════════════════════════════════════════ */}
      {/* HERO — Full-bleed Ghibli with radial white fade */}
      {/* ════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 text-center overflow-hidden">
        {/* Full-bleed background image */}
        <div className="absolute inset-0">
          <img src={ghibliHero} alt="" className="w-full h-full object-cover" />
        </div>

        {/* Subtle dark overlay for contrast */}
        <div className="absolute inset-0 bg-foreground/20 pointer-events-none" />

        <motion.div
          className="relative z-10 mt-20 max-w-2xl w-full mx-auto backdrop-blur-md bg-card/30 border border-border/20 rounded-2xl px-8 py-12 sm:px-12 sm:py-16 shadow-2xl shadow-black/10"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-background/50 backdrop-blur-sm border border-border/30 text-sm text-foreground font-medium mb-8"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Shield className="h-3.5 w-3.5 text-primary" />
            <span><span className="font-semibold">New:</span> Zero-trust agent authorization, built on Auth0</span>
          </motion.div>

          <motion.h1
            className="font-display text-4xl sm:text-5xl md:text-6xl font-bold text-foreground leading-[1.1] mb-6 tracking-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            AI agents are powerful.
            <br />
            Unchecked ones are
            <br />
            dangerous.
          </motion.h1>

          <motion.p
            className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
          >
            Tether puts a leash on every AI action — scoped permissions, human-in-the-loop approval,
            and auto-expiring access. No blanket trust. No rogue moves. Just controlled autonomy.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6 }}
          >
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 bg-foreground text-background px-7 py-3.5 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity"
            >
              Get Started Free
              <span className="ml-1">→</span>
            </Link>
            <a
              href="#how"
              className="inline-flex items-center gap-2 border border-foreground/20 text-foreground px-7 py-3.5 rounded-lg font-medium text-sm hover:bg-foreground/5 transition-colors"
            >
              See How It Works
            </a>
          </motion.div>

          {/* Trust badges in glass pills */}
          <motion.div
            className="flex flex-wrap items-center justify-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.9 }}
          >
            {["Auth0", "OAuth + Token Vault", "Step-up re-auth", "Gemini", "React"].map((name) => (
              <span
                key={name}
                className="px-3 py-1 rounded-full text-xs font-medium bg-background/40 backdrop-blur-sm border border-border/30 text-foreground/70"
              >
                {name}
              </span>
            ))}
          </motion.div>
        </motion.div>

      </section>

      {/* ════════════════════════════════════════════ */}
      {/* THE PROBLEM — Split layout: content + art    */}
      {/* ════════════════════════════════════════════ */}
      <section id="problem" className="py-16 sm:py-24 px-4 sm:px-6 bg-background">
        <div className="max-w-6xl mx-auto">
          <BlurIn className="text-center mb-16">
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">The Problem</p>
            <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground mb-4">
              AI agents are powerful.
              <br />
              <span className="text-destructive">Unconstrained AI agents are dangerous.</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              Today, developers face an impossible choice when giving agents real-world capabilities.
            </p>
          </BlurIn>

          <div className="grid md:grid-cols-[1fr_320px] gap-10 items-start mb-16">
            {/* Cards on the left */}
            <div className="space-y-6">
              <SlideFromLeft delay={0}>
                <div className="card-tether p-6 sm:p-8 risk-border-high">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-full border border-foreground/10 flex items-center justify-center">
                      <ShieldOff className="h-5 w-5 text-foreground" />
                    </div>
                    <h3 className="font-display text-lg font-semibold text-foreground">Option A: Full Access</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Hand the agent long-lived OAuth tokens with broad scopes.
                  </p>
                  <ul className="space-y-2 text-sm">
                    {[
                      "Agent has permanent access to all your data",
                      "Compromised agent = compromised accounts",
                      "No audit trail of what was accessed",
                      "No ability to scope or time-limit access",
                      "Tokens can be exfiltrated and reused",
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-muted-foreground">
                        <X className="h-3.5 w-3.5 mt-0.5 shrink-0 text-foreground" /> {item}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 px-3 py-2 rounded-lg bg-muted text-xs text-muted-foreground font-medium">
                    <AlertTriangle className="h-3.5 w-3.5 inline mr-1 text-foreground" /> This is how most agent frameworks work today.
                  </div>
                </div>
              </SlideFromLeft>

              <SlideFromLeft delay={0.15}>
                <div className="card-tether p-6 sm:p-8 risk-border-medium">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-full border border-foreground/10 flex items-center justify-center">
                      <Ban className="h-5 w-5 text-foreground" />
                    </div>
                    <h3 className="font-display text-lg font-semibold text-foreground">Option B: No Access</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Don't connect the agent to real APIs at all.
                  </p>
                  <ul className="space-y-2 text-sm">
                    {[
                      "Agent can't actually do anything useful",
                      "Human must manually execute every action",
                      "Defeats the purpose of AI agents",
                      "No productivity gain from automation",
                      "Safe, but completely useless",
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-muted-foreground">
                        <X className="h-3.5 w-3.5 mt-0.5 shrink-0 text-foreground" /> {item}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 px-3 py-2 rounded-lg bg-muted text-xs text-muted-foreground font-medium">
                    <AlertTriangle className="h-3.5 w-3.5 inline mr-1 text-foreground" /> Safe, but your agent is effectively decorative.
                  </div>
                </div>
              </SlideFromLeft>
            </div>

            {/* Ghibli forest illustration on the right */}
            <SlideFromRight delay={0.3} className="hidden md:block sticky top-28">
              <div className="rounded-2xl overflow-hidden shadow-xl border border-border/30">
                <img src={ghibliDanger} alt="A mysterious foggy forest path" className="w-full h-auto object-cover" />
              </div>
              <p className="text-xs text-muted-foreground/60 text-center mt-3 italic">The path without a tether</p>
            </SlideFromRight>
          </div>

          {/* Tether solution */}
          <ScaleIn delay={0.2}>
            <div className="card-tether p-6 sm:p-8 md:p-10 risk-border-low text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full border border-foreground/10 flex items-center justify-center">
                  <Check className="h-5 w-5 text-foreground" />
                </div>
                <h3 className="font-display text-xl font-semibold text-foreground">Tether: Option C</h3>
              </div>
              <p className="text-muted-foreground max-w-xl mx-auto mb-6">
                Grant your agent exactly the access it needs, for exactly the task at hand,
                with full audit trail, human approval, and automatic expiry.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { icon: Clock, label: "Time-limited" },
                  { icon: FileText, label: "Task-scoped" },
                  { icon: Smartphone, label: "Human-approved" },
                  { icon: Eye, label: "Fully audited" },
                ].map((f) => (
                  <div key={f.label} className="flex flex-col items-center gap-2 py-3">
                    <f.icon className="h-5 w-5 text-foreground" />
                    <span className="text-xs font-medium text-foreground">{f.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </ScaleIn>
        </div>
      </section>

      {/* ════════════════════════════════════════════ */}
      {/* HOW IT WORKS — Split: steps left, tower right */}
      {/* ════════════════════════════════════════════ */}
      <section id="how" className="py-16 sm:py-24 px-4 sm:px-6 bg-card border-y border-border">
        <div className="max-w-6xl mx-auto">
          <BlurIn className="text-center mb-16">
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">How It Works</p>
            <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground mb-4">
              Six steps. Zero trust assumptions.
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Every mission follows an auditable, human-in-the-loop authorization flow.
            </p>
          </BlurIn>

          <div className="grid md:grid-cols-[1fr_300px] gap-12 items-start">
            <div className="space-y-0">
              {[
                {
                  step: "01",
                  title: "Describe the Task",
                  desc: "Tell Tether what your agent needs to do in plain English. \"Triage my open GitHub issues, check my calendar, and email a summary to the team.\"",
                  detail: "Natural language → structured intent",
                  color: "text-primary",
                },
                {
                  step: "02",
                  title: "AI Generates a Mission Manifest",
                  desc: "Gemini analyzes your request and produces a precise authorization contract: what APIs, what scopes, what the agent WILL and WILL NOT do, and for how long.",
                  detail: "Conservative by design. Minimum permissions only.",
                  color: "text-primary",
                },
                {
                  step: "03",
                  title: "A Second AI Audits the First",
                  desc: "An independent AI model with a skeptical auditor persona reviews the manifest. It flags scope creep, unnecessary permissions, or mismatches between the task and the requested access.",
                  detail: "AI auditing AI. Trust-but-verify layer.",
                  color: "text-accent",
                },
                {
                  step: "04",
                  title: "You Approve on Your Phone",
                  desc: "Open the approval screen on your phone (or desktop). The manifest updates live over a secure channel. Review what the agent will do, complete step-up re-auth when the mission is high-risk, then tap Approve or Reject.",
                  detail: "No approval = no access. Period.",
                  color: "text-primary",
                },
                {
                  step: "05",
                  title: "Agent Acts Within the Tether",
                  desc: "Tether's backend executes API calls on behalf of the agent using OAuth tokens obtained through Auth0; credentials stay server-side and encrypted—never in the agent or browser. Every action is logged.",
                  detail: "Agent never holds OAuth tokens",
                  color: "text-primary",
                },
                {
                  step: "06",
                  title: "Access Dies Automatically",
                  desc: "When the mission timer expires, all permissions are revoked. The agent returns to zero standing access. The full execution history lives permanently in the Capability Ledger.",
                  detail: "Ephemeral access. Nothing persists.",
                  color: "text-primary",
                },
              ].map((s, i) => (
                <StaggerChild key={s.step} index={i} className="flex gap-4 sm:gap-6 md:gap-8 items-start group">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center font-mono text-sm font-bold text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                      {s.step}
                    </div>
                    {i < 5 && <div className="w-px h-16 bg-border" />}
                  </div>
                  <div className="pb-8">
                    <h3 className="font-display text-lg sm:text-xl font-semibold text-foreground mb-2">{s.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-2 max-w-lg">{s.desc}</p>
                    <span className={`text-xs font-mono font-medium ${s.color}`}>{s.detail}</span>
                  </div>
                </StaggerChild>
              ))}
            </div>

            {/* Ghibli tower illustration */}
            <SlideFromRight delay={0.3} className="hidden md:block sticky top-28">
              <div className="rounded-2xl overflow-hidden shadow-xl border border-border/30">
                <img src={ghibliSteps} alt="A figure climbing stone steps through the clouds" className="w-full h-auto object-cover" />
              </div>
              <p className="text-xs text-muted-foreground/60 text-center mt-3 italic">Climbing toward trust, one step at a time</p>
            </SlideFromRight>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════ */}
      {/* FEATURES — Workshop art + clean grid          */}
      {/* ════════════════════════════════════════════ */}
      <section id="features" className="py-16 sm:py-24 px-4 sm:px-6 bg-background">
        <div className="max-w-6xl mx-auto">
          {/* Section header with workshop image */}
          <div className="grid md:grid-cols-[300px_1fr] gap-10 items-center mb-16">
            <SlideFromLeft className="hidden md:block">
              <div className="rounded-2xl overflow-hidden shadow-xl border border-border/30">
                <img src={ghibliForge} alt="Craftsman forging a golden permission key" className="w-full h-auto object-cover" />
              </div>
              <p className="text-xs text-muted-foreground/60 text-center mt-3 italic">Forging permissions with care and precision</p>
            </SlideFromLeft>

            <SlideFromRight delay={0.1}>
              <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">Core Features</p>
              <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground mb-4">
                Built for zero-trust agent authorization
              </h2>
              <p className="text-muted-foreground text-lg">
                Every component is designed around a single principle: agents should never have more access than they need, and never for longer than necessary.
              </p>
            </SlideFromRight>
          </div>

          {/* Feature grid */}
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-16">
            {[
              {
                icon: FileText,
                title: "Mission Manifests",
                desc: "Every task becomes a formal, structured contract. What the agent will do, what it won't, what APIs it needs, and for how long.",
              },
              {
                icon: Shield,
                title: "Dual AI Verification",
                desc: "The first AI generates the manifest. The second AI, with a skeptical auditor persona, independently verifies it. Scope creep is caught before you ever see it.",
              },
              {
                icon: Smartphone,
                title: "Mobile & desktop approval",
                desc: "Approve or reject missions from any device with a clear summary of scopes and risk. High-impact missions require an extra provider sign-in (step-up) before approval.",
              },
              {
                icon: Lock,
                title: "Auth0 OAuth + Token Vault",
                desc: "Connect accounts through Auth0 (Token Vault path). Refresh and access material are handled for API execution on the server only—the agent never sees raw tokens.",
              },
              {
                icon: Activity,
                title: "Capability Ledger",
                desc: "Every action, allowed or blocked, is immutably logged with full context. Exportable as JSON. Complete audit trail.",
              },
              {
                icon: Zap,
                title: "Policy Engine",
                desc: "Organization-level rules enforced on top of mission scope. \"Never email outside company.com\" applies to every mission.",
              },
            ].map((f, i) => (
              <StaggerChild
                key={f.title}
                index={i}
                className="card-tether p-6 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </StaggerChild>
            ))}
          </div>

          {/* Manifest preview */}
          <ScaleIn>
            <div className="card-tether overflow-hidden risk-border-medium">
              <div className="px-4 sm:px-6 py-3 border-b border-border flex items-center justify-between">
                <span className="font-mono text-sm text-primary font-semibold">TETHER #024</span>
                <span className="text-xs px-3 py-1 rounded-full bg-accent/10 text-accent font-semibold uppercase">Medium Risk</span>
              </div>
              <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
                <div className="p-4 sm:p-6 space-y-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Will Do</p>
                    <ul className="space-y-1.5 text-sm">
                      <li className="flex gap-2"><span className="text-primary">✓</span> Read open issues in acme/backend</li>
                      <li className="flex gap-2"><span className="text-primary">✓</span> Read calendar events for 7 days</li>
                      <li className="flex gap-2"><span className="text-primary">✓</span> Send 1 email to team@company.com</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Will Not Do</p>
                    <ul className="space-y-1.5 text-sm">
                      <li className="flex gap-2"><span className="text-destructive">✗</span> Close, edit, or delete any issues</li>
                      <li className="flex gap-2"><span className="text-destructive">✗</span> Email outside @company.com</li>
                      <li className="flex gap-2"><span className="text-destructive">✗</span> Access repos other than acme/backend</li>
                      <li className="flex gap-2"><span className="text-destructive">✗</span> Create or delete calendar events</li>
                    </ul>
                  </div>
                </div>
                <div className="p-4 sm:p-6 space-y-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Permissions</p>
                    <div className="space-y-2">
                      {[
                        { provider: "GitHub", scope: "issues:read", type: "READ" },
                        { provider: "Gmail", scope: "send", type: "WRITE" },
                        { provider: "Calendar", scope: "events:read", type: "READ" },
                      ].map((p) => (
                        <div key={p.scope} className="flex items-center justify-between text-sm">
                          <span className="font-mono text-xs">{p.provider} → {p.scope}</span>
                          <span className={`text-xs font-semibold ${p.type.includes("WRITE") ? "text-accent" : "text-primary"}`}>{p.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-border pt-4">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Intent Verification</p>
                    <div className="flex items-start gap-2 text-primary">
                      <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold">AI Audit: PASSED</p>
                        <p className="text-xs text-muted-foreground mt-0.5">"Permissions are consistent with the stated objective. No scope creep detected."</p>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-border pt-4">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Expires</p>
                    <p className="font-mono text-sm">30 minutes from approval</p>
                  </div>
                </div>
              </div>
            </div>
          </ScaleIn>
        </div>
      </section>


      {/* ════════════════════════════════════════════ */}
      {/* FOOTER — Floating glass card                   */}
      {/* ════════════════════════════════════════════ */}
      <div className="px-3 sm:px-6 pb-6 pt-8">
        <footer className="max-w-5xl mx-auto backdrop-blur-xl bg-card/70 border border-border/50 rounded-2xl shadow-lg shadow-black/5">
          <div className="px-6 sm:px-10 py-10 sm:py-12 grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10">
            <div className="col-span-2 md:col-span-1">
              <TetherLogo size="md" />
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                Mission-scoped authorization for AI agents. Zero standing permissions. Full audit trail.
              </p>
              <p className="text-xs text-muted-foreground mt-4 italic">
                "The agent treats your credentials as inaccessible. That is by design."
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-foreground mb-4">Product</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><a href="#how" className="hover:text-foreground transition-colors">How It Works</a></li>
                <li><a href="#features" className="hover:text-foreground transition-colors">Core Features</a></li>
                <li><Link to="/auth" className="hover:text-foreground transition-colors">Get Started</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-foreground mb-4">Technology</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-foreground/40" /> Auth0 OAuth / Token Vault
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-foreground/40" /> Step-up re-authentication
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-foreground/40" /> Google Gemini
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-foreground/40" /> Supabase Realtime
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-foreground/40" /> React + TypeScript
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-foreground mb-4">Security</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Lock className="h-3.5 w-3.5 mt-0.5 text-foreground shrink-0" />
                  <span>OAuth tokens never reach the agent</span>
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="h-3.5 w-3.5 mt-0.5 text-foreground shrink-0" />
                  <span>Dual AI intent verification</span>
                </li>
                <li className="flex items-start gap-2">
                  <Clock className="h-3.5 w-3.5 mt-0.5 text-foreground shrink-0" />
                  <span>Automatic access expiry</span>
                </li>
                <li className="flex items-start gap-2">
                  <Eye className="h-3.5 w-3.5 mt-0.5 text-foreground shrink-0" />
                  <span>Immutable audit ledger</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mx-6 sm:mx-10 border-t border-border/30" />

          <div className="px-6 sm:px-10 py-5 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Tether. Built for the Auth0 "Authorized to Act" Hackathon.
            </p>
            <div className="flex items-center gap-6 text-xs text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors inline-flex items-center gap-1.5">
                <Github className="h-3.5 w-3.5" />
                GitHub
              </a>
              <a href="https://auth0.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Auth0</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Landing;
