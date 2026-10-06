import { type FormEvent, type ReactNode, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';
import {
  setAuthTokenGetter, useAddProfileSkill, useArchiveJob, useCreateJob, useDeleteJob,
  useGetCandidateDashboard, useGetCurrentUser, useGetEmployerDashboard, useGetJob, useGetMatch,
  useGetMatchExplanation, useGetProfile, useGetSkillGaps, useHealthCheck, useListJobs,
  useListMatches, useListProfileSkills, useListSavedJobs, useListSkills, useLogin,
  useLogout, useRegister, useRemoveProfileSkill, useSaveJob, useUnsaveJob,
  useUpdateJob, useUpdateProfile, useUpdateProfileSkill,
  setBaseUrl,
  getGetCurrentUserQueryKey, getGetProfileQueryKey, getGetCandidateDashboardQueryKey,
  getGetEmployerDashboardQueryKey, getListProfileSkillsQueryKey,
  getListJobsQueryKey, getListMatchesQueryKey, getListSavedJobsQueryKey, getGetJobQueryKey,
  getGetMatchQueryKey, getHealthCheckQueryKey,
} from '@workspace/api-client-react';
import type { CandidateSkill, Job, JobInput, Proficiency, ProfileInput, Role, WorkMode } from '@workspace/api-client-react';
import {
  Activity, ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Bookmark, BriefcaseBusiness,
  Building2, Check, CheckCircle2, CircleHelp, Compass,
  Filter, Gauge, Layers3, LogOut, MapPin, Menu, Plus,
  Search, Settings2, ShieldCheck, Sparkles, Target, Trash2, TrendingUp, UserRound,
  Zap,
} from 'lucide-react';
import NotFound from '@/pages/not-found';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

const queryClient = new QueryClient();
const TOKEN_KEY = 'skillmatch_token';
if (typeof window !== 'undefined') setAuthTokenGetter(() => window.sessionStorage.getItem(TOKEN_KEY));
setBaseUrl(import.meta.env.VITE_API_URL || null);

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(' ');
const money = (n?: number) => (n ? `$${n.toLocaleString()}` : '');
const range = (a?: number, b?: number) => a || b ? `${money(a)}${a && b ? ' – ' : ''}${money(b)}` : 'Not listed';
const readable = (s?: string) => s ? s.replaceAll('-', ' ').replace(/\b\w/g, c => c.toUpperCase()) : '';
const userError = (error: unknown) => {
  const e = error as { message?: string; status?: number; data?: { error?: { message?: string } } };
  if (e?.status === 401) return 'Sign in to see your personal workspace.';
  return e?.data?.error?.message || e?.message || 'The service could not complete this request.';
};

function Button({ children, onClick, type = 'button', variant = 'primary', disabled, className = '' }: {
  children: ReactNode; onClick?: () => void; type?: 'button'|'submit'; variant?: 'primary'|'quiet'|'outline'|'danger';
  disabled?: boolean; className?: string;
}) {
  const style = {
    primary: 'bg-violet-500 text-white hover:bg-violet-400 shadow-[0_8px_24px_rgba(116,96,232,.18)]',
    quiet: 'bg-transparent text-slate-300 hover:bg-white/[.06] hover:text-white',
    outline: 'border border-slate-700/80 bg-white/[.025] text-slate-200 hover:bg-white/[.07]',
    danger: 'border border-rose-400/20 bg-rose-400/10 text-rose-200 hover:bg-rose-400/15',
  }[variant];
  return <button type={type} onClick={onClick} disabled={disabled} className={cx('inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50', style, className)}>{children}</button>;
}

function Field({ label, children, hint }: {label: string; children: ReactNode; hint?: string}) {
  return <label className="grid gap-2 text-sm font-medium text-slate-300">{label}{children}{hint && <span className="text-xs font-normal text-slate-500">{hint}</span>}</label>;
}
const inputClass = 'w-full rounded-xl border border-slate-700/80 bg-[#0e1424] px-3.5 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-violet-400/70 focus:ring-2 focus:ring-violet-400/10';
function TextInput(props: InputHTMLAttributes<HTMLInputElement>) { return <input {...props} className={cx(inputClass, props.className)} />; }
function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea {...props} className={cx(inputClass, 'min-h-28 resize-y', props.className)} />; }
function Select(props: SelectHTMLAttributes<HTMLSelectElement>) { return <select {...props} className={cx(inputClass, props.className)} />; }

function Panel({ children, className = '' }: {children: ReactNode; className?: string}) {
  return <section className={cx('surface rounded-2xl p-5 sm:p-6', className)}>{children}</section>;
}
function PageTitle({ eyebrow, title, note, action }: {eyebrow?: string; title: string; note?: string; action?: ReactNode}) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div>{eyebrow && <div className="mb-2 text-[11px] font-bold uppercase tracking-[.2em] text-violet-300">{eyebrow}</div>}<h1 className="font-serif text-3xl font-bold tracking-[-.04em] text-slate-50 sm:text-[2.4rem]">{title}</h1>{note && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{note}</p>}</div>{action}</div>;
}
function Loading({ label = 'Loading workspace' }: {label?: string}) {
  return <div className="grid gap-4" aria-label={label}><div className="h-8 w-52 animate-pulse rounded-lg bg-white/[.07]" /><div className="grid gap-4 md:grid-cols-2"><div className="h-40 animate-pulse rounded-2xl bg-white/[.05]" /><div className="h-40 animate-pulse rounded-2xl bg-white/[.05]" /></div><div className="h-56 animate-pulse rounded-2xl bg-white/[.05]" /></div>;
}
function StateMessage({ title, body, action, tone = 'normal' }: {title: string; body: string; action?: ReactNode; tone?: 'normal'|'error'}) {
  return <Panel className="flex min-h-52 flex-col items-start justify-center"><div className={cx('mb-4 grid h-10 w-10 place-items-center rounded-xl', tone === 'error' ? 'bg-rose-400/10 text-rose-300' : 'bg-violet-400/10 text-violet-300')}><CircleHelp size={19}/></div><h3 className="text-lg font-semibold text-slate-100">{title}</h3><p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">{body}</p>{action && <div className="mt-5">{action}</div>}</Panel>;
}
function Pill({ children, color = 'violet' }: {children: ReactNode; color?: 'violet'|'green'|'neutral'|'amber'}) {
  const c = { violet: 'border-violet-300/15 bg-violet-300/[.08] text-violet-200', green: 'border-emerald-300/15 bg-emerald-300/[.08] text-emerald-200', neutral: 'border-slate-600/30 bg-slate-400/[.06] text-slate-300', amber: 'border-amber-300/15 bg-amber-300/[.08] text-amber-200' }[color];
  return <span className={cx('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold', c)}>{children}</span>;
}
function ApiStatus() {
  const q = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), retry: false, refetchOnWindowFocus: false } });
  const up = q.data?.status === 'ok' || q.data?.status === 'healthy';
  return <span className="inline-flex items-center gap-2 text-[11px] text-slate-500"><span className={cx('h-1.5 w-1.5 rounded-full', up ? 'bg-emerald-400' : q.isError ? 'bg-amber-400' : 'bg-slate-500')} />{q.isLoading ? 'Checking service' : up ? 'Service online' : q.isError ? 'Service unavailable' : 'Service status unknown'}</span>;
}

function AuthGate({ children, role }: {children: ReactNode; role?: Role | Role[]}) {
  const hasToken = typeof window !== 'undefined' && Boolean(window.sessionStorage.getItem(TOKEN_KEY));
  const userQ = useGetCurrentUser({query:{queryKey:getGetCurrentUserQueryKey(),enabled:hasToken,retry:false}});
  if (!hasToken) return <StateMessage title="Sign in to see your workspace" body="Your profile, matches, and saved jobs are available after you sign in." action={<Link href="/login" className="inline-flex"><Button>Sign in</Button></Link>} />;
  if (userQ.isLoading) return <Loading label="Checking account" />;
  if (userQ.isError || !userQ.data?.success) return <StateMessage title="Your workspace starts with sign in" body={userError(userQ.error)} action={<Link href="/login" className="inline-flex"><Button>Sign in</Button></Link>} tone="error" />;
  if (role && !(Array.isArray(role) ? role : [role]).includes(userQ.data.data.role)) return <StateMessage title="This view is for a different account" body="Your account does not have permission to open this workspace. Switch accounts to continue." action={<Link href={userQ.data.data.role === 'admin' ? '/admin' : userQ.data.data.role === 'employer' ? '/employer' : '/dashboard'}><Button variant="outline">Go to your workspace</Button></Link>} />;
  return <>{children}</>;
}

type NavItem = {label: string; href: string; icon: typeof Compass};
const candidateNav: NavItem[] = [
  {label:'Overview',href:'/dashboard',icon:Gauge},{label:'Find jobs',href:'/jobs',icon:Compass},
  {label:'Your matches',href:'/matches',icon:Target},{label:'Saved jobs',href:'/saved-jobs',icon:Bookmark},
  {label:'Skill gaps',href:'/skill-gaps',icon:TrendingUp},{label:'My profile',href:'/profile',icon:UserRound},
  {label:'Skills',href:'/skills',icon:Layers3},
];
const employerNav: NavItem[] = [
  {label:'Overview',href:'/employer',icon:Gauge},{label:'Your listings',href:'/employer/jobs',icon:BriefcaseBusiness},
];
const adminNav: NavItem[] = [
  {label:'Platform overview',href:'/admin',icon:Gauge},
];
function Shell({ children }: {children: ReactNode}) {
  const [path, setPath] = useLocation();
  const hasToken = typeof window !== 'undefined' && Boolean(window.sessionStorage.getItem(TOKEN_KEY));
  const userQ = useGetCurrentUser({query:{queryKey:getGetCurrentUserQueryKey(),enabled:hasToken,retry:false}});
  const user = userQ.data?.success ? userQ.data.data : null;
  const logout = useLogout();
  const qc = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = user?.role === 'admin' ? adminNav : user?.role === 'employer' ? employerNav : candidateNav;
  const signOut = () => logout.mutate(undefined, { onSettled: () => {
    window.sessionStorage.removeItem(TOKEN_KEY); qc.setQueryData(getGetCurrentUserQueryKey(), undefined);
    qc.clear(); setPath('/');
  }});
  const active = (href: string) => path === href || (href !== '/' && path.startsWith(`${href}/`));
  return <div className="min-h-[100dvh] bg-[#0b1020] text-slate-100">
    {user ? <aside className="fixed inset-y-0 left-0 z-30 hidden w-[250px] flex-col border-r border-slate-800/80 bg-[#090e1b] px-4 py-6 lg:flex">
      <Link href="/" className="mb-9 flex items-center gap-3 px-2"><BrandMark/><span className="font-serif text-[17px] font-extrabold tracking-[-.04em] text-slate-100">skillmatch<span className="text-violet-300">.</span></span></Link>
      <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-slate-600">{user.role === 'admin' ? 'Admin workspace' : user.role === 'employer' ? 'Employer workspace' : 'Candidate workspace'}</div>
      <nav className="grid gap-1">{nav.map(item => <Link key={item.href} href={item.href} className={cx('group flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-medium transition-colors', active(item.href) ? 'bg-violet-400/[.12] text-violet-100' : 'text-slate-400 hover:bg-white/[.04] hover:text-slate-100')}><item.icon size={17} strokeWidth={1.8}/>{item.label}{active(item.href) && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-violet-300"/>}</Link>)}</nav>
      <div className="mt-auto">
        <Panel className="mb-4 p-4"><div className="flex items-center gap-2 text-xs font-semibold text-slate-200"><ShieldCheck size={15} className="text-emerald-300"/>Skills over keywords</div><p className="mt-2 text-[11px] leading-5 text-slate-500">Your fit is calculated from your profile and each listing's stated requirements.</p></Panel>
        <div className="flex items-center gap-3 border-t border-slate-800/80 px-2 pt-4"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-violet-300/20 bg-violet-300/10 text-xs font-bold text-violet-200">{user.name.split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase()}</div><div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold text-slate-200">{user.name}</div><div className="truncate text-[10px] text-slate-500">{user.email}</div></div><button data-testid="button-logout" onClick={signOut} aria-label="Sign out" className="rounded-lg p-2 text-slate-500 hover:bg-white/[.05] hover:text-white"><LogOut size={16}/></button></div>
      </div>
    </aside> : null}
    <header className={cx('sticky top-0 z-20 border-b border-slate-800/70 bg-[#0b1020]/90 px-4 py-3 backdrop-blur-xl sm:px-7', user ? 'lg:ml-[250px]' : false)}>
      <div className="mx-auto flex max-w-[1440px] items-center justify-between">
        <div className="flex items-center gap-3">
          {user && <button data-testid="button-mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} className="rounded-lg p-2 text-slate-300 lg:hidden"><Menu size={19}/></button>}
          <Link href="/" className={cx('flex items-center gap-2.5', user ? 'lg:hidden' : false)}><BrandMark/><span className="font-serif text-base font-extrabold tracking-[-.04em] text-slate-100">skillmatch<span className="text-violet-300">.</span></span></Link>
          {!user && <div className="hidden gap-7 pl-8 text-xs text-slate-400 sm:flex"><a href="#how" className="hover:text-white">How it works</a><a href="#for-employers" className="hover:text-white">For employers</a></div>}
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:block"><ApiStatus/></div>
          {user ? <div className="hidden items-center gap-2 sm:flex"><Pill color={user.role === 'employer' ? 'amber' : 'green'}>{readable(user.role)}</Pill>{(user.role === 'employer' || user.role === 'admin') && <Link href="/employer/jobs/new"><Button><Plus size={15}/>Post a role</Button></Link>}</div> : <><Link href="/login" className="px-2 text-sm font-semibold text-slate-300 hover:text-white">Sign in</Link><Link href="/register"><Button className="px-3.5 py-2.5">Create account</Button></Link></>}
        </div>
      </div>
      {mobileOpen && user && <div className="mt-3 grid gap-1 border-t border-slate-800 pt-3 lg:hidden">{nav.map(it => <Link key={it.href} href={it.href} onClick={() => setMobileOpen(false)} className={cx('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm', active(it.href) ? 'bg-violet-400/10 text-violet-100' : 'text-slate-400')}><it.icon size={16}/>{it.label}</Link>)}</div>}
    </header>
    <main className={cx('min-h-[calc(100dvh-57px)] px-4 py-7 sm:px-7 sm:py-9', user ? 'lg:ml-[250px]' : false)}>
      <div className="mx-auto max-w-[1440px]">{children}</div>
      <footer className="mx-auto mt-14 flex max-w-[1440px] flex-col gap-2 border-t border-slate-800/60 pt-5 text-[11px] text-slate-600 sm:flex-row sm:items-center sm:justify-between"><span>SkillMatch AI · Work, measured by what you can do.</span><ApiStatus/></footer>
    </main>
  </div>;
}
function BrandMark() {
  return <div className="relative grid h-8 w-8 place-items-center rounded-[10px] border border-violet-200/20 bg-gradient-to-br from-violet-400/30 to-indigo-500/10"><span className="h-3 w-3 rotate-45 rounded-[3px] border-2 border-violet-200"/><span className="absolute bottom-[6px] right-[6px] h-1 w-1 rounded-full bg-emerald-300"/></div>;
}

function JobCard({ job, score, saved, onSave, compact = false }: {job: Job; score?: number; saved?: boolean; onSave?: () => void; compact?: boolean}) {
  return <Panel className="group p-5 transition-all duration-200 hover:border-violet-300/25 hover:bg-[#1a2035]">
    <div className="flex items-start justify-between gap-3">
      <Link href={`/jobs/${job.id}`} className="min-w-0 flex-1"><div className="mb-2 flex flex-wrap items-center gap-2"><Pill color="neutral">{job.category}</Pill><Pill color={job.workMode === 'remote' ? 'green' : 'neutral'}>{readable(job.workMode)}</Pill></div><h3 className="font-serif text-lg font-bold tracking-tight text-slate-100 group-hover:text-violet-100">{job.title}</h3><div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400"><span className="inline-flex items-center gap-1.5"><Building2 size={13}/>{job.company}</span><span className="inline-flex items-center gap-1.5"><MapPin size={13}/>{job.location}</span></div></Link>
      {onSave && <button data-testid={`button-save-${job.id}`} onClick={onSave} aria-label={saved ? 'Remove saved job' : 'Save job'} className={cx('rounded-lg border p-2.5 transition-colors', saved ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : 'border-slate-700 text-slate-400 hover:text-white')}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'}/></button>}
    </div>
    <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t border-slate-800/70 pt-4">
      <div><div className="text-sm font-semibold text-slate-200">{range(job.salaryMin, job.salaryMax)}</div><div className="mt-1 text-[11px] text-slate-500">{job.experienceMin}–{job.experienceMax} years experience</div></div>
      {score !== undefined && <div className="text-right"><div className="font-mono text-2xl font-bold tracking-tight text-emerald-300">{score}<span className="text-base">%</span></div><div className="text-[10px] text-slate-500">skill alignment</div></div>}
    </div>
    {!compact && <div className="mt-4 flex flex-wrap gap-1.5">{job.requiredSkills.slice(0,4).map(s => <span key={s.id} className="rounded-md bg-white/[.04] px-2 py-1 text-[10px] text-slate-400">{s.name}</span>)}</div>}
  </Panel>;
}

function Landing() {
  return <div className="enter">
    <section className="soft-grid relative overflow-hidden rounded-[28px] border border-slate-800/70 bg-[#0d1427] px-6 py-14 sm:px-12 sm:py-20 lg:px-16 lg:py-24">
      <div className="pointer-events-none absolute -right-10 top-10 h-72 w-72 rounded-full bg-violet-500/10 blur-[90px]"/><div className="pointer-events-none absolute bottom-0 right-[22%] h-56 w-56 rounded-full bg-emerald-400/[.08] blur-[80px]"/>
      <div className="relative grid items-center gap-12 lg:grid-cols-[1.12fr_.88fr]">
        <div><div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-300/[.07] px-3 py-1.5 text-[11px] font-semibold text-violet-200"><Sparkles size={13}/> A more human way to get hired</div>
          <h1 className="max-w-[760px] font-serif text-[2.8rem] font-extrabold leading-[1.04] tracking-[-.055em] text-slate-50 sm:text-6xl lg:text-[4.35rem]">Your skills should<br/><span className="bg-gradient-to-r from-violet-300 via-indigo-200 to-emerald-200 bg-clip-text text-transparent">speak first.</span></h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-400 sm:text-lg">Find the right job based on your skills — not just your job title. See how your experience lines up with the work that matters.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/register"><Button className="h-12 px-5">Build your skills profile <ArrowRight size={16}/></Button></Link><Link href="/jobs"><Button variant="outline" className="h-12 px-5">Explore open roles</Button></Link></div>
          <div className="mt-7 flex items-center gap-2 text-xs text-slate-500"><ShieldCheck size={14} className="text-emerald-300"/>Transparent fit. No invented scores. You stay in control.</div>
        </div>
        <div className="relative mx-auto w-full max-w-[470px]">
          <div className="absolute -inset-5 rounded-[32px] bg-gradient-to-br from-violet-500/10 via-transparent to-emerald-400/[.07] blur-2xl"/>
          <div className="surface relative rounded-3xl p-5 shadow-2xl shadow-black/20 sm:p-6">
            <div className="flex items-start justify-between"><div><div className="text-[10px] font-bold uppercase tracking-[.19em] text-slate-500">Match clarity</div><h2 className="mt-1 font-serif text-lg font-bold text-slate-100">A fit you can understand</h2></div><div className="grid h-9 w-9 place-items-center rounded-xl bg-violet-400/10 text-violet-200"><Target size={17}/></div></div>
            <div className="mt-6 rounded-2xl border border-slate-700/70 bg-[#0d1322] p-4">
              <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-300/10 text-indigo-200"><BriefcaseBusiness size={17}/></div><div><div className="text-sm font-semibold text-slate-200">Your experience</div><div className="text-[11px] text-slate-500">Compared with the role, not a keyword list</div></div></div>
              <div className="my-5 flex items-center gap-3"><div className="h-px flex-1 bg-gradient-to-r from-transparent via-violet-300/40 to-emerald-300/40"/><div className="grid h-9 w-9 place-items-center rounded-full border border-violet-200/20 bg-[#171d31] text-violet-200"><ArrowDown size={14}/></div><div className="h-px flex-1 bg-gradient-to-r from-emerald-300/40 to-transparent"/></div>
              <div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-emerald-300/[.06] p-3"><div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold text-emerald-200"><CheckCircle2 size={13}/>Already aligned</div><div className="grid gap-1.5"><span className="text-xs text-slate-300">Profile skill</span><span className="text-xs text-slate-300">Relevant experience</span></div></div><div className="rounded-xl bg-amber-300/[.05] p-3"><div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold text-amber-200"><TrendingUp size={13}/>Room to grow</div><div className="grid gap-1.5"><span className="text-xs text-slate-300">Role requirement</span><span className="text-xs text-slate-300">Possible next skill</span></div></div></div>
            </div>
            <div className="mt-4 flex items-center justify-between text-[10px] text-slate-500"><span>Derived from profile + role requirements</span><span className="font-mono">A / B</span></div>
          </div>
          <div className="surface absolute -bottom-6 -left-7 hidden items-center gap-3 rounded-2xl px-4 py-3 md:flex"><span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-300/10 text-emerald-200"><Check size={16}/></span><span><b className="block text-xs text-slate-200">Evidence, not guesswork</b><small className="text-[10px] text-slate-500">Every score has a breakdown</small></span></div>
        </div>
      </div>
    </section>
    <section id="how" className="grid gap-12 py-20 lg:grid-cols-[.6fr_1.4fr] lg:py-28">
      <div><div className="text-[11px] font-bold uppercase tracking-[.2em] text-emerald-300">A fairer signal</div><h2 className="mt-3 font-serif text-3xl font-bold tracking-[-.04em] text-slate-100 sm:text-4xl">Good work is more than a title.</h2></div>
      <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2">{[
        ['01','Describe what you do','List your skills, the level you work at, and how long you have used them.'],
        ['02','See the full picture','Compare required and preferred skills, experience, location, and work preferences.'],
        ['03','Choose your next move','Spot missing requirements and decide which roles—or skills—deserve your time.'],
        ['04','Hire for capability','Publish role requirements with clarity and reach people whose experience fits.'],
      ].map(([n,title,body])=><div key={n} className="border-t border-slate-800 pt-4"><div className="font-mono text-xs text-violet-300">{n}</div><h3 className="mt-3 font-serif text-lg font-bold text-slate-100">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{body}</p></div>)}</div>
    </section>
    <section id="for-employers" className="surface relative overflow-hidden rounded-[26px] p-7 sm:p-10">
      <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-violet-500/[.08] blur-3xl"/><div className="relative grid items-center gap-8 md:grid-cols-[1fr_auto]"><div><div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold text-emerald-200"><Building2 size={15}/>For teams hiring with focus</div><h2 className="max-w-xl font-serif text-3xl font-bold tracking-[-.04em] text-slate-100">Write the role around the work.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Set required skills, preferred skills, experience and work mode. Candidates see how their capabilities compare—before anyone spends time guessing.</p></div><Link href="/register"><Button variant="outline" className="w-fit">Create an employer account <ArrowUpRight size={15}/></Button></Link></div>
    </section>
    <section className="py-20 text-center"><div className="mx-auto max-w-xl"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-violet-300/10 text-violet-200"><Zap size={21}/></div><h2 className="mt-5 font-serif text-3xl font-bold tracking-[-.04em] text-slate-100">Start with what you can do.</h2><p className="mt-3 text-sm leading-6 text-slate-400">A clear skills profile is the first step to a better match.</p><Link href="/register" className="mt-6 inline-flex"><Button>Create your free profile <ArrowRight size={15}/></Button></Link></div></section>
  </div>;
}

function AuthPage({ mode }: {mode: 'login'|'register'}) {
  const register = mode === 'register';
  const login = useLogin();
  const create = useRegister();
  const qc = useQueryClient();
  const [, setPath] = useLocation();
  const [error, setError] = useState('');
  const [role, setRole] = useState<'candidate'|'employer'>('candidate');
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setError('');
    const f = new FormData(e.currentTarget);
    const onSuccess = (res: {success: true; data: {token: string; user: {id: string; name: string; email: string; role: Role}}}) => {
      window.sessionStorage.setItem(TOKEN_KEY, res.data.token);
      qc.setQueryData(getGetCurrentUserQueryKey(), {success:true,data:res.data.user});
      setPath(res.data.user.role === 'admin' ? '/admin' : res.data.user.role === 'employer' ? '/employer' : '/dashboard');
    };
    if (register) create.mutate({data:{name:String(f.get('name')),email:String(f.get('email')),password:String(f.get('password')),role}}, {onSuccess, onError:e=>setError(userError(e))});
    else login.mutate({data:{email:String(f.get('email')),password:String(f.get('password'))}}, {onSuccess, onError:e=>setError(userError(e))});
  };
  const busy = login.isPending || create.isPending;
  return <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[28px] border border-slate-800/80 bg-[#0e1424] md:grid-cols-[.9fr_1.1fr]">
    <div className="soft-grid relative hidden min-h-[560px] flex-col justify-between overflow-hidden border-r border-slate-800/70 bg-[#10172a] p-10 md:flex"><div><BrandMark/><div className="mt-14 text-[11px] font-bold uppercase tracking-[.2em] text-violet-300">Make experience visible</div><h1 className="mt-4 max-w-sm font-serif text-4xl font-extrabold leading-tight tracking-[-.05em] text-slate-50">{register ? 'Build a profile that reflects your work.' : 'Welcome back to your next move.'}</h1><p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">Skills, preferences, and real requirements. A straightforward way to see what fits.</p></div><div className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck size={15} className="text-emerald-300"/>Your profile stays yours.</div></div>
    <div className="p-6 sm:p-10 md:p-12"><div className="mb-8 md:hidden"><BrandMark/></div><div className="text-[11px] font-bold uppercase tracking-[.2em] text-violet-300">{register ? 'Create your account' : 'Good to see you'}</div><h2 className="mt-2 font-serif text-3xl font-bold tracking-[-.04em] text-slate-100">{register ? 'Make your skills count.' : 'Sign in to SkillMatch.'}</h2><p className="mt-2 text-sm text-slate-400">{register ? 'Choose your workspace to get started.' : 'Continue to your personal workspace.'}</p>
      {error && <div role="alert" className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/[.08] px-4 py-3 text-sm text-rose-200">{error}</div>}
      <form onSubmit={submit} className="mt-7 grid gap-4">
        {register && <Field label="Full name"><TextInput name="name" autoComplete="name" minLength={2} required placeholder="Your name" data-testid="input-name"/></Field>}
        <Field label="Email address"><TextInput name="email" type="email" autoComplete="email" required placeholder="you@example.com" data-testid="input-email"/></Field>
        <Field label="Password" hint={register ? 'At least 10 characters.' : undefined}><TextInput name="password" type="password" autoComplete={register?'new-password':'current-password'} minLength={register?10:1} required placeholder="••••••••••" data-testid="input-password"/></Field>
        {register && <Field label="I am here as"><Select value={role} onChange={e=>setRole(e.target.value as 'candidate'|'employer')} data-testid="select-account-role"><option value="candidate">Candidate — looking for my next role</option><option value="employer">Employer — building a team</option></Select></Field>}
        <Button type="submit" disabled={busy} className="mt-2 w-full py-3">{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}<ArrowRight size={15}/></Button>
      </form>
      <div className="mt-6 text-center text-sm text-slate-500">{register ? 'Already have an account?' : 'New to SkillMatch?'} <Link href={register?'/login':'/register'} className="font-semibold text-violet-300 hover:text-violet-200">{register?'Sign in':'Create an account'}</Link></div>
    </div>
  </div>;
}

function CandidateDashboard() {
  const q = useGetCandidateDashboard();
  if (q.isLoading) return <Loading/>;
  if (q.isError || !q.data?.success) return <StateMessage title="Your overview is unavailable" body={userError(q.error)} tone="error" action={<Link href="/login"><Button>Sign in</Button></Link>}/>;
  const d = q.data.data;
  return <div className="enter"><PageTitle eyebrow="Candidate workspace" title="Make your next move." note="A clear view of your profile, matches, and the skills that can open new doors." action={<Link href="/jobs"><Button variant="outline"><Search size={15}/>Explore roles</Button></Link>}/>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        {label:'Profile readiness',value:`${d.profileCompletion}%`,icon:UserRound,foot:'A stronger profile gives more context'},
        {label:'Top match',value:d.topMatch?`${d.topMatch.matchScore}%`:'—',icon:Target,foot:d.topMatch?.job.title || 'No matches to show yet'},
        {label:'Saved roles',value:String(d.savedJobsCount),icon:Bookmark,foot:'Keep promising roles in view'},
        {label:'Skill opportunities',value:String(d.skillGapsCount),icon:TrendingUp,foot:'Requirements appearing in your market'},
      ].map((it,i)=><Panel key={it.label} className="p-5"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-400">{it.label}</span><it.icon size={17} className={i===1?'text-emerald-300':'text-violet-300'}/></div><div className="mt-4 font-mono text-3xl font-bold tracking-tight text-slate-100">{it.value}</div><div className="mt-2 truncate text-[11px] text-slate-500">{it.foot}</div></Panel>)}
    </div>
    <div className="mt-6 grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
      <Panel><div className="mb-5 flex items-center justify-between"><div><div className="text-[10px] font-bold uppercase tracking-[.18em] text-violet-300">Strongest alignment</div><h2 className="mt-1 font-serif text-xl font-bold text-slate-100">Roles worth a closer look</h2></div><Link href="/matches" className="text-xs font-semibold text-violet-300 hover:text-violet-200">All matches <ArrowRight size={13} className="ml-1 inline"/></Link></div>
        {d.topMatches.length ? <div className="grid gap-3 md:grid-cols-2">{d.topMatches.slice(0,4).map(m=><JobCard key={m.job.id} job={m.job} score={m.matchScore} compact/>)}</div> : <EmptyInline title="No matches yet" body="Add your skills and preferences to see role alignment based on your profile." action={<Link href="/profile"><Button variant="outline">Complete profile</Button></Link>}/>}
      </Panel>
      <Panel><div className="text-[10px] font-bold uppercase tracking-[.18em] text-emerald-300">Your next edges</div><h2 className="mt-1 font-serif text-xl font-bold text-slate-100">Skills in demand</h2><p className="mt-2 text-xs leading-5 text-slate-500">Based on requirements across roles currently in the system.</p>
        {d.recommendedSkills.length ? <div className="mt-5 grid gap-3">{d.recommendedSkills.slice(0,5).map(g=><div key={g.skill.id} className="flex items-center justify-between border-b border-slate-800/70 pb-3"><div><div className="text-sm font-semibold text-slate-200">{g.skill.name}</div><div className="mt-1 text-[10px] text-slate-500">{g.relatedJobs} related listings</div></div><Pill color={g.importance==='high'?'amber':'neutral'}>{g.importance} priority</Pill></div>)}</div> : <p className="mt-5 text-sm text-slate-500">No skill gap data is available yet.</p>}
        <Link href="/skill-gaps" className="mt-4 inline-flex text-xs font-semibold text-violet-300">Review skill gaps <ArrowRight size={13} className="ml-1"/></Link>
      </Panel>
    </div>
    {d.topMatch && <Panel className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-300/10 text-emerald-200"><Target size={22}/></div><div><div className="text-[10px] font-bold uppercase tracking-[.17em] text-emerald-200">Your highest current score</div><div className="mt-1 text-lg font-bold text-slate-100">{d.topMatch.job.title} <span className="font-normal text-slate-500">at {d.topMatch.job.company}</span></div></div></div><Link href={`/jobs/${d.topMatch.job.id}`}><Button variant="outline">Understand this match <ArrowRight size={15}/></Button></Link></Panel>}
  </div>;
}
function EmptyInline({ title, body, action }: {title: string; body: string; action?: ReactNode}) {
  return <div className="rounded-xl border border-dashed border-slate-700/80 px-5 py-8 text-center"><div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-slate-800/70 text-slate-400"><CircleHelp size={18}/></div><h3 className="mt-3 text-sm font-semibold text-slate-200">{title}</h3><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">{body}</p>{action && <div className="mt-4">{action}</div>}</div>;
}

function ProfilePage() {
  const q = useGetProfile();
  const update = useUpdateProfile();
  const qc = useQueryClient();
  const [notice,setNotice] = useState('');
  useEffect(()=>{if(update.isSuccess){setNotice('Profile saved.');qc.invalidateQueries({queryKey:getGetProfileQueryKey()});}},[update.isSuccess,qc]);
  if(q.isLoading) return <Loading/>;
  if(q.isError||!q.data?.success) return <StateMessage title="Profile details are not available" body={userError(q.error)} tone="error"/>;
  const p=q.data.data;
  const submit=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);const input:ProfileInput={name:String(f.get('name')),headline:String(f.get('headline')),bio:String(f.get('bio')),experienceYears:Number(f.get('experienceYears')),preferredLocation:String(f.get('preferredLocation')),preferredWorkMode:String(f.get('preferredWorkMode')) as WorkMode,preferredCategories:String(f.get('preferredCategories')).split(',').map(x=>x.trim()).filter(Boolean)};update.mutate({data:input},{onSuccess:()=>setNotice('Profile saved.'),onError:e=>setNotice(userError(e))});};
  return <div className="enter"><PageTitle eyebrow="Candidate profile" title="Tell your story clearly." note="Your profile helps compare real experience with each role's stated requirements."/><div className="grid gap-5 lg:grid-cols-[.65fr_1.35fr]">
    <Panel className="h-fit"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-400">Profile completion</span><span className="font-mono text-lg font-bold text-violet-200">{p.completion}%</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-emerald-300" style={{width:`${p.completion}%`}}/></div><p className="mt-3 text-xs leading-5 text-slate-500">Complete your profile to give employers useful context beyond a job title.</p><div className="mt-6 grid gap-3 border-t border-slate-800 pt-5"><Link href="/skills" className="flex items-center justify-between rounded-xl bg-white/[.03] p-3 text-xs text-slate-300 hover:bg-white/[.06]"><span className="flex items-center gap-2"><Layers3 size={14} className="text-violet-300"/>Manage skills</span><ArrowRight size={14}/></Link><div className="flex items-center gap-2 text-[11px] text-slate-500"><MapPin size={13}/>{p.preferredLocation || 'No location preference set'}</div></div></Panel>
    <Panel><form onSubmit={submit} className="grid gap-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Name"><TextInput name="name" defaultValue={p.name} required data-testid="input-profile-name"/></Field><Field label="Years of experience"><TextInput name="experienceYears" type="number" min={0} max={60} defaultValue={p.experienceYears} required data-testid="input-experience"/></Field></div><Field label="Professional headline"><TextInput name="headline" maxLength={160} defaultValue={p.headline} placeholder="What kind of work do you do?" data-testid="input-headline"/></Field><Field label="About your work"><TextArea name="bio" maxLength={2000} defaultValue={p.bio} placeholder="Describe the work you have done and the problems you know how to solve." data-testid="input-bio"/></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Preferred location"><TextInput name="preferredLocation" defaultValue={p.preferredLocation} placeholder="City, region, or remote" data-testid="input-location"/></Field><Field label="Work preference"><Select name="preferredWorkMode" defaultValue={p.preferredWorkMode} data-testid="select-work-mode"><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></Select></Field></div><Field label="Preferred categories" hint="Separate multiple categories with commas."><TextInput name="preferredCategories" defaultValue={p.preferredCategories.join(', ')} placeholder="Product, data, design" data-testid="input-categories"/></Field>{notice && <p role="status" className={cx('text-xs',notice==='Profile saved.'?'text-emerald-300':'text-rose-300')}>{notice}</p>}<div className="flex justify-end"><Button type="submit" disabled={update.isPending}>{update.isPending?'Saving…':'Save profile'}</Button></div></form></Panel>
  </div></div>;
}

function SkillsPage() {
  const skillsQ=useListProfileSkills();
  const catalogQ=useListSkills();
  const add=useAddProfileSkill(); const update=useUpdateProfileSkill(); const remove=useRemoveProfileSkill();
  const qc=useQueryClient();
  const [query,setQuery]=useState('');const [pick,setPick]=useState('');const [prof,setProf]=useState<Proficiency>('intermediate');const [years,setYears]=useState('1');const [message,setMessage]=useState('');
  const skills=skillsQ.data?.success?skillsQ.data.data:[];
  const catalog=catalogQ.data?.success?catalogQ.data.data:[];
  const available=catalog.filter(s=>!skills.some(my=>my.skillId===s.id)&&s.name.toLowerCase().includes(query.toLowerCase()));
  const refresh=()=>{qc.invalidateQueries({queryKey:getListProfileSkillsQueryKey()});qc.invalidateQueries({queryKey:getGetProfileQueryKey()});qc.invalidateQueries({queryKey:getGetCandidateDashboardQueryKey()});};
  if(skillsQ.isLoading||catalogQ.isLoading) return <Loading/>;
  if(skillsQ.isError||catalogQ.isError) return <StateMessage title="Skills could not be loaded" body={userError(skillsQ.error||catalogQ.error)} tone="error"/>;
  const submit=(e:FormEvent)=>{e.preventDefault();if(!pick)return;add.mutate({data:{skillId:pick,proficiency:prof,yearsExperience:Number(years)}},{onSuccess:()=>{setPick('');setQuery('');setMessage('Skill added to your profile.');refresh();},onError:e=>setMessage(userError(e))});};
  const change=(skill:CandidateSkill,field:'proficiency'|'yearsExperience',value:string)=>{const data={proficiency:field==='proficiency'?value as Proficiency:skill.proficiency,yearsExperience:field==='yearsExperience'?Number(value):skill.yearsExperience};update.mutate({skillId:skill.id,data},{onSuccess:refresh,onError:e=>setMessage(userError(e))});};
  return <div className="enter"><PageTitle eyebrow="Skills inventory" title="Make your skills specific." note="Proficiency and time in practice help make role comparisons more meaningful."/>
    <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
      <Panel className="h-fit"><div className="mb-5 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-300/10 text-violet-200"><Plus size={19}/></div><div><h2 className="font-serif text-lg font-bold text-slate-100">Add a skill</h2><p className="text-xs text-slate-500">Choose from the skill catalog.</p></div></div>
        <form onSubmit={submit} className="grid gap-4"><Field label="Find a skill"><TextInput value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search skill names…" data-testid="input-skill-search"/></Field><Field label="Skill"><Select value={pick} onChange={e=>setPick(e.target.value)} required data-testid="select-skill"><option value="">Choose a skill</option>{available.map(s=><option key={s.id} value={s.id}>{s.name} · {s.category}</option>)}</Select></Field><div className="grid grid-cols-2 gap-3"><Field label="Proficiency"><Select value={prof} onChange={e=>setProf(e.target.value as Proficiency)}>{['beginner','intermediate','advanced','expert'].map(x=><option key={x} value={x}>{readable(x)}</option>)}</Select></Field><Field label="Years practiced"><TextInput type="number" min={0} max={60} value={years} onChange={e=>setYears(e.target.value)} required/></Field></div>{message && <p role="status" className="text-xs text-emerald-300">{message}</p>}<Button type="submit" disabled={!pick||add.isPending}>{add.isPending?'Adding…':'Add to profile'}<Plus size={15}/></Button></form>
      </Panel>
      <Panel><div className="mb-5 flex items-end justify-between"><div><div className="text-[10px] font-bold uppercase tracking-[.18em] text-emerald-300">Your inventory</div><h2 className="mt-1 font-serif text-xl font-bold text-slate-100">Skills on your profile</h2></div><Pill color="neutral">{skills.length} skills</Pill></div>
        {skills.length ? <div className="grid gap-3">{skills.map(s=><div key={s.id} className="grid gap-3 rounded-xl border border-slate-800/80 bg-[#0c1221] p-4 sm:grid-cols-[1fr_150px_105px_auto] sm:items-center"><div><div className="font-semibold text-slate-100">{s.name}</div><div className="mt-1 text-[11px] text-slate-500">{s.category}</div></div><Select aria-label={`Proficiency for ${s.name}`} value={s.proficiency} onChange={e=>change(s,'proficiency',e.target.value)}>{['beginner','intermediate','advanced','expert'].map(x=><option key={x} value={x}>{readable(x)}</option>)}</Select><TextInput aria-label={`Years using ${s.name}`} type="number" min={0} max={60} defaultValue={s.yearsExperience} onBlur={e=>Number(e.target.value)!==s.yearsExperience&&change(s,'yearsExperience',e.target.value)}/><button data-testid={`button-remove-skill-${s.id}`} onClick={()=>{if(confirm(`Remove ${s.name} from your profile?`))remove.mutate({skillId:s.id},{onSuccess:refresh,onError:e=>setMessage(userError(e))});}} aria-label={`Remove ${s.name}`} className="rounded-lg p-2 text-slate-500 hover:bg-rose-400/10 hover:text-rose-300"><Trash2 size={16}/></button></div>)}</div> : <EmptyInline title="No skills added yet" body="Add skills you have actually used, then choose a proficiency and years of experience."/>}
      </Panel>
    </div>
  </div>;
}

function JobsPage() {
  const [q,setQ]=useState('');const [text,setText]=useState('');
  const [mode,setMode]=useState('');const [sort,setSort]=useState('match');
  const hasToken = typeof window !== 'undefined' && Boolean(window.sessionStorage.getItem(TOKEN_KEY));
  const userQ=useGetCurrentUser({query:{queryKey:getGetCurrentUserQueryKey(),enabled:hasToken,retry:false}});
  const isCandidate=userQ.data?.success===true&&userQ.data.data.role==='candidate';
  const effectiveSort=!isCandidate&&sort==='match'?'newest':sort;
  const filters=useMemo(()=>({q:text||undefined,workMode:mode?mode as WorkMode:undefined,sort:effectiveSort as 'match'|'newest'|'salary-high'|'salary-low'}),[text,mode,effectiveSort]);
  const jobsQ=useListJobs(filters);
  const savedQ=useListSavedJobs({query:{queryKey:getListSavedJobsQueryKey(),enabled:isCandidate,retry:false}});
  const save=useSaveJob();const unsave=useUnsaveJob();const qc=useQueryClient();
  const jobs=jobsQ.data?.success?jobsQ.data.data.items:[];
  const saved=new Set(savedQ.data?.success?savedQ.data.data.map(s=>s.job.id):[]);
  const toggle=(id:string)=>{const mutation=saved.has(id)?unsave:save;mutation.mutate({id},{onSuccess:()=>{qc.invalidateQueries({queryKey:getListSavedJobsQueryKey()});qc.invalidateQueries({queryKey:getListJobsQueryKey()});qc.invalidateQueries({queryKey:getGetCandidateDashboardQueryKey()});},onError:e=>alert(userError(e))});};
  return <div className="enter"><PageTitle eyebrow="Opportunity search" title="Find work that fits." note={isCandidate?"Explore roles and see how your listed skills align with their requirements.":"Explore active roles. Create a candidate profile to see your personal skill matches."}/>
    <Panel className="mb-5 p-4"><form onSubmit={e=>{e.preventDefault();setText(q.trim());}} className="grid gap-3 md:grid-cols-[1fr_180px_180px_auto] md:items-end"><Field label="Search roles"><div className="relative"><Search size={16} className="absolute left-3 top-3.5 text-slate-500"/><TextInput className="pl-9" value={q} onChange={e=>setQ(e.target.value)} placeholder="Title, company, category" data-testid="input-job-search"/></div></Field><Field label="Work mode"><Select value={mode} onChange={e=>setMode(e.target.value)}><option value="">Any mode</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></Select></Field><Field label="Sort by"><Select value={!isCandidate&&sort==='match'?'newest':sort} onChange={e=>setSort(e.target.value)}>{isCandidate&&<option value="match">Best match</option>}<option value="newest">Newest</option><option value="salary-high">Salary: high to low</option><option value="salary-low">Salary: low to high</option></Select></Field><Button type="submit"><Filter size={15}/>Apply</Button></form></Panel>
    {jobsQ.isLoading ? <Loading label="Loading jobs"/> : jobsQ.isError ? <StateMessage title="Listings are unavailable" body={userError(jobsQ.error)} tone="error" action={<Button variant="outline" onClick={()=>jobsQ.refetch()}>Try again</Button>}/> : jobs.length ? <><div className="mb-3 text-xs text-slate-500">{jobsQ.data?.success?jobsQ.data.data.total:0} roles found</div><div className="grid gap-4 xl:grid-cols-2">{jobs.map(m=><JobCard key={m.job.id} job={m.job} score={isCandidate?m.matchScore:undefined} saved={saved.has(m.job.id)||m.saved} onSave={isCandidate?()=>toggle(m.job.id):undefined}/>)}</div></> : <StateMessage title="No roles match those filters" body="Try a broader search or clear the work mode filter. Listings appear here when the service has active jobs." action={<Button variant="outline" onClick={()=>{setQ('');setText('');setMode('');}}>Clear filters</Button>}/>}
  </div>;
}

function JobDetailPage() {
  const params=useParams<{id:string}>();
  const id=params.id || '';
  const hasToken = typeof window !== 'undefined' && Boolean(window.sessionStorage.getItem(TOKEN_KEY));
  const userQ=useGetCurrentUser({query:{queryKey:getGetCurrentUserQueryKey(),enabled:hasToken,retry:false}});
  const isCandidate=userQ.data?.success===true&&userQ.data.data.role==='candidate';
  const q=useGetJob(id);
  const matchQ=useGetMatch(id,{query:{enabled:!!id&&isCandidate,queryKey:getGetMatchQueryKey(id)}});
  const savedQ=useListSavedJobs({query:{queryKey:getListSavedJobsQueryKey(),enabled:isCandidate,retry:false}});
  const save=useSaveJob();const unsave=useUnsaveJob();
  const explain=useGetMatchExplanation();
  const qc=useQueryClient();
  const [explainError,setExplainError]=useState('');
  if(q.isLoading)return <Loading label="Loading role details"/>;
  if(q.isError||!q.data?.success)return <StateMessage title="This role is unavailable" body={userError(q.error)} tone="error" action={<Link href="/jobs"><Button variant="outline"><ArrowLeft size={15}/>Back to jobs</Button></Link>}/>;
  const d=q.data.data;const job=d.job;const m=d.match || (matchQ.data?.success?matchQ.data.data:null);
  const saved=d.saved || !!savedQ.data?.success&&savedQ.data.data.some(x=>x.job.id===job.id);
  const toggle=()=>{const action=saved?unsave:save;action.mutate({id:job.id},{onSuccess:()=>{qc.invalidateQueries({queryKey:getGetJobQueryKey(id)});qc.invalidateQueries({queryKey:getListSavedJobsQueryKey()});qc.invalidateQueries({queryKey:getListJobsQueryKey()});},onError:e=>alert(userError(e))});};
  const requestExplanation=()=>{setExplainError('');explain.mutate({data:{jobId:job.id}},{onError:e=>setExplainError(userError(e))});};
  const explanation=explain.data?.success?explain.data.data:null;
  return <div className="enter"><Link href="/jobs" className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-100"><ArrowLeft size={14}/>Back to roles</Link>
    <div className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
      <div className="grid content-start gap-5">
        <Panel><div className="flex flex-wrap gap-2"><Pill>{job.category}</Pill><Pill color={job.workMode==='remote'?'green':'neutral'}>{readable(job.workMode)}</Pill><Pill color="neutral">{job.status}</Pill></div><h1 className="mt-4 font-serif text-3xl font-extrabold tracking-[-.04em] text-slate-50 sm:text-4xl">{job.title}</h1><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-400"><span className="flex items-center gap-2"><Building2 size={15}/>{job.company}</span><span className="flex items-center gap-2"><MapPin size={15}/>{job.location}</span><span className="flex items-center gap-2"><BriefcaseBusiness size={15}/>{job.experienceMin}–{job.experienceMax} years</span></div><div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 pt-5"><div><div className="font-mono text-xl font-bold text-slate-100">{range(job.salaryMin,job.salaryMax)}</div><div className="text-[11px] text-slate-500">Salary range provided by employer</div></div><div className="flex gap-2">{isCandidate?<Button variant="outline" onClick={toggle} disabled={save.isPending||unsave.isPending}><Bookmark size={15} fill={saved?'currentColor':'none'}/>{saved?'Saved':'Save role'}</Button>:<Link href="/login"><Button variant="outline">Sign in to save</Button></Link>}</div></div></Panel>
        <Panel><h2 className="font-serif text-xl font-bold text-slate-100">About the role</h2><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-400">{job.description}</p></Panel>
        <div className="grid gap-5 md:grid-cols-2"><Panel><h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-100"><span className="grid h-7 w-7 place-items-center rounded-lg bg-violet-300/10 text-violet-200"><Target size={14}/></span>Required skills</h2>{job.requiredSkills.length?<div className="grid gap-2">{job.requiredSkills.map(s=><div key={s.id} className={cx('flex items-center justify-between rounded-lg px-3 py-2.5',m?.matchedRequiredSkills.includes(s.name)?'bg-emerald-300/[.06]':'bg-white/[.035]')}><span className="text-sm text-slate-300">{s.name}</span>{m && <Pill color={m.matchedRequiredSkills.includes(s.name)?'green':'amber'}>{m.matchedRequiredSkills.includes(s.name)?'In profile':'Gap'}</Pill>}</div>)}</div>:<p className="text-sm text-slate-500">No required skills listed.</p>}</Panel>
        <Panel><h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-100"><span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-300/10 text-emerald-200"><Sparkles size={14}/></span>Preferred skills</h2>{job.preferredSkills.length?<div className="flex flex-wrap gap-2">{job.preferredSkills.map(s=><Pill key={s.id} color="neutral">{s.name}</Pill>)}</div>:<p className="text-sm text-slate-500">No preferred skills specified.</p>}</Panel></div>
      </div>
      <div className="grid content-start gap-5">
        <Panel className="relative overflow-hidden"><div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-emerald-400/[.06] blur-3xl"/><div className="relative flex items-start justify-between"><div><div className="text-[10px] font-bold uppercase tracking-[.19em] text-emerald-200">Skill alignment</div><h2 className="mt-1 font-serif text-lg font-bold text-slate-100">A transparent comparison</h2></div><ShieldCheck size={18} className="text-emerald-300"/></div>
          {m ? <><div className="mt-5 flex items-end justify-between"><div className="font-mono text-5xl font-bold tracking-[-.06em] text-emerald-200">{m.matchScore}<span className="text-2xl">%</span></div><div className="pb-1 text-right text-[10px] text-slate-500">score returned by<br/>the matching service</div></div><div className="mt-4 grid gap-3">{[['Required skills',m.scoreBreakdown.requiredSkills],['Preferred skills',m.scoreBreakdown.preferredSkills],['Experience',m.scoreBreakdown.experience]].map(([label,value])=><div key={String(label)}><div className="mb-1.5 flex justify-between text-[11px]"><span className="text-slate-400">{label}</span><span className="font-mono text-slate-300">{value}%</span></div><div className="h-1.5 rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-emerald-300" style={{width:`${value}%`}}/></div></div>)}</div><p className="mt-4 text-[11px] leading-5 text-slate-500">Scores use the profile and this role's requirements. They are directional, not a hiring decision.</p></> : <div className="mt-5 rounded-xl border border-dashed border-slate-700 p-4 text-sm leading-6 text-slate-400">A personalized score is not available for this role. Sign in with a candidate profile that includes skills to compare requirements.</div>}
        </Panel>
        <Panel><div className="text-[10px] font-bold uppercase tracking-[.18em] text-violet-300">Optional explanation</div><h2 className="mt-1 font-serif text-lg font-bold text-slate-100">Why could this fit?</h2><p className="mt-2 text-xs leading-5 text-slate-500">Request a grounded explanation from the configured service. No explanation is generated until you ask.</p>{isCandidate?<Button variant="outline" className="mt-4 w-full" onClick={requestExplanation} disabled={explain.isPending}>{explain.isPending?'Requesting explanation…':<><Sparkles size={14}/>Explain my match</>}</Button>:<Link href="/login" className="mt-4 inline-flex"><Button variant="outline">Sign in to request an explanation</Button></Link>}
          {explainError&&<div role="alert" className="mt-3 rounded-lg border border-amber-300/15 bg-amber-300/[.06] p-3 text-xs leading-5 text-amber-100">{explainError}</div>}
          {explanation&&<div className="mt-4 grid gap-4 border-t border-slate-800 pt-4"><p className="text-xs leading-5 text-slate-300">{explanation.summary}</p>{[['Why it may fit',explanation.whyMatch],['Strengths',explanation.strengths],['Skill gaps',explanation.skillGaps],['Recommended actions',explanation.recommendedActions]].map(([title,arr])=><div key={String(title)}><div className="mb-2 text-[11px] font-semibold text-slate-200">{title}</div><ul className="grid gap-1.5">{(arr as string[]).map((item,i)=><li key={i} className="flex gap-2 text-[11px] leading-5 text-slate-400"><span className="mt-1 text-violet-300">•</span>{item}</li>)}</ul></div>)}{explanation.learningPriority.length>0&&<div><div className="mb-2 text-[11px] font-semibold text-slate-200">Learning priority</div>{explanation.learningPriority.map((x,i)=><div key={i} className="mb-2 rounded-lg bg-white/[.03] p-2.5"><div className="flex justify-between text-xs text-slate-200"><span>{x.skill}</span><Pill color={x.priority==='High'?'amber':'neutral'}>{x.priority}</Pill></div><p className="mt-1 text-[10px] text-slate-500">{x.reason}</p></div>)}</div>}</div>}
        </Panel>
      </div>
    </div>
  </div>;
}

function SavedJobsPage() {
  const q=useListSavedJobs();const unsave=useUnsaveJob();const qc=useQueryClient();
  if(q.isLoading)return <Loading/>;
  if(q.isError||!q.data?.success)return <StateMessage title="Saved roles are unavailable" body={userError(q.error)} tone="error"/>;
  const items=q.data.data;
  return <div className="enter"><PageTitle eyebrow="Your shortlist" title="Saved for later." note="Keep promising roles together while you compare what matters."/><div className="mb-5 flex items-center gap-2 text-xs text-slate-500"><Bookmark size={14} className="text-violet-300"/>{items.length} saved {items.length===1?'role':'roles'}</div>
    {items.length?<div className="grid gap-4 xl:grid-cols-2">{items.map(item=><div key={item.job.id} className="relative"><JobCard job={item.job} score={item.matchScore} saved onSave={()=>unsave.mutate({id:item.job.id},{onSuccess:()=>{qc.invalidateQueries({queryKey:getListSavedJobsQueryKey()});qc.invalidateQueries({queryKey:getListJobsQueryKey()});},onError:e=>alert(userError(e))})}/><div className="absolute bottom-5 right-[62px] text-[10px] text-slate-600">Saved {new Date(item.savedAt).toLocaleDateString()}</div></div>)}</div>:<StateMessage title="Your shortlist is clear" body="Save roles while searching to keep them handy. Saved roles and scores come directly from the service." action={<Link href="/jobs"><Button>Find roles <ArrowRight size={15}/></Button></Link>}/>}
  </div>;
}
function MatchesPage() {
  const q=useListMatches();const savedQ=useListSavedJobs();const save=useSaveJob();const unsave=useUnsaveJob();const qc=useQueryClient();
  if(q.isLoading)return <Loading/>;
  if(q.isError||!q.data?.success)return <StateMessage title="Matches could not be loaded" body={userError(q.error)} tone="error"/>;
  const items=q.data.data;const saved=new Set(savedQ.data?.success?savedQ.data.data.map(x=>x.job.id):[]);
  return <div className="enter"><PageTitle eyebrow="Personalized matches" title="Fit, with the details." note="Matches are calculated by the service from your skills and each active role's requirements." action={<Link href="/skill-gaps"><Button variant="outline"><TrendingUp size={15}/>Explore skill gaps</Button></Link>}/>
    {items.length?<div className="grid gap-4 xl:grid-cols-2">{items.map(m=><JobCard key={m.job.id} job={m.job} score={m.matchScore} saved={saved.has(m.job.id)||m.saved} onSave={()=>{const action=saved.has(m.job.id)?unsave:save;action.mutate({id:m.job.id},{onSuccess:()=>{qc.invalidateQueries({queryKey:getListMatchesQueryKey()});qc.invalidateQueries({queryKey:getListSavedJobsQueryKey()});},onError:e=>alert(userError(e))});}}/>)}</div>:<StateMessage title="No matches to show yet" body="A match requires an active job and a candidate profile with skill data. Add skills and preferences, then check back." action={<Link href="/profile"><Button>Review profile <ArrowRight size={15}/></Button></Link>}/>}
  </div>;
}
function SkillGapsPage() {
  const q=useGetSkillGaps();
  if(q.isLoading)return <Loading/>;
  if(q.isError||!q.data?.success)return <StateMessage title="Skill-gap analysis is unavailable" body={userError(q.error)} tone="error"/>;
  const {currentSkills,gaps}=q.data.data;
  return <div className="enter"><PageTitle eyebrow="Career development" title="See where to grow next." note="These signals reflect skills that appear in jobs compared with the skills on your profile. They are options—not prescriptions."/>
    <div className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]"><Panel><div className="mb-5 flex items-center justify-between"><div><div className="text-[10px] font-bold uppercase tracking-[.17em] text-emerald-300">Current strengths</div><h2 className="mt-1 font-serif text-xl font-bold text-slate-100">On your profile</h2></div><Pill color="green">{currentSkills.length} skills</Pill></div>{currentSkills.length?<div className="grid gap-2">{currentSkills.map(s=><div key={s.id} className="flex items-center justify-between rounded-xl bg-white/[.035] px-3.5 py-3"><div><div className="text-sm font-semibold text-slate-200">{s.name}</div><div className="mt-1 text-[10px] text-slate-500">{s.category} · {s.yearsExperience} yrs</div></div><Pill color="green">{readable(s.proficiency)}</Pill></div>)}</div>:<EmptyInline title="No skills to compare" body="Add your skills to get an honest view of potential gaps." action={<Link href="/skills"><Button variant="outline">Add skills</Button></Link>}/>}</Panel>
      <Panel><div className="mb-5"><div className="text-[10px] font-bold uppercase tracking-[.17em] text-violet-300">Market signals</div><h2 className="mt-1 font-serif text-xl font-bold text-slate-100">Skills appearing in roles</h2><p className="mt-2 text-xs text-slate-500">Relative importance and related job counts are provided by the backend.</p></div>{gaps.length?<div className="grid gap-3">{gaps.map(g=><div key={g.skill.id} className="rounded-xl border border-slate-800/80 bg-[#0c1221] p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="font-semibold text-slate-100">{g.skill.name}</div><div className="mt-1 text-[11px] text-slate-500">{g.skill.category}</div></div><Pill color={g.importance==='high'?'amber':g.importance==='medium'?'violet':'neutral'}>{g.importance} importance</Pill></div><div className="mt-4 flex items-center justify-between border-t border-slate-800/70 pt-3 text-xs"><span className="text-slate-500">Related roles</span><span className="font-mono font-bold text-slate-300">{g.relatedJobs}</span></div></div>)}</div>:<EmptyInline title="No gaps identified" body="There is no skill-gap data to show right now. This may change as roles and your profile change."/>}</Panel>
    </div><div className="mt-5 flex items-start gap-3 rounded-xl border border-slate-800/70 bg-[#10172a] p-4 text-xs leading-5 text-slate-500"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-violet-300"/>A gap is not a deficiency. Use this view to prioritize learning only when a skill supports the work you want to do.</div>
  </div>;
}

function EmployerOverview() {
  const q=useGetEmployerDashboard();
  if(q.isLoading)return <Loading/>;
  if(q.isError||!q.data?.success)return <StateMessage title="Employer overview is unavailable" body={userError(q.error)} tone="error"/>;
  const d=q.data.data;
  return <div className="enter"><PageTitle eyebrow="Employer workspace" title="Your roles, at a glance." note="Manage listings and publish requirements that make the work clear." action={<Link href="/employer/jobs/new"><Button><Plus size={15}/>Post a role</Button></Link>}/>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[{label:'Active roles',value:d.totalActiveJobs,icon:BriefcaseBusiness,color:'text-emerald-200'},{label:'Archived roles',value:d.totalArchivedJobs,icon:Layers3,color:'text-slate-300'},{label:'Recent listings',value:d.recentJobs.length,icon:Activity,color:'text-violet-200'}].map(item=><Panel key={item.label}><div className="flex items-center justify-between"><span className="text-xs text-slate-400">{item.label}</span><item.icon size={17} className={item.color}/></div><div className="mt-3 font-mono text-3xl font-bold text-slate-100">{item.value}</div></Panel>)}
    </div>
    <Panel className="mt-6"><div className="mb-5 flex items-center justify-between"><div><div className="text-[10px] font-bold uppercase tracking-[.18em] text-violet-300">Recently published</div><h2 className="mt-1 font-serif text-xl font-bold text-slate-100">Keep your listings current</h2></div><Link href="/employer/jobs" className="text-xs font-semibold text-violet-300">Manage roles <ArrowRight size={13} className="ml-1 inline"/></Link></div>
      {d.recentJobs.length?<div className="grid gap-3">{d.recentJobs.map(job=><div key={job.id} className="flex flex-col justify-between gap-3 rounded-xl border border-slate-800/80 bg-[#0c1221] p-4 sm:flex-row sm:items-center"><div><div className="font-semibold text-slate-100">{job.title}</div><div className="mt-1 text-xs text-slate-500">{job.company} · {job.location} · {readable(job.workMode)}</div></div><div className="flex items-center gap-3"><Pill color={job.status==='active'?'green':'neutral'}>{job.status}</Pill><Link href={`/employer/jobs/${job.id}/edit`}><Button variant="outline" className="px-3 py-2">Edit</Button></Link></div></div>)}</div>:<EmptyInline title="No recent listings" body="Your active roles will appear here after you publish one." action={<Link href="/employer/jobs/new"><Button>Post your first role</Button></Link>}/>}
    </Panel>
    <div className="mt-5 flex items-start gap-3 rounded-xl border border-slate-800/70 bg-[#10172a] p-4 text-xs leading-5 text-slate-500"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-300"/>Specific required and preferred skills help candidates understand the role and make a more informed decision.</div>
  </div>;
}

function EmployerJobsPage() {
  const q=useListJobs();
  const archive=useArchiveJob();const remove=useDeleteJob();const qc=useQueryClient();
  const [message,setMessage]=useState('');
  if(q.isLoading)return <Loading label="Loading your listings"/>;
  if(q.isError||!q.data?.success)return <StateMessage title="Listings could not be loaded" body={userError(q.error)} tone="error" action={<Button variant="outline" onClick={()=>q.refetch()}>Try again</Button>}/>;
  const jobs=q.data.data.items.map(x=>x.job);
  const refresh=()=>{qc.invalidateQueries({queryKey:getListJobsQueryKey()});qc.invalidateQueries({queryKey:getGetEmployerDashboardQueryKey()});};
  return <div className="enter"><PageTitle eyebrow="Listing management" title="Roles you can shape." note="Edit role requirements, archive a listing, or remove one that is no longer needed." action={<Link href="/employer/jobs/new"><Button><Plus size={15}/>New listing</Button></Link>}/>
    {message&&<div role="alert" className="mb-4 rounded-xl border border-amber-300/20 bg-amber-300/[.07] p-3 text-sm text-amber-100">{message}</div>}
    {jobs.length?<div className="grid gap-3">{jobs.map(job=><div key={job.id} className="surface flex flex-col gap-4 rounded-2xl p-5 md:flex-row md:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-serif text-lg font-bold text-slate-100">{job.title}</h2><Pill color={job.status==='active'?'green':'neutral'}>{job.status}</Pill></div><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500"><span>{job.company}</span><span>{job.location}</span><span>{readable(job.workMode)}</span><span>{job.requiredSkills.length} required skills</span></div></div><div className="flex flex-wrap gap-2"><Link href={`/employer/jobs/${job.id}/edit`}><Button variant="outline" className="py-2"><Settings2 size={14}/>Edit</Button></Link>{job.status==='active'&&<Button variant="outline" className="py-2" disabled={archive.isPending} onClick={()=>{if(confirm(`Archive "${job.title}"?`))archive.mutate({id:job.id},{onSuccess:refresh,onError:e=>setMessage(userError(e))});}}><Layers3 size={14}/>Archive</Button>}<Button variant="danger" className="py-2" disabled={remove.isPending} onClick={()=>{if(confirm(`Permanently delete "${job.title}"? This cannot be undone.`))remove.mutate({id:job.id},{onSuccess:refresh,onError:e=>setMessage(userError(e))});}}><Trash2 size={14}/>Delete</Button></div></div>)}</div>:<StateMessage title="No available listings" body="Create a listing to describe the role, its required skills, and its working preferences. The listings shown here come from the jobs service." action={<Link href="/employer/jobs/new"><Button><Plus size={15}/>Create listing</Button></Link>}/>}
  </div>;
}

function JobEditor({ existing }: {existing?: Job}) {
  const create=useCreateJob();const update=useUpdateJob();const catalogQ=useListSkills();const qc=useQueryClient();const [,setPath]=useLocation();
  const [required,setRequired]=useState<string[]>(existing?.requiredSkills.map(s=>s.id)||[]);
  const [preferred,setPreferred]=useState<string[]>(existing?.preferredSkills.map(s=>s.id)||[]);
  const [error,setError]=useState('');
  useEffect(()=>{setRequired(existing?.requiredSkills.map(s=>s.id)||[]);setPreferred(existing?.preferredSkills.map(s=>s.id)||[]);},[existing?.id]);
  if(catalogQ.isLoading)return <Loading label="Loading skill catalog"/>;
  if(catalogQ.isError||!catalogQ.data?.success)return <StateMessage title="The skill catalog is unavailable" body={userError(catalogQ.error)} tone="error"/>;
  const skills=catalogQ.data.data;
  const submit=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();setError('');const f=new FormData(e.currentTarget);
    const payload:JobInput={title:String(f.get('title')),company:String(f.get('company')),description:String(f.get('description')),location:String(f.get('location')),workMode:String(f.get('workMode')) as WorkMode,category:String(f.get('category')),experienceMin:Number(f.get('experienceMin')),experienceMax:Number(f.get('experienceMax')),salaryMin:Number(f.get('salaryMin')),salaryMax:Number(f.get('salaryMax')),requiredSkills:required.map(skillId=>({skillId})),preferredSkills:preferred.map(skillId=>({skillId}))};
    const onSuccess=()=>{qc.invalidateQueries({queryKey:getListJobsQueryKey()});qc.invalidateQueries({queryKey:getGetEmployerDashboardQueryKey()});setPath('/employer/jobs');};
    if(existing)update.mutate({id:existing.id,data:payload},{onSuccess,onError:e=>setError(userError(e))});else create.mutate({data:payload},{onSuccess,onError:e=>setError(userError(e))});
  };
  const flip=(list:string[],set:(v:string[])=>void,id:string)=>set(list.includes(id)?list.filter(x=>x!==id):[...list,id]);
  return <div className="enter"><div className="mb-5 flex items-center justify-between"><Link href="/employer/jobs" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white"><ArrowLeft size={14}/>All listings</Link>{existing&&<Pill color={existing.status==='active'?'green':'neutral'}>{existing.status}</Pill>}</div><PageTitle eyebrow={existing?'Edit role':'New role'} title={existing?'Refine the requirements.':'Make the role clear.'} note="Specific role details help candidates compare their experience accurately."/>
    {error&&<div role="alert" className="mb-4 rounded-xl border border-rose-300/20 bg-rose-300/[.07] p-3 text-sm text-rose-100">{error}</div>}
    <form onSubmit={submit} className="grid gap-5">
      <Panel><div className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-violet-300"><BriefcaseBusiness size={15}/>Role details</div><div className="grid gap-4 sm:grid-cols-2"><Field label="Job title"><TextInput name="title" defaultValue={existing?.title} required minLength={2} maxLength={160} placeholder="Role title"/></Field><Field label="Company"><TextInput name="company" defaultValue={existing?.company} required minLength={2} maxLength={160} placeholder="Company name"/></Field><Field label="Category"><TextInput name="category" defaultValue={existing?.category} required minLength={2} maxLength={80} placeholder="Engineering, design, operations"/></Field><Field label="Location"><TextInput name="location" defaultValue={existing?.location} required minLength={2} maxLength={160} placeholder="City, region, or remote"/></Field><Field label="Work mode"><Select name="workMode" defaultValue={existing?.workMode||'remote'}><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></Select></Field></div><div className="mt-4"><Field label="Role description"><TextArea name="description" defaultValue={existing?.description} required minLength={20} maxLength={10000} placeholder="Describe the work, responsibilities, and context. Focus on what the person will do."/></Field></div></Panel>
      <Panel><div className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-emerald-300"><Activity size={15}/>Experience and compensation</div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Field label="Experience from (years)"><TextInput name="experienceMin" type="number" min={0} max={60} required defaultValue={existing?.experienceMin??0}/></Field><Field label="Experience to (years)"><TextInput name="experienceMax" type="number" min={0} max={60} required defaultValue={existing?.experienceMax??5}/></Field><Field label="Salary minimum"><TextInput name="salaryMin" type="number" min={0} required defaultValue={existing?.salaryMin??0}/></Field><Field label="Salary maximum"><TextInput name="salaryMax" type="number" min={0} required defaultValue={existing?.salaryMax??0}/></Field></div><p className="mt-3 text-[11px] text-slate-500">Enter 0 if no salary range is provided. Amounts are sent as entered.</p></Panel>
      <Panel><div className="mb-5"><div className="text-xs font-bold uppercase tracking-[.16em] text-violet-300">Role requirements</div><p className="mt-1 text-xs text-slate-500">Select at least one required skill. Preferred skills are optional.</p></div><div className="grid gap-5 md:grid-cols-2"><div><div className="mb-2 text-sm font-semibold text-slate-200">Required skills <span className="text-rose-300">*</span></div><div className="max-h-72 overflow-y-auto rounded-xl border border-slate-800 p-2">{skills.map(s=><label key={s.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-white/[.04]"><input type="checkbox" checked={required.includes(s.id)} onChange={()=>flip(required,setRequired,s.id)} className="accent-violet-400"/><span className="flex-1 text-xs text-slate-300">{s.name}</span><span className="text-[10px] text-slate-600">{s.category}</span></label>)}</div><div className="mt-2 text-[10px] text-slate-500">{required.length} selected</div></div><div><div className="mb-2 text-sm font-semibold text-slate-200">Preferred skills</div><div className="max-h-72 overflow-y-auto rounded-xl border border-slate-800 p-2">{skills.map(s=><label key={s.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-white/[.04]"><input type="checkbox" checked={preferred.includes(s.id)} onChange={()=>flip(preferred,setPreferred,s.id)} className="accent-emerald-400"/><span className="flex-1 text-xs text-slate-300">{s.name}</span><span className="text-[10px] text-slate-600">{s.category}</span></label>)}</div><div className="mt-2 text-[10px] text-slate-500">{preferred.length} selected</div></div></div></Panel>
      <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row"><Link href="/employer/jobs"><Button variant="quiet">Cancel</Button></Link><Button type="submit" disabled={create.isPending||update.isPending||required.length===0}>{create.isPending||update.isPending?'Saving listing…':existing?'Save changes':'Publish listing'}<ArrowRight size={15}/></Button></div>
    </form>
  </div>;
}
function AdminDashboard() {
  const q = useListJobs();
  const archive = useArchiveJob();
  const remove = useDeleteJob();
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const refresh = () => {
    qc.invalidateQueries({ queryKey: getListJobsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetEmployerDashboardQueryKey() });
  };
  if (q.isLoading) return <Loading label="Loading platform overview"/>;
  if (q.isError || !q.data?.success) {
    return <StateMessage title="Platform listings could not be loaded" body={userError(q.error)} tone="error"/>;
  }
  const jobs = q.data.data.items.map((item) => item.job);
  return <div className="enter">
    <PageTitle eyebrow="Admin workspace" title="Platform overview" note="Review every listing and remove or archive roles that should no longer be visible." action={<Link href="/employer/jobs/new"><Button><Plus size={15}/>Create a role</Button></Link>}/>
    {message && <div role="alert" className="mb-4 rounded-xl border border-rose-300/20 bg-rose-300/[.07] p-3 text-sm text-rose-100">{message}</div>}
    <div className="mb-6 grid gap-4 sm:grid-cols-3">
      {[{label:'All listings',value:jobs.length,icon:BriefcaseBusiness},{label:'Active',value:jobs.filter((job) => job.status === 'active').length,icon:Activity},{label:'Archived',value:jobs.filter((job) => job.status === 'archived').length,icon:Layers3}].map(item=><Panel key={item.label}><div className="flex items-center justify-between"><span className="text-xs text-slate-400">{item.label}</span><item.icon size={17} className="text-violet-200"/></div><div className="mt-3 font-mono text-3xl font-bold text-slate-100">{item.value}</div></Panel>)}
    </div>
    <Panel>
      <div className="mb-5"><div className="text-[10px] font-bold uppercase tracking-[.18em] text-violet-300">Listing moderation</div><h2 className="mt-1 font-serif text-xl font-bold text-slate-100">All job listings</h2></div>
      {jobs.length ? <div className="grid gap-3">{jobs.map((job) => <div key={job.id} className="flex flex-col justify-between gap-3 rounded-xl border border-slate-800/80 bg-[#0c1221] p-4 sm:flex-row sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><div className="font-semibold text-slate-100">{job.title}</div><Pill color={job.status === 'active' ? 'green' : 'neutral'}>{job.status}</Pill></div><div className="mt-1 text-xs text-slate-500">{job.company} · {job.location}</div></div><div className="flex flex-wrap gap-2"><Link href={`/employer/jobs/${job.id}/edit`}><Button variant="outline" className="py-2"><Settings2 size={14}/>Edit</Button></Link>{job.status === 'active' && <Button variant="outline" className="py-2" disabled={archive.isPending} onClick={() => {if (window.confirm(`Archive "${job.title}"?`)) archive.mutate({id:job.id},{onSuccess:refresh,onError:error=>setMessage(userError(error))});}}><Layers3 size={14}/>Archive</Button>}<Button variant="danger" className="py-2" disabled={remove.isPending} onClick={() => {if (window.confirm(`Permanently delete "${job.title}"? This cannot be undone.`)) remove.mutate({id:job.id},{onSuccess:refresh,onError:error=>setMessage(userError(error))});}}><Trash2 size={14}/>Delete</Button></div></div>)}</div> : <EmptyInline title="No job listings yet" body="Job listings will appear here when an employer publishes a role."/>}
    </Panel>
  </div>;
}

function EmployerNewJob() { return <AuthGate role={['employer','admin']}><JobEditor/></AuthGate>; }
function EmployerEditJob() {
  const p=useParams<{id:string}>();const id=p.id||'';const q=useGetJob(id);
  if(q.isLoading)return <Loading label="Loading listing"/>;
  if(q.isError||!q.data?.success)return <StateMessage title="This listing could not be edited" body={userError(q.error)} tone="error" action={<Link href="/employer/jobs"><Button variant="outline">Back to listings</Button></Link>}/>;
  return <AuthGate role={['employer','admin']}><JobEditor key={id} existing={q.data.data.job}/></AuthGate>;
}

function RoutedErrorBoundary({ children }: {children: ReactNode}) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}
function Router() {
  return <RoutedErrorBoundary><Shell><Switch>
    <Route path="/" component={Landing}/>
    <Route path="/login"><AuthPage mode="login"/></Route>
    <Route path="/register"><AuthPage mode="register"/></Route>
    <Route path="/dashboard"><AuthGate role="candidate"><CandidateDashboard/></AuthGate></Route>
    <Route path="/profile"><AuthGate role="candidate"><ProfilePage/></AuthGate></Route>
    <Route path="/skills"><AuthGate role="candidate"><SkillsPage/></AuthGate></Route>
    <Route path="/jobs"><JobsPage/></Route>
    <Route path="/jobs/:id"><JobDetailPage/></Route>
    <Route path="/saved-jobs"><AuthGate role="candidate"><SavedJobsPage/></AuthGate></Route>
    <Route path="/matches"><AuthGate role="candidate"><MatchesPage/></AuthGate></Route>
    <Route path="/skill-gaps"><AuthGate role="candidate"><SkillGapsPage/></AuthGate></Route>
    <Route path="/admin"><AuthGate role="admin"><AdminDashboard/></AuthGate></Route>
    <Route path="/employer"><AuthGate role="employer"><EmployerOverview/></AuthGate></Route>
    <Route path="/employer/jobs"><AuthGate role="employer"><EmployerJobsPage/></AuthGate></Route>
    <Route path="/employer/jobs/new"><EmployerNewJob/></Route>
    <Route path="/employer/jobs/:id/edit"><EmployerEditJob/></Route>
    <Route component={NotFound}/>
  </Switch></Shell></RoutedErrorBoundary>;
}
function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/,'')}><Router/></WouterRouter><Toaster/></TooltipProvider></QueryClientProvider>;
}

export default App;


